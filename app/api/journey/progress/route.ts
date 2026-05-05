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

  // Pull all prior responses for this journey so the client can pre-fill
  // answers when the user navigates back. UX feedback 2026-05-05:
  // "כשחוזרים אחורה צריך לראות את מה שנבחר מקודם". Without this, the
  // user re-arrives at a previously-answered question with empty state
  // even though their answer is already in the DB.
  //
  // Shape returned: `{ [question_id]: AnswerValue }` — easy for the
  // client to look up by question id. We don't return locale here because
  // the client knows the page locale and would just discard it.
  const responses: Record<string, unknown> = {};
  if (journey?.id) {
    const { data: rows } = await supabase
      .from("journey_responses")
      .select("question_id, answer")
      .eq("journey_id", journey.id);
    if (rows) {
      for (const row of rows) {
        responses[row.question_id as string] = row.answer;
      }
    }
  }

  return NextResponse.json({
    total: totalQuestions(),
    gating: QUESTIONNAIRE.gating,
    journey: journey ?? null,
    subscriptionActive,
    responses,
  });
}
