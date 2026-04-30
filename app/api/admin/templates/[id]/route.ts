/**
 * PATCH  /api/admin/templates/[id]  - update a template
 * DELETE /api/admin/templates/[id]  - delete (hard)
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const patch = await req.json().catch(() => ({}));
  const allowed = [
    "channel",
    "subject_he",
    "subject_en",
    "body_he",
    "body_en",
    "variables",
    "trigger_axis",
    "is_active",
  ];
  const cleaned: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) cleaned[k] = patch[k];
  }
  cleaned.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("message_templates")
    .update(cleaned)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const { error } = await supabase.from("message_templates").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
