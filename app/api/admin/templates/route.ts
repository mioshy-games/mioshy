/**
 * GET  /api/admin/templates         — list all message templates
 * POST /api/admin/templates         — create a template
 *
 * Template body supports {{variable}} placeholders rendered at send time.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("key", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase } = session;

  const body = await req.json().catch(() => ({}));
  const {
    key,
    channel,
    subject_he,
    subject_en,
    body_he,
    body_en,
    variables,
    trigger_axis,
    is_active,
  } = body ?? {};

  if (!key || !channel || !body_he || !body_en) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      key,
      channel,
      subject_he: subject_he ?? null,
      subject_en: subject_en ?? null,
      body_he,
      body_en,
      variables: variables ?? [],
      trigger_axis: trigger_axis ?? null,
      is_active: is_active ?? true,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
