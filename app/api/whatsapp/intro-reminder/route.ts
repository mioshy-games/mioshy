/**
 * POST/GET /api/whatsapp/intro-reminder  (hourly cron)
 *
 * intro_price_expiry_reminder — the personal intro-price window is
 * journeys.offer_expires_at (stamped = SHORT-assessment completion + 48h). The
 * reminder must fire 24h after completion, i.e. once we're inside the LAST 24h
 * before expiry. Eligibility (Itzik 2026-07-06):
 *
 *   now >= offer_expires_at - 24h   AND   now < offer_expires_at
 *   AND the user has NOT purchased (checked live, at send time).
 *
 * Using offer_expires_at as the single anchor also guarantees {{2}} (the expiry
 * label) is always available from the same row. All sending goes through the
 * campaign layer (WHATSAPP_MODE / opt-in / idempotency / 1-per-week throttle),
 * so a real customer is only messaged in `live` mode or when allowlisted.
 *
 * `?userId=<id>` restricts the run to one user (used for the gate test after a
 * time-shift), so a test never touches anyone else.
 *
 * Auth: Bearer with the billing cron secret (falls back to journey secrets).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { sendCampaignMessage } from "@/lib/whatsapp/campaign";
import {
  introPriceExpiryReminderTemplate,
  expiryLabelFromCloseTime,
} from "@/lib/whatsapp/templates";
import { isReminderEligible } from "@/lib/whatsapp/rules";

function authOk(req: Request): boolean {
  const expected =
    process.env.CARDCOM_BILLING_CRON_SECRET ||
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.MAILING_TEST_SECRET;
  if (!expected) return process.env.VERCEL_ENV !== "production";
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

/**
 * KILL-SWITCH (2026-07-16): the intro-price-expiry WhatsApp reminder is turned
 * OFF. It reminded users before their 48h offer window closed, but the window
 * shrank to 60min and we stopped this reminder. The whole route + rules + Brevo
 * template are KEPT for reuse in a future campaign — flip this back to `true`
 * (or wire it to an env flag) to re-enable. While false, the endpoint runs inert
 * (scans nothing, sends nothing) even if the cron still fires.
 */
const INTRO_REMINDER_ENABLED = false;

async function run(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!INTRO_REMINDER_ENABLED) {
    return NextResponse.json({ ok: true, disabled: true, scanned: 0, processed: 0, results: [] });
  }
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ ok: false, error: "no-admin-client" }, { status: 500 });

  const url = new URL(req.url);
  const onlyUserId = url.searchParams.get("userId");

  const now = new Date();
  const nowIso = now.toISOString();
  const in24hIso = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

  // Journeys whose intro window expires within the next 24h (i.e. we're now in
  // the last-24h band): now < offer_expires_at <= now + 24h.
  let q = admin
    .from("journeys")
    .select("user_id, offer_expires_at")
    .not("offer_expires_at", "is", null)
    .gt("offer_expires_at", nowIso)
    .lte("offer_expires_at", in24hIso);
  if (onlyUserId) q = q.eq("user_id", onlyUserId);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results: Array<{ user_id: string; outcome: string; reason?: string }> = [];
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const expiresAt = row.offer_expires_at as string;

    // Purchase check AT SEND TIME. Purchaser (any current access, incl. trial)
    // OR any subscription row ever → excluded (rules 1 + 3).
    const ent = await getUserEntitlements(userId).catch(() => null);
    const { count: subCount } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const hasActiveJourney = Boolean(ent?.journey);
    const hasAnySubscription = (subCount ?? 0) > 0;
    if (
      !isReminderEligible({
        offerExpiresAtMs: new Date(expiresAt).getTime(),
        nowMs: now.getTime(),
        hasActiveJourney,
        hasAnySubscription,
      })
    ) {
      results.push({
        user_id: userId,
        outcome: "skipped",
        reason: hasActiveJourney
          ? "purchaser-active"
          : hasAnySubscription
            ? "has-subscription"
            : "out-of-window",
      });
      continue;
    }

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

    const outcome = await sendCampaignMessage({
      userId,
      template: introPriceExpiryReminderTemplate({
        name: firstName,
        // {{2}} — computed from the REAL promo close time (offer_expires_at),
        // DST-aware (Asia/Jerusalem). Both the day word and the hour are
        // derived from the instant, never hand-written. `now` defaults to the
        // send instant inside the helper.
        expiryLabel: expiryLabelFromCloseTime(new Date(expiresAt)),
      }),
    });
    results.push({ user_id: userId, outcome: outcome.status, reason: outcome.reason });
  }

  return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, processed: results.length, results });
}

export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}
