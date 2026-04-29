/**
 * GET /api/journey/progress
 *
 * Returns the caller's current journey state so the client can render the
 * right question and know whether to show the auth modal / paywall.
 *
 * The caller must supply a `device_id` header (set by lib/device-id.ts) if
 * they are anonymous. Authenticated users are resolved via the Supabase
 * cookie session.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QUESTIONNAIRE, totalQuestions } from "@/lib/journey/questions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const deviceId = req.headers.get("x-device-id");

  if (!user && !deviceId) {
    return NextResponse.json(
      { error: "missing_identity", message: "Either log in or supply x-device-id header." },
      { status: 400 },
    );
  }

  // Look up the freshest journey row owned by this caller.
  const query = supabase
    .from("journeys")
    .select("id, user_id, device_id, status, current_step, language, started_at, last_activity_at")
    .order("last_activity_at", { ascending: false })
    .limit(1);

  const { data: journey } = user
    ? await query.eq("user_id", user.id).maybeSingle()
    : await query.eq("device_id", deviceId!).is("user_id", null).maybeSingle();

  // Active subscription check for paywall resume
  let subscriptionActive = false;
  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    subscriptionActive = !!sub;
  }

  return NextResponse.json({
    total: totalQuestions(),
    gating: QUESTIONNAIRE.gating,
    journey: journey ?? null,
    subscriptionActive,
  });
}
