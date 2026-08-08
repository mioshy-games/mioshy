/**
 * POST/GET /api/whatsapp/intro-reminder  (every-5-min cron)
 *
 * intro_price_expiry_reminder — the personal intro-price window is
 * journeys.offer_expires_at (stamped = SHORT-assessment completion + 60min). The
 * reminder fires ONCE, while 15–20 min remain (= 40–45 min after completion).
 * Eligibility (Itzik 2026-07-20):
 *
 *   now + 15min <= offer_expires_at < now + 20min   (a 5-min band that matches
 *   the every-5-min cron, so each user is caught exactly once)
 *   AND the user has NOT purchased (checked live, at send time).
 *
 * offer_expires_at is the single anchor: {{2}} (minutes left) is computed from
 * the same row as Math.floor((offer_expires_at - now)/60000). All sending goes
 * through the campaign layer (WHATSAPP_MODE / opt-in / idempotency / 1-per-week
 * throttle), so a real customer is only messaged in `live` mode or allowlisted.
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
import { introPriceExpiryReminderTemplate } from "@/lib/whatsapp/templates";
import { isReminderEligible } from "@/lib/whatsapp/rules";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

function authOk(req: Request): boolean {
  return isCronAuthorized(req, "journey");
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

  const url = new URL(req.url);
  const onlyUserId = url.searchParams.get("userId");

  // INTRO_REMINDER_ENABLED gates the GLOBAL broadcast (the cron / Stage B). A
  // TARGETED single-user run (?userId=…) bypasses it, so we can validate the
  // real flow for exactly ONE user (Itzik's Stage-A test) without enabling the
  // reminder for everyone — the campaign layer still enforces WHATSAPP_MODE /
  // allowlist / opt-in / throttle on that one send. The cron (no ?userId) stays
  // inert while the flag is false, so nothing broadcasts.
  if (!INTRO_REMINDER_ENABLED && !onlyUserId) {
    return NextResponse.json({ ok: true, disabled: true, scanned: 0, processed: 0, results: [] });
  }
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ ok: false, error: "no-admin-client" }, { status: 500 });

  const now = new Date();
  const in15minIso = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const in20minIso = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

  // Journeys with 15–20 min left in the intro window (= 40–45 min after
  // completion, for the 60-min window): now + 15min <= offer_expires_at <
  // now + 20min. This 5-min band matches the every-5-min cron so each user is
  // caught exactly once; isReminderEligible re-checks the same window.
  let q = admin
    .from("journeys")
    .select("user_id, offer_expires_at")
    .not("offer_expires_at", "is", null)
    .gte("offer_expires_at", in15minIso)
    .lt("offer_expires_at", in20minIso);
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

    // {{2}} — whole minutes left in the intro window, rounded DOWN so we never
    // overstate the time remaining. "דקות" is fixed text in the template.
    const minutesLeft = String(
      Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60000),
    );
    const outcome = await sendCampaignMessage({
      userId,
      template: introPriceExpiryReminderTemplate({ name: firstName, minutesLeft }),
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
