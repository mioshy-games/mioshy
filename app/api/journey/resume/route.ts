/**
 * POST /api/journey/resume
 *
 * Called right after a user registers (or logs in) in the middle of the
 * questionnaire. Links the anonymous journey (by device_id) to the user
 * and returns the journey row so the client can jump back to `current_step`.
 *
 * Body: { device_id: string }
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  console.log("[/api/journey/resume] called", {
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    hasUser: !!user,
  });

  if (!user) {
    console.warn("[/api/journey/resume] UNAUTHORIZED - auth cookie not propagated yet");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { device_id } = (await req.json().catch(() => ({}))) as { device_id?: string };
  if (!device_id || device_id.length < 8) {
    console.warn("[/api/journey/resume] missing_device_id", { device_id });
    return NextResponse.json({ error: "missing_device_id" }, { status: 400 });
  }

  // Pre-RPC: check what anon journey exists for this device_id
  const { createServiceRoleClient } = await import("@/lib/supabase-admin");
  const admin = createServiceRoleClient();
  if (admin) {
    const { data: anonJourney } = await admin
      .from("journeys")
      .select("id, current_step, status, user_id, last_activity_at")
      .eq("device_id", device_id)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("[/api/journey/resume] pre-RPC anon journey state", {
      device_id,
      anonJourney,
    });
  }

  // Link the anon journey via the SQL helper (SECURITY DEFINER).
  const { data: linked, error } = await supabase.rpc("link_journey_to_user", { p_device_id: device_id });
  if (error) {
    console.error("[/api/journey/resume] link_journey_to_user RPC failed", error);
    return NextResponse.json({ error: "link_failed", detail: error.message }, { status: 500 });
  }
  console.log("[/api/journey/resume] link RPC returned", { linkedJourneyId: linked });

  // Fetch the current state (either linked one, or any existing user-owned one).
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, status, current_step, language, last_activity_at")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[/api/journey/resume] post-link journey for user", {
    userId: user.id,
    journey,
  });

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    actor_id: user.id,
    action: "journey_resumed",
    metadata: { linked_id: linked, device_id },
  });

  return NextResponse.json({ ok: true, journey });
}
