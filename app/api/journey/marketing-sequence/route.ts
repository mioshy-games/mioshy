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
 * Gates:
 *   • profiles.marketing_consent = true (email is read from auth.users — profiles
 *     has NO email column; an earlier version selected profiles.email and skipped
 *     everyone, keeping the sequence silently inert).
 *   • Launch cutoff MAILING_SEQUENCE_ACTIVATION_TS: only assessments completed
 *     at/after it (t0 ≥ activation) — so enabling never fans out to the backlog.
 *     Unset → block everyone.
 *   • results_ready/evening_proof/deadline all expire once the offer window has
 *     closed (now > offer_expires_at) — no obsolete email to a lapsed window.
 *   • ANY subscription (active/trialing) stops the whole sequence.
 *   • Idempotent via marketing_email_log (insert-first, unique (user, kind)).
 *
 * Test mode (query params): onlyUserId=<uuid> scopes the whole run to one user
 * and bypasses MAILING_SEQUENCE_ENABLED (so we verify a demo while the global
 * sequence stays off); dryRun=1 computes the per-kind decision without sending
 * or logging and returns it in `plan`; testTo=<email> (onlyUserId only) routes
 * the live send to a controlled test inbox instead of the account's real email.
 *
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

interface PlanEntry {
  user_id: string;
  email?: string;
  kind?: SequenceEmailKind;
  due_at?: string;
  decision: string; // would_send | skip_no_consent | skip_no_email | skip_before_activation | skip_purchased | skip_expired | skip_not_due | skip_already_sent
}
interface Summary {
  ok: boolean;
  considered: number;
  sent: number;
  errors: string[];
  dryRun?: boolean;
  onlyUserId?: string;
  activationTs?: string | null;
  plan?: PlanEntry[];
}

/** Launch cutoff. The sequence applies ONLY to assessments completed at/after
 *  this timestamp (t0 = offer_expires_at − 48h ≥ activation), so turning it on
 *  never fans out to the historical backlog. Unset → block everyone (inert). */
