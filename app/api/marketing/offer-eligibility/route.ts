/**
 * GET /api/marketing/offer-eligibility
 *
 * Tells the client whether to SUPPRESS the quick-assessment offer:
 *   • assessmentDone  — user/device already completed the short assessment
 *   • journeyEntitled — already owns the journey product (don't offer what they bought)
 *   • loggedIn        — used to pick the "after login" vs "return" copy
 *
 * Reuses the existing signals (journeys.status + getUserEntitlements) — no new
 * source of truth. Works for logged-in (session) and anonymous (x-device-id)
 * visitors. Metadata only.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";

export async function GET(req: Request): Promise<NextResponse> {
  let loggedIn = false;
  let assessmentDone = false;
  let journeyEntitled = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = !!user;

    const deviceId = req.headers.get("x-device-id");

    // ── Short-assessment completion (journeys.status). Service role so we can
    //    read anonymous (device-keyed) rows too. ──────────────────────────────
    const admin = createServiceRoleClient();
    if (admin && (user || deviceId)) {
      let q = admin
        .from("journeys")
        .select("status")
        .order("last_activity_at", { ascending: false })
        .limit(1);
      q = user
        ? q.eq("user_id", user.id)
        : q.eq("device_id", deviceId!).is("user_id", null);
      const { data } = await q.maybeSingle();
      const status = data?.status as string | undefined;
      // Task 26 (Itzik 2026-07-03): the SHORT assessment leaves
      // journeys.status='paywall' (app/api/journey/answer/route.ts:385-387) —
      // NOT 'complete'. A user sitting at the paywall HAS finished the (short)
      // assessment, so the "take the assessment" offer must be suppressed for
      // them too; otherwise it re-invites them to the assessment they just did
      // (the P0 post-payment "11 questions" popup). Count paywall as done.
      assessmentDone =
        status === "complete" || status === "completed" || status === "paywall";
    }

    // ── Journey entitlement (logged-in only). ────────────────────────────────
    if (user) {
      const ent = await getUserEntitlements().catch(() => null);
      journeyEntitled = ent?.journey === true;
    }
  } catch {
    // Best-effort — on any error we return the safe default (not suppressed),
    // so a transient failure never permanently hides the offer.
  }

  return NextResponse.json({ loggedIn, assessmentDone, journeyEntitled });
}
