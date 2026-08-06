/**
 * POST /api/admin/messages/send
 *
 * Admin-triggered manual send. Uses a template (+optional override body)
 * and records the send into `sent_messages` + activity_logs.
 *
 * Body: {
 *   user_id: string,
 *   template_id?: string,
 *   channel: "email"|"sms"|"whatsapp",
 *   subject?: string,
 *   body?: string,     // overrides template
 *   to_address?: string // overrides user's default contact
 * }
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  renderTemplate,
  sendViaProvider,
  varsFromAnalysis,
} from "@/lib/journey/engagement";
import type { Analysis, Locale } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: admin } = session;

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    template_id?: string;
    channel?: "email" | "sms" | "whatsapp";
    subject?: string;
    body?: string;
    to_address?: string;
  };

  if (!body.user_id || !body.channel) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Load recipient + analysis for variable rendering.
  // admin_users_overview is service-role-only as of migration 199 (it joins
  // auth.users and bypasses RLS); getAdminSession() above is the auth gate.
  // Audit 2026-08-05, CRITICAL #2.
  const overviewDb = await createAdminClient();
  const [{ data: overview }, { data: analysis }] = await Promise.all([
    overviewDb.from("admin_users_overview").select("email, primary_love_language").eq("user_id", body.user_id).maybeSingle(),
    supabase
      .from("journey_analysis")
      .select("*")
      .eq("user_id", body.user_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!overview) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // Resolve subject + body
  let subject = body.subject ?? "";
  let renderedBody = body.body ?? "";
  let template: { subject_he?: string | null; subject_en?: string | null; body_he: string; body_en: string } | null = null;
  const locale: Locale = "he"; // default to he; future: use user's stored language

  if (body.template_id) {
    const { data: tpl, error } = await supabase
      .from("message_templates")
      .select("subject_he, subject_en, body_he, body_en")
      .eq("id", body.template_id)
      .maybeSingle();
    if (error || !tpl) return NextResponse.json({ error: "template_not_found" }, { status: 404 });
    template = tpl;
  }

  const vars = analysis
    ? varsFromAnalysis(analysis as Analysis, overview.email?.split("@")[0] ?? "", locale)
    : { first_name: overview.email?.split("@")[0] ?? "", friendship_score: 0, conflict_health: 0, passion_risk: 0, primary_love_language: overview.primary_love_language ?? "", top_gap: "", language: locale as Locale };

  if (template) {
    subject = renderTemplate(locale === "he" ? template.subject_he ?? "" : template.subject_en ?? "", vars as unknown as Record<string, string | number | null | undefined>);
    renderedBody = renderTemplate(locale === "he" ? template.body_he : template.body_en, vars as unknown as Record<string, string | number | null | undefined>);
  }

  if (!renderedBody) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const toAddress = body.to_address ?? overview.email;
  if (!toAddress) return NextResponse.json({ error: "no_to_address" }, { status: 400 });

  const sendRes = await sendViaProvider({
    to: toAddress,
    subject,
    body: renderedBody,
    channel: body.channel,
    locale,
  });

  const { data: row, error: insertErr } = await supabase
    .from("sent_messages")
    .insert({
      user_id: body.user_id,
      template_id: body.template_id ?? null,
      channel: body.channel,
      subject,
      body: renderedBody,
      to_address: toAddress,
      sent_by: "admin",
      sent_by_admin: admin.id,
      provider_id: sendRes.providerId ?? null,
      status: sendRes.success ? "sent" : "failed",
    })
    .select("*")
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabase.from("activity_logs").insert({
    user_id: body.user_id,
    actor_id: admin.id,
    action: "message_sent",
    metadata: { channel: body.channel, template_id: body.template_id, success: sendRes.success, sent_message_id: row.id },
  });

  return NextResponse.json({ ok: sendRes.success, message: row, error: sendRes.error ?? null });
}
