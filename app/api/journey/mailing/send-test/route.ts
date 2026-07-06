/**
 * POST /api/journey/mailing/send-test
 *
 * Sends ONE copy of each of the five post-assessment emails to a target inbox
 * (default itzik@uxellent.com) with sample personalization, so Itzik can review
 * the real rendering in Gmail mobile before the sequence goes live. Does NOT
 * touch the marketing_email_log (it's a preview, not a real send), and never
 * checks consent — it only ever sends to the explicit test address.
 *
 * Auth: Bearer with a cron/mailing secret. Body: { to?: string }.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildSequenceEmail,
  buildTrialDay5Email,
  type SeqPersonalization,
} from "@/lib/journey/mailing/sequence-emails";

const DEFAULT_TO = "itzik@uxellent.com";

function authOk(req: Request): boolean {
  const expected =
    process.env.MAILING_TEST_SECRET ||
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
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

export async function POST(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const to = typeof body?.to === "string" && body.to.includes("@") ? body.to : DEFAULT_TO;
  const base = baseUrl();

  // Representative sample data (mirrors a real post-assessment user).
  const sample: SeqPersonalization = {
    firstName: "איציק",
    focusDomainHe: "תקשורת",
    scoreLines: [
      "תקשורת: 50 מתוך 100",
      "אינטימיות: 62 מתוך 100",
      "חיבור רגשי: 58 מתוך 100",
      "חברות: 71 מתוך 100",
      "משפחה: 64 מתוך 100",
    ],
    windowDayHe: "יום שני",
    windowTime: "21:00",
    exercise: null,
    baseUrl: base,
    unsubscribeUrl: `${base}/he/account`,
  };

  const emails = [
    { tag: "test-results_ready", ...buildSequenceEmail("results_ready", sample) },
    { tag: "test-evening_proof", ...buildSequenceEmail("evening_proof", sample) },
    { tag: "test-deadline", ...buildSequenceEmail("deadline", sample) },
    { tag: "test-day7_value_tip", ...buildSequenceEmail("day7_value_tip", sample) },
    {
      tag: "test-trial_day5",
      ...buildTrialDay5Email({
        firstName: "איציק",
        trialEndDateHe: "10 ביולי 2026",
        chargeAmountHe: "37 ₪",
        baseUrl: base,
      }),
    },
  ];

  const results: Array<{ tag: string; ok: boolean; skipped?: boolean; error?: string }> = [];
  for (const e of emails) {
    const r = await sendBrevoEmail({
      to: [{ email: to, name: "Itzik" }],
      subject: e.subject,
      htmlContent: e.html,
      textContent: e.text,
      tags: [e.tag],
    });
    results.push({ tag: e.tag, ok: r.ok, skipped: r.skipped, error: r.error });
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), to, results });
}
