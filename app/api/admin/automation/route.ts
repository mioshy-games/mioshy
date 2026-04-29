/**
 * POST /api/admin/automation
 *
 * Builds the 26-week engagement schedule for a user from their latest
 * analysis and inserts rows into `engagement_schedules`. Idempotent:
 * if schedules already exist for the user, does nothing unless `force=true`.
 *
 * Body: { user_id, force?: boolean }
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { buildSchedulePlan } from "@/lib/journey/engagement";
import type { Analysis } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: admin } = session;

  const { user_id, force } = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    force?: boolean;
  };
  if (!user_id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  // Guard: don't double-schedule.
  if (!force) {
    const { data: existing } = await supabase
      .from("engagement_schedules")
      .select("id")
      .eq("user_id", user_id)
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "already_scheduled" }, { status: 409 });
  }

  const { data: analysis } = await supabase
    .from("journey_analysis")
    .select("*")
    .eq("user_id", user_id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analysis) return NextResponse.json({ error: "no_analysis" }, { status: 404 });

  const plan = buildSchedulePlan(analysis as unknown as Analysis, new Date());

  // Map template_key → template_id via single query.
  const keys = Array.from(new Set(plan.map((p) => p.template_key)));
  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, key")
    .in("key", keys);
  const keyToId = new Map((templates ?? []).map((t) => [t.key, t.id] as const));

  const rows = plan
    .filter((p) => keyToId.has(p.template_key))
    .map((p) => ({
      user_id,
      template_id: keyToId.get(p.template_key)!,
      scheduled_for: p.scheduled_for.toISOString(),
      reason: p.reason,
    }));

  if (!rows.length) return NextResponse.json({ error: "no_templates_matched", missing_keys: keys }, { status: 400 });

  const { error } = await supabase.from("engagement_schedules").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activity_logs").insert({
    user_id,
    actor_id: admin.id,
    action: "automation_scheduled",
    metadata: { count: rows.length, forced: !!force },
  });

  return NextResponse.json({ ok: true, scheduled: rows.length });
}
