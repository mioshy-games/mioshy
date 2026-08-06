/**
 * GET /api/engagement/tick
 *
 * Cron endpoint. Reads up to N pending schedules whose `scheduled_for` is due,
 * verifies the user's subscription is still active, renders the template,
 * sends via provider, and records into `sent_messages` + updates schedule.
 *
 * Call from vercel.json cron or an external scheduler every 5 minutes.
 * Protected via ENGAGEMENT_CRON_SECRET header so public traffic can't trigger it.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  renderTemplate,
  sendViaProvider,
  shouldSendForSubscription,
  varsFromAnalysis,
} from "@/lib/journey/engagement";
import type { Analysis, Locale } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 50;

export async function GET(req: Request) {
  // Auth: shared-secret header.
  const authHeader = req.headers.get("x-engagement-secret");
  if (!process.env.ENGAGEMENT_CRON_SECRET || authHeader !== process.env.ENGAGEMENT_CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // We need service-role-ish power here. For now reuse server client with
  // admin policies - the endpoint is protected by shared secret. In
  // production, swap to `createSupabaseAdminClient` with the service role key.
  const supabase = await createServerSupabaseClient();
  const overviewDb = await createAdminClient();

  const nowIso = new Date().toISOString();
  const { data: due, error: fetchErr } = await supabase
    .from("engagement_schedules")
    .select(
      "id, user_id, template_id, scheduled_for, reason",
    )
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ ok: true, processed: 0 });

  const results: Array<{ schedule_id: string; status: string; error?: string }> = [];

  for (const row of due) {
    try {
      // Check subscription status fresh each send.
      const [{ data: sub }, { data: analysis }, { data: template }, { data: overview }] = await Promise.all([
        supabase.from("subscriptions").select("status").eq("user_id", row.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase
          .from("journey_analysis")
          .select("*")
          .eq("user_id", row.user_id)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("message_templates")
          .select("channel, subject_he, subject_en, body_he, body_en")
          .eq("id", row.template_id)
          .maybeSingle(),
        // admin_users_overview is service-role-only as of migration 199 (it
        // joins auth.users and bypasses RLS). This route is gated by
        // ENGAGEMENT_CRON_SECRET and runs without a user session, so it must
        // read the view with the service-role client.
        // Audit 2026-08-05, CRITICAL #2.
        overviewDb
          .from("admin_users_overview")
          .select("email, primary_love_language")
          .eq("user_id", row.user_id)
          .maybeSingle(),
      ]);

      if (!template) {
        await supabase
          .from("engagement_schedules")
          .update({ status: "failed", error: "template_missing" })
          .eq("id", row.id);
        results.push({ schedule_id: row.id, status: "failed", error: "template_missing" });
        continue;
      }

      if (!shouldSendForSubscription(sub?.status ?? null)) {
        await supabase
          .from("engagement_schedules")
          .update({ status: "skipped", error: "subscription_inactive" })
          .eq("id", row.id);
        results.push({ schedule_id: row.id, status: "skipped" });
        continue;
      }

      const locale: Locale = "he"; // TODO: per-user language preference
      const vars = analysis
        ? varsFromAnalysis(analysis as Analysis, overview?.email?.split("@")[0] ?? "", locale)
        : null;

      const subject = vars
        ? renderTemplate(locale === "he" ? template.subject_he ?? "" : template.subject_en ?? "", vars as unknown as Record<string, string | number | null | undefined>)
        : (locale === "he" ? template.subject_he ?? "" : template.subject_en ?? "");

      const body = vars
        ? renderTemplate(locale === "he" ? template.body_he : template.body_en, vars as unknown as Record<string, string | number | null | undefined>)
        : (locale === "he" ? template.body_he : template.body_en);

      const sendRes = await sendViaProvider({
        to: overview?.email ?? "",
        subject,
        body,
        channel: template.channel as "email" | "sms" | "whatsapp",
        locale,
      });

      await supabase.from("sent_messages").insert({
        user_id: row.user_id,
        template_id: row.template_id,
        schedule_id: row.id,
        channel: template.channel,
        subject,
        body,
        to_address: overview?.email ?? "",
        sent_by: "system",
        provider_id: sendRes.providerId ?? null,
        status: sendRes.success ? "sent" : "failed",
      });

      await supabase
        .from("engagement_schedules")
        .update({
          status: sendRes.success ? "sent" : "failed",
          sent_at: sendRes.success ? new Date().toISOString() : null,
          error: sendRes.error ?? null,
        })
        .eq("id", row.id);

      await supabase.from("activity_logs").insert({
        user_id: row.user_id,
        actor_id: null,
        action: sendRes.success ? "message_sent" : "message_failed",
        metadata: { schedule_id: row.id, reason: row.reason, channel: template.channel },
      });

      results.push({ schedule_id: row.id, status: sendRes.success ? "sent" : "failed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      await supabase
        .from("engagement_schedules")
        .update({ status: "failed", error: message })
        .eq("id", row.id);
      results.push({ schedule_id: row.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, results });
}
