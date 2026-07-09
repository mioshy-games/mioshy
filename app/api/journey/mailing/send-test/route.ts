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
import { emailSeriesTags } from "@/lib/journey/mailing/email-series";
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
  // Optional: scope the preview to one email_key (e.g. "founder_story").
  const only = typeof body?.only === "string" && body.only.trim() ? body.only.trim() : null;
  const base = baseUrl();

  // Representative sample data (mirrors a real post-assessment user). gender +
  // structured `scores` drive the new results_ready renderer (gender-adapted
  // copy + score table with the "(נבחרה להתחלה)" tag on the priority row).
  const sample: SeqPersonalization = {
    firstName: "איציק",
    focusDomainHe: "תקשורת",
    scoreLines: [], // legacy field, unused by results_ready's dedicated renderer
    gender: "male",
    scores: [
      { labelHe: "תקשורת", score: 50, isPriority: true },
      { labelHe: "אינטימיות", score: 62, isPriority: false },
      { labelHe: "חיבור רגשי", score: 58, isPriority: false },
      { labelHe: "חברות", score: 71, isPriority: false },
      { labelHe: "משפחה", score: 64, isPriority: false },
    ],
    // Sample pricing (mirrors the current live promo) for the preview.
    pricing: {
      noCoachingRegular: 67,
      noCoachingFirst: 37,
      withCoachingRegular: 189,
      withCoachingFirst: 89,
    },
    windowDayHe: "יום שני",
    windowTime: "21:00",
    exercise: null,
    baseUrl: base,
    unsubscribeUrl: `${base}/he/account`,
  };

  const allEmails = [
    { tag: "test-results_ready", key: "results_ready", ...buildSequenceEmail("results_ready", sample) },
    { tag: "test-founder_story", key: "founder_story", ...buildSequenceEmail("founder_story", sample) },
    { tag: "test-deadline", key: "deadline", ...buildSequenceEmail("deadline", sample) },
    { tag: "test-day7_value_tip", key: "day7_value_tip", ...buildSequenceEmail("day7_value_tip", sample) },
    {
      tag: "test-trial_day5",
      key: "trial_day5",
      ...buildTrialDay5Email({
        firstName: "איציק",
        trialEndDateHe: "10 ביולי 2026",
        chargeAmountHe: "37 ₪",
        baseUrl: base,
      }),
    },
  ];
  const emails = only ? allEmails.filter((e) => e.key === only) : allEmails;

  const results: Array<{ tag: string; ok: boolean; skipped?: boolean; error?: string }> = [];
  for (const e of emails) {
    const r = await sendBrevoEmail({
      to: [{ email: to, name: "Itzik" }],
      subject: e.subject,
      htmlContent: e.html,
      textContent: e.text,
      tags: [e.tag, ...emailSeriesTags(e.key)],
      // results_ready carries a From override ("יצחק ברלב"); others are undefined.
      senderName: (e as { senderName?: string }).senderName,
    });
    results.push({ tag: e.tag, ok: r.ok, skipped: r.skipped, error: r.error });
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), to, results });
}
