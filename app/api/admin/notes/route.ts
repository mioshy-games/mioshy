/**
 * POST /api/admin/notes   - add a coach note for a user
 * Body: { user_id, body, is_pinned? }
 *
 * PATCH /api/admin/notes  - toggle pin or edit body
 * Body: { id, is_pinned?, body? }
 *
 * DELETE /api/admin/notes?id=...   - remove a note
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: admin } = session;

  const { user_id, body, is_pinned } = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    body?: string;
    is_pinned?: boolean;
  };
  if (!user_id || !body?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_notes")
    .insert({ user_id, body: body.trim(), is_pinned: !!is_pinned, author_id: admin.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activity_logs").insert({
    user_id,
    actor_id: admin.id,
    action: "note_added",
    metadata: { note_id: data.id, is_pinned: !!is_pinned },
  });

  return NextResponse.json({ note: data });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const { id, is_pinned, body } = (await req.json().catch(() => ({}))) as {
    id?: string;
    is_pinned?: boolean;
    body?: string;
  };
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (is_pinned !== undefined) patch.is_pinned = is_pinned;
  if (body !== undefined) patch.body = body.trim();
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_notes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase.from("user_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
