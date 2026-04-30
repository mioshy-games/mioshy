/**
 * POST /api/admin/tasks     - assign a task to a user
 * PATCH /api/admin/tasks    - update status or notes
 *
 * Body (POST): { user_id, title_he, title_en, body_he, body_en, due_at?, template_id? }
 * Body (PATCH): { id, status?, notes? }
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: admin } = session;

  const body = await req.json().catch(() => ({}));
  const { user_id, title_he, title_en, body_he, body_en, due_at, template_id } = body ?? {};
  if (!user_id || !title_he || !title_en || !body_he || !body_en) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("journey_tasks")
    .insert({
      user_id,
      title_he,
      title_en,
      body_he,
      body_en,
      due_at: due_at ?? null,
      template_id: template_id ?? null,
      assigned_by: "admin",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activity_logs").insert({
    user_id,
    actor_id: admin.id,
    action: "task_assigned",
    metadata: { task_id: data.id, template_id: template_id ?? null },
  });

  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const { id, status, notes } = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: "open" | "done" | "skipped";
    notes?: string;
  };
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (status) patch.status = status;
  if (status === "done") patch.done_at = new Date().toISOString();
  if (notes !== undefined) patch.notes = notes;

  const { data, error } = await supabase.from("journey_tasks").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
