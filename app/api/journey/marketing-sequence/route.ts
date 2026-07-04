/**
 * GET/POST /api/journey/marketing-sequence
 *
 * The post-assessment marketing sequence (docs/mailing-schedule-2026-07-03.md
 * §1, §2, §3ב, §21). Runs hourly. For every short-assessment completer who
 * consented to marketing and has NOT purchased, it sends each of the four
 * emails once, at its scheduled time.
 *
 * Timing is anchored on t0 = journeys.offer_expires_at − 48h (offer_expires_at
 * is stamped exactly at short completion, so it is a reliable t0):
 *   • results_ready  — at t0 (immediate; the hourly run catches it).
 *   • evening_proof  — the first 20:00 at/after t0.
 *   • deadline       — offer_expires_at − 12h (only while the window is open).
 *   • day7_value_tip — t0 + 7d at 10:00 (Sun–Thu only; Fri/Sat → next Sunday).
 *
 * Gates: profiles.marketing_consent = true; ANY subscription (active/trialing)
 * stops the whole sequence. Idempotent via marketing_email_log (insert-first).
 *
 * NOT LIVE until merged to game — kept on feat for Itzik's review + a test send.
 * Live 5-domain score lines in §1 + the dynamic graph image are a follow-up
 * (the send-test shows the intended layout with sample scores).
 *
 * Auth: Bearer with a journey/mailing cron secret.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { getViewerPriorityOrder } from "@/lib/dashboard/priority-routing";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import {
  buildSequenceEmail,
  type SequenceEmailKind,
  type SeqPersonalization,
} from "@/lib/journey/mailing/sequence-emails";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const EMAIL_CAP_PER_RUN = 150;

function authOk(req: Request): boolean {
  const expected =
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.MAILING_TEST_SECRET ||
    process.env.CARDCOM_BILLING_CRON_SECRET;
  if (!expected) return process.env.VERCEL_ENV !== "production";
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

function baseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://mioshy.com"
  ).replace(/\/+$/, "");
}

const HE_DAY = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
function heDay(d: Date): string {
  return HE_DAY[d.getDay()] ?? "";
}
function hhmm(d: Date): string {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
/** The first HH:00 at/after `from`. */
function nextClock(from: Date, hour: number): Date {
  const d = new Date(from);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() < from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}
/** Push Fri(5)/Sat(6) to the following Sunday, same time. */
function toSunThu(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 5 || out.getDay() === 6) out.setDate(out.getDate() + 1);
  return out;
}

interface Summary {
  ok: boolean;
  considered: number;
  sent: number;
  errors: string[];
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: ["unauthorized"] }, { status: 401 });
  }
  // Safe-merge gate: the cron ships to prod inert. Itzik flips this on AFTER
  // approving the test send, so nothing goes out before then.
  if (process.env.MAILING_SEQUENCE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, considered: 0, sent: 0, errors: ["disabled — set MAILING_SEQUENCE_ENABLED=true to go live"] });
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: ["service_role_unavailable"] }, { status: 503 });
  }

  const now = new Date();
  const base = baseUrl();
  // Bound the scan: t0 within the last ~9 days (day-7 email fires at t0+7d).
  const lowerOffer = new Date(now.getTime() - 9 * DAY).toISOString();
  const upperOffer = new Date(now.getTime() + 2 * DAY).toISOString();

  const { data: journeys, error } = await admin
    .from("journeys")
    .select("user_id, offer_expires_at")
    .not("offer_expires_at", "is", null)
    .not("user_id", "is", null)
    .gte("offer_expires_at", lowerOffer)
    .lte("offer_expires_at", upperOffer)
    .limit(1000);

  if (error) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: [error.message] }, { status: 500 });
  }

  // De-dupe to the latest offer window per user.
  const byUser = new Map<string, Date>();
  for (const j of journeys ?? []) {
    const uid = j.user_id as string;
    const exp = new Date(j.offer_expires_at as string);
    const cur = byUser.get(uid);
    if (!cur || exp.getTime() > cur.getTime()) byUser.set(uid, exp);
  }

  const labels = await getPriorityLabels().catch(() => null);
  const errors: string[] = [];
  let sent = 0;
  const considered = byUser.size;

  for (const [userId, offerExpiresAt] of byUser) {
    if (sent >= EMAIL_CAP_PER_RUN) break;

    // Gate 1 — profile: must exist, have an email, and marketing consent.
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, marketing_consent")
      .eq("id", userId)
      .maybeSingle<{ email: string | null; full_name: string | null; marketing_consent: boolean | null }>();
    if (!profile?.email || profile.marketing_consent !== true) continue;

    // Gate 2 — any purchase (active/trialing) stops the whole sequence.
    if (await hasActiveSubscription(admin, userId).catch(() => false)) continue;

    const t0 = new Date(offerExpiresAt.getTime() - 2 * DAY); // short completion
    // Due-time per email.
    const due: Record<SequenceEmailKind, Date> = {
      results_ready: t0,
      evening_proof: nextClock(t0, 20),
      deadline: new Date(offerExpiresAt.getTime() - 12 * HOUR),
      day7_value_tip: toSunThu(nextClock(new Date(t0.getTime() + 7 * DAY), 10)),
    };
    // Upper bounds so a stale row never fires an obsolete email.
    const expired: Partial<Record<SequenceEmailKind, boolean>> = {
      // deadline is pointless once the window has fully closed.
      deadline: now.getTime() > offerExpiresAt.getTime(),
      // evening_proof shouldn't fire after the window closed either.
      evening_proof: now.getTime() > offerExpiresAt.getTime(),
    };

    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] || null;
    let focusDomainHe: string | null = null;
    try {
      const order = await getViewerPriorityOrder(userId);
      const top = order?.[0] ?? null;
      if (top && labels) focusDomainHe = labels.labelsHe[top] ?? null;
    } catch { /* focus stays null → generic copy */ }

    const p: SeqPersonalization = {
      firstName,
      focusDomainHe,
      // Live 5-domain score lines are a follow-up (see docblock); the email
      // renders correctly without the score box.
      scoreLines: [],
      windowDayHe: heDay(offerExpiresAt),
      windowTime: hhmm(offerExpiresAt),
      exercise: null,
      baseUrl: base,
      unsubscribeUrl: `${base}/he/account`,
    };

    for (const kind of Object.keys(due) as SequenceEmailKind[]) {
      if (sent >= EMAIL_CAP_PER_RUN) break;
      if (expired[kind]) continue;
      if (now.getTime() < due[kind].getTime()) continue;

      // Idempotency: claim the (user, kind) slot BEFORE sending.
      const { error: logErr } = await admin
        .from("marketing_email_log")
        .insert({ user_id: userId, email_kind: kind });
      if (logErr) continue; // unique-violation = already sent, or a real error → skip

      const email = buildSequenceEmail(kind, p);
      const r = await sendBrevoEmail({
        to: [{ email: profile.email, name: firstName ?? undefined }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        tags: [`seq_${kind}`],
      });
      if (r.ok) {
        sent++;
        if (r.messageId) {
          await admin
            .from("marketing_email_log")
            .update({ brevo_message_id: r.messageId })
            .eq("user_id", userId)
            .eq("email_kind", kind);
        }
      } else {
        errors.push(`${userId.slice(0, 8)}:${kind}:${r.error ?? "send_failed"}`);
      }
    }
  }

  return NextResponse.json({ ok: errors.length === 0, considered, sent, errors });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
