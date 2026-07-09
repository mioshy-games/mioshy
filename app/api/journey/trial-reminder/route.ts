/**
 * GET/POST /api/journey/trial-reminder
 *
 * A3 — 7-day trial reminder. Runs daily. For every trialing subscription whose
 * trial ends in ~24-48h (i.e. day 5-6 of a 7-day trial), send a one-time
 * "your trial ends soon, you'll be charged ₪X" email. This is a legal /
 * anti-chargeback requirement.
 *
 * Idempotency: before sending we check for an existing 'trial_ending_soon'
 * journey_notifications row for the same user (a user has at most one live
 * trial), so cron retries and daily overlap never double-send.
 *
 * The charged amount mirrors the renewals cron: intro_amount while
 * intro_charges_remaining > 0, else plan_amount.
 *
 * Auth: Bearer with the billing cron secret (falls back to the journey secrets).
 */

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { buildTrialDay5Email } from "@/lib/journey/mailing/sequence-emails";
import { emailSeriesTags } from "@/lib/journey/mailing/email-series";

function baseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://mioshy.com"
  ).replace(/\/+$/, "");
}

const HOURS = (n: number) => n * 60 * 60 * 1000;
const EMAIL_CAP_PER_RUN = 200;

function authOk(req: Request): boolean {
  const expected =
    process.env.CARDCOM_BILLING_CRON_SECRET ||
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.JOURNEY_CADENCE_CRON_SECRET;
  if (!expected) return process.env.VERCEL_ENV !== "production";
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: currency || "ILS",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: ["service_role_unavailable"] }, { status: 503 });
  }

  const now = Date.now();
  const windowStartIso = new Date(now + HOURS(24)).toISOString(); // ends in ≥24h
  const windowEndIso   = new Date(now + HOURS(48)).toISOString(); // ends in ≤48h

  const { data: subs, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, email, product, currency, plan_amount, intro_amount, intro_charges_remaining, trial_ends_at")
    .eq("status", "trialing")
    .gte("trial_ends_at", windowStartIso)
    .lte("trial_ends_at", windowEndIso)
    .limit(500);

  if (subErr) {
    return NextResponse.json({ ok: false, considered: 0, sent: 0, errors: [subErr.message] }, { status: 500 });
  }

  const considered = (subs ?? []).length;
  const errors: string[] = [];
  let sent = 0;

  for (const sub of (subs ?? []) as Array<{
    id: string;
    user_id: string;
    email: string | null;
    product: string;
    currency: string;
    plan_amount: number | null;
    intro_amount: number | null;
    intro_charges_remaining: number | null;
    trial_ends_at: string | null;
  }>) {
    if (sent >= EMAIL_CAP_PER_RUN) break;
    if (!sub.user_id) continue;

    // Idempotency: skip if this user already got a trial_ending_soon note.
    const { count } = await admin
      .from("journey_notifications")
      .select("id", { head: true, count: "exact" })
      .eq("recipient_user_id", sub.user_id)
      .eq("kind", "trial_ending_soon");
    if ((count ?? 0) > 0) continue;

    const useIntro = (sub.intro_charges_remaining ?? 0) > 0 && sub.intro_amount != null;
    const billAmount = useIntro ? (sub.intro_amount as number) : (sub.plan_amount ?? 0);
    const amountLabel = formatAmount(billAmount, sub.currency || "ILS");
    const dateLabel = sub.trial_ends_at
      ? new Date(sub.trial_ends_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
      : "";

    // Resolve the first name for the greeting (best-effort).
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", sub.user_id)
      .maybeSingle<{ full_name: string | null }>();
    const firstName = (prof?.full_name ?? "").trim().split(/\s+/)[0] || null;

    try {
      // §ת-1 final copy, in the designed transactional template.
      if (!sub.email) { errors.push(`${sub.id}:no_email`); continue; }
      const email = buildTrialDay5Email({
        firstName,
        trialEndDateHe: dateLabel,
        chargeAmountHe: amountLabel,
        baseUrl: baseUrl(),
      });
      const r = await sendBrevoEmail({
        to: [{ email: sub.email, name: firstName ?? undefined }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        tags: ["trial_day5", ...emailSeriesTags("trial_day5")],
        senderName: email.senderName, // From override → "מיאושי"
      });
      if (!r.ok) { errors.push(`${sub.id}:${r.error ?? "send_failed"}`); continue; }
      // Record for dedup (the query above skips users who already have this row).
      await admin.from("journey_notifications").insert({
        recipient_user_id: sub.user_id,
        kind: "trial_ending_soon",
        payload: { sub_id: sub.id, charge: amountLabel, ends: dateLabel },
      });
      sent++;
    } catch (e) {
      errors.push(`${sub.id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: errors.length === 0, considered, sent, errors });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
