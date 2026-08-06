/**
 * GET /api/admin/users/[id]
 *
 * Returns the full detail for a single user: profile, subscription, latest
 * journey + responses, latest analysis, open tasks, pinned notes, and last
 * 20 sent messages.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;
  // admin_users_overview is service-role-only as of migration 199 (it joins
  // auth.users and bypasses RLS). Only that read moves to the service-role
  // client; every other query below keeps its existing RLS-scoped client.
  // Audit 2026-08-05, CRITICAL #2.
  const admin = await createAdminClient();
  const userId = params.id;

  // Fire these in parallel - none depend on each other.
  const [
    overviewRes,
    journeyRes,
    analysisRes,
    tasksRes,
    notesRes,
    messagesRes,
  ] = await Promise.all([
    admin.from("admin_users_overview").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("journeys")
      .select("id, status, current_step, language, started_at, last_activity_at, completed_at")
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("journey_analysis")
      .select("*")
      .eq("user_id", userId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("journey_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_notes")
      .select("id, body, is_pinned, created_at, author_id")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("sent_messages")
      .select("id, channel, subject, to_address, sent_by, status, created_at, template_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let responses: Array<{ question_id: string; answer: unknown; locale: string; created_at: string }> = [];
  if (journeyRes.data?.id) {
    const { data: rows } = await supabase
      .from("journey_responses")
      .select("question_id, answer, locale, created_at")
      .eq("journey_id", journeyRes.data.id)
      .order("created_at", { ascending: true });
    responses = rows ?? [];
  }

  return NextResponse.json({
    overview: overviewRes.data ?? null,
    journey: journeyRes.data ?? null,
    responses,
    analysis: analysisRes.data ?? null,
    tasks: tasksRes.data ?? [],
    notes: notesRes.data ?? [],
    messages: messagesRes.data ?? [],
  });
}
