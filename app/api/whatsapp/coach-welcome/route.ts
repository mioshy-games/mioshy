/**
 * GET/POST /api/whatsapp/coach-welcome  (daily cron, 10:00 Asia/Jerusalem)
 *
 * coach_welcome — the one-time WhatsApp welcome for a new JOURNEY joiner, sent
 * "the next morning at 10:00" instead of instantly on join. The join moment is
 * the journey subscription's created_at. Scheduling rule (cutoff 20:00 Israel):
 *   • joined before 20:00 on day D  → sent D+1 10:00
 *   • joined at/after 20:00 on day D → sent D+2 10:00
 * implemented as: each 10:00 run sends everyone whose join is in the window
 * [ Israel today−2 20:00 , Israel today−1 20:00 ). See coach-welcome-schedule.ts.
 *
 * The delay lets us send the REAL topic the user picked in /journey/assessment
 * (journey_user_priorities.ranking[0] → its Hebrew category label) in {{3}},
 * falling back to "זוגיות".
 *
 * DST: Vercel cron is UTC-only. vercel.json registers 0 7 * * * AND 0 8 * * *;
 * this handler proceeds only when the Israel-local hour is 10, so it runs once
 * at 10:00 local in either season. A `?userId=<id>` run (single-user test)
 * bypasses the hour gate and the window and targets that one joiner.
 *
 * All sending goes through sendCampaignMessage (WHATSAPP_MODE / opt-in /
 * idempotency / 1-per-week throttle) — a real customer is only messaged in
 * `live` mode or when allowlisted, exactly once per (template, user). The iron
 * rule (coach_welcome only to joiners) holds structurally: we only scan journey
 * subscriptions. Best-effort; never throws.
 *
 * Auth: Bearer with the billing cron secret (falls back to journey/mailing).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { sendCampaignMessage } from "@/lib/whatsapp/campaign";
import { coachWelcomeTemplate } from "@/lib/whatsapp/templates";
import { israelHour, coachWelcomeWindow } from "@/lib/whatsapp/coach-welcome-schedule";

const COACH_WELCOME_FALLBACK_TOPIC = "זוגיות";

function authOk(req: Request): boolean {
  const expected =
    process.env.CARDCOM_BILLING_CRON_SECRET ||
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.MAILING_TEST_SECRET;
  if (!expected) return process.env.VERCEL_ENV !== "production";
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

async function run(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ ok: false, error: "no-admin-client" }, { status: 500 });

  const url = new URL(req.url);
  const onlyUserId = url.searchParams.get("userId");
  const now = new Date();

  // DST gate: two UTC cron entries (0 7 / 0 8) map to 10:00 local across seasons;
  // proceed only at 10:00 Israel. A single-user test bypasses so it runs anytime.
  if (!onlyUserId && israelHour(now) !== 10) {
    return NextResponse.json({ ok: true, skipped: "not-10am-israel", israelHour: israelHour(now) });
  }

  // Journey joiners whose join (subscriptions.created_at) is due now.
  const { lowerMs, upperMs } = coachWelcomeWindow(now);
  let q = admin
    .from("subscriptions")
    .select("user_id, created_at")
    .eq("product", "journey");
  if (onlyUserId) {
    // Single-user test: their first journey join, ignore the window.
    q = q.eq("user_id", onlyUserId).order("created_at", { ascending: true }).limit(1);
  } else {
    q = q
      .gte("created_at", new Date(lowerMs).toISOString())
      .lt("created_at", new Date(upperMs).toISOString());
  }

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Category id → Hebrew label, for the {{3}} topic (journey_user_priorities
  // stores an ordered array of category ids).
  const catLabels = new Map<string, string>();
  {
    const { data: cats } = await admin
      .from("journey_categories")
      .select("id, name_he");
    for (const c of cats ?? []) {
      if (c.id && c.name_he) catLabels.set(c.id as string, c.name_he as string);
    }
  }

  const results: Array<{ user_id: string; outcome: string; reason?: string; topic?: string }> = [];
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);

    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null }>();
    const firstName = (prof?.full_name ?? "").trim().split(/\s+/)[0];
    if (!firstName) {
      results.push({ user_id: userId, outcome: "skipped", reason: "no-name" });
      continue;
    }

    // {{3}} — the topic the user ranked first, mapped to its Hebrew label.
    // Fallback to "זוגיות" when no ranking exists yet.
    let topic = COACH_WELCOME_FALLBACK_TOPIC;
    const { data: pri } = await admin
      .from("journey_user_priorities")
      .select("ranking")
      .eq("user_id", userId)
      .maybeSingle<{ ranking: string[] | null }>();
    const topCatId = pri?.ranking?.[0];
    if (topCatId && catLabels.has(topCatId)) topic = catLabels.get(topCatId)!;

    const outcome = await sendCampaignMessage({
      userId,
      template: coachWelcomeTemplate({ name: firstName, category: topic }),
    });
    results.push({ user_id: userId, outcome: outcome.status, reason: outcome.reason, topic });
  }

  return NextResponse.json({
    ok: true,
    window: onlyUserId ? "single-user" : { fromIso: new Date(lowerMs).toISOString(), toIso: new Date(upperMs).toISOString() },
    scanned: rows?.length ?? 0,
    processed: results.length,
    results,
  });
}

export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}