function activationTsMs(): number | null {
  const raw = process.env.MAILING_SEQUENCE_ACTIVATION_TS;
  if (!raw || !raw.trim()) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? t : null;
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: ["unauthorized"] }, { status: 401 });
  }

  // Scoped test mode: onlyUserId restricts the whole run to a single user and
  // dryRun computes decisions WITHOUT sending or logging. onlyUserId also
  // bypasses MAILING_SEQUENCE_ENABLED so we can verify timing against a demo
  // while the global sequence stays off.
  const url = new URL(req.url);
  const onlyUserId = url.searchParams.get("onlyUserId")?.trim() || null;
  const dryRun =
    url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  // Test-only recipient override (honored ONLY on a scoped onlyUserId run): route
  // the demo's real send to a controlled test inbox instead of the account's
  // auth.users email, so idempotency can be proven with a live send without
  // mutating auth.users or ever mailing a real address. Ignored in the global run.
  const testTo = onlyUserId ? url.searchParams.get("testTo")?.trim() || null : null;

  // Safe-merge gate: the cron ships to prod inert. Itzik flips this on AFTER
  // approving the test send, so nothing goes out before then. Scoped test runs
  // (onlyUserId) bypass it.
  if (!onlyUserId && process.env.MAILING_SEQUENCE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, considered: 0, sent: 0, errors: ["disabled — set MAILING_SEQUENCE_ENABLED=true to go live"] });
  }
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: ["service_role_unavailable"] }, { status: 503 });
  }

  const now = new Date();
  const base = baseUrl();
  // Global activation comes from env (unset → block everyone). A scoped test
  // run (onlyUserId) may override it via ?activationTs=<iso>, so we can verify
  // a demo's windows without ever arming the global env.
  let activationTs = activationTsMs();
  if (onlyUserId) {
    const ov = url.searchParams.get("activationTs");
    if (ov) {
      const t = Date.parse(ov);
      if (Number.isFinite(t)) activationTs = t;
    }
  }

  // De-dupe to the latest offer window per user.
  const byUser = new Map<string, Date>();
  if (onlyUserId) {
    // Scoped run: fetch this user's latest offer window directly (ignore the
    // scan bounds so any test shift is picked up).
    const { data: j } = await admin
      .from("journeys")
      .select("offer_expires_at")
      .eq("user_id", onlyUserId)
      .not("offer_expires_at", "is", null)
      .order("offer_expires_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ offer_expires_at: string }>();
    if (j?.offer_expires_at) byUser.set(onlyUserId, new Date(j.offer_expires_at));
  } else {
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
    for (const jr of journeys ?? []) {
      const uid = jr.user_id as string;
      const exp = new Date(jr.offer_expires_at as string);
      const cur = byUser.get(uid);
      if (!cur || exp.getTime() > cur.getTime()) byUser.set(uid, exp);
    }
  }

  const labels = await getPriorityLabels().catch(() => null);
  const errors: string[] = [];
  const plan: PlanEntry[] = [];
  let sent = 0;
  const considered = byUser.size;

  for (const [userId, offerExpiresAt] of byUser) {
    if (!dryRun && sent >= EMAIL_CAP_PER_RUN) break;

    // Gate 1a — consent. profiles holds marketing_consent + full_name (NOT
    // email; email lives on auth.users, see Gate 1b).
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, marketing_consent")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null; marketing_consent: boolean | null }>();
    if (!profile || profile.marketing_consent !== true) {
      if (onlyUserId) plan.push({ user_id: userId, decision: "skip_no_consent" });
      continue;
    }

    // Gate 1b — email lives on auth.users, not profiles.
    const { data: au } = await admin.auth.admin.getUserById(userId);
    const emailAddr = au?.user?.email ?? null;
    if (!emailAddr) {
      if (onlyUserId) plan.push({ user_id: userId, decision: "skip_no_email" });
      continue;
    }

    const t0 = new Date(offerExpiresAt.getTime() - 2 * DAY); // short completion
    // Edge rule — launch cutoff: only assessments completed at/after activation.
    if (activationTs === null || t0.getTime() < activationTs) {
      if (onlyUserId) plan.push({ user_id: userId, email: emailAddr, decision: "skip_before_activation" });
      continue;
    }

    // Gate 2 — any purchase (active/trialing) stops the whole sequence.
    if (await hasActiveSubscription(admin, userId).catch(() => false)) {
      if (onlyUserId) plan.push({ user_id: userId, email: emailAddr, decision: "skip_purchased" });
      continue;
    }

    // Due-time per email.
    const due: Record<SequenceEmailKind, Date> = {
      results_ready: t0,
      evening_proof: nextClock(t0, 20),
      deadline: new Date(offerExpiresAt.getTime() - 12 * HOUR),
      day7_value_tip: toSunThu(nextClock(new Date(t0.getTime() + 7 * DAY), 10)),
    };
    // Upper bounds so a stale row never fires an obsolete email once the offer
    // window has closed (results_ready included — see edge rule).
    const windowClosed = now.getTime() > offerExpiresAt.getTime();
    const expired: Partial<Record<SequenceEmailKind, boolean>> = {
      results_ready: windowClosed,
      evening_proof: windowClosed,
      deadline: windowClosed,
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
      if (!dryRun && sent >= EMAIL_CAP_PER_RUN) break;
      const isExpired = !!expired[kind];
      const notDue = now.getTime() < due[kind].getTime();

      if (dryRun) {
        // Report the decision without touching Brevo or the log. Reflect the
        // idempotency check too (already-sent rows).
        let decision: string;
        if (isExpired) decision = "skip_expired";
        else if (notDue) decision = "skip_not_due";
        else {
          const { data: existing } = await admin
            .from("marketing_email_log")
            .select("user_id")
            .eq("user_id", userId)
            .eq("email_kind", kind)
            .maybeSingle();
          decision = existing ? "skip_already_sent" : "would_send";
        }
        plan.push({ user_id: userId, email: emailAddr, kind, due_at: due[kind].toISOString(), decision });
        continue;
      }

      if (isExpired || notDue) continue;

      // Idempotency: claim the (user, kind) slot BEFORE sending.
      const { error: logErr } = await admin
        .from("marketing_email_log")
        .insert({ user_id: userId, email_kind: kind });
      if (logErr) continue; // unique-violation = already sent, or a real error → skip

      const email = buildSequenceEmail(kind, p);
      const r = await sendBrevoEmail({
        to: [{ email: testTo ?? emailAddr, name: firstName ?? undefined }],
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

  return NextResponse.json({
    ok: errors.length === 0,
    considered,
    sent,
    errors,
    ...(onlyUserId ? { onlyUserId, dryRun, activationTs: activationTs ? new Date(activationTs).toISOString() : null, plan } : {}),
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
