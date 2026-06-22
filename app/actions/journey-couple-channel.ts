"use server";

/**
 * app/actions/journey-couple-channel.ts
 *
 * Layer-5 actions for the shared couple channel.
 *
 * Two entry points:
 *   - postPartnerCoupleMessage(coupleId, body)  — the user posts
 *     to their own couple channel. Author = partner.
 *   - postCoachCoupleMessage(coupleId, body, libraryId?) — coach
 *     posts to a couple they're assigned to. Author = expert,
 *     expert_signed_by = caller.
 *
 * Both bump journey_couple_channels.last_message_at and revalidate
 * the relevant routes.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCoupleChannel } from "@/lib/journey-content/couple-channel";
import { classifyAndStampMessage } from "@/lib/ai/classify-message";
import { sendWhatsAppMessage } from "@/lib/whatsapp/notifications";
import { coachNudgeTemplate } from "@/lib/whatsapp/templates";

const partnerSchema = z.object({
  coupleId: z.string().uuid(),
  body:     z.string().trim().min(1, "empty").max(4000),
});

const coachSchema = partnerSchema.extend({
  libraryId: z.string().uuid().optional().nullable(),
  // Delivery channel. Default email = zero regression vs the existing flow.
  // WhatsApp is admin-only (enforced below) and additive.
  channel:   z.enum(["email", "whatsapp", "both"]).optional().default("email"),
});

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * Partner posts to their own couple channel. RLS verifies the
 * caller is a couple_member; we use the session client (not admin)
 * so the policy fires.
 */
export async function postPartnerCoupleMessage(
  raw: unknown,
): Promise<Result<{ messageId: string }>> {
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  await ensureCoupleChannel(parsed.data.coupleId);

  const { data, error } = await supabase
    .from("journey_couple_channel_messages")
    .insert({
      couple_id:      parsed.data.coupleId,
      author_user_id: auth.user.id,
      author_kind:    "partner",
      body:           parsed.data.body.trim(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[postPartnerCoupleMessage]", error);
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  // Bump last_message_at on the channel.
  const admin = await createAdminClient();
  await admin
    .from("journey_couple_channels")
    .update({ last_message_at: new Date().toISOString() })
    .eq("couple_id", parsed.data.coupleId);

  // Phase 4 — fire-and-forget AI classification on the partner post.
  void classifyAndStampMessage({
    table: "journey_couple_channel_messages",
    messageId: (data as { id: string }).id,
    body: parsed.data.body.trim(),
  });

  revalidatePath("/[locale]/my/journey/together", "layout");
  revalidatePath(`/dashboard/my-clients/${parsed.data.coupleId}`, "layout");

  return { ok: true, data: { messageId: (data as { id: string }).id } };
}

/**
 * Coach posts a couple-addressed message. Verifies expert link via
 * is_expert_for_couple — RLS would also enforce, but we check
 * explicitly so we can return a meaningful error.
 */
export async function postCoachCoupleMessage(
  raw: unknown,
): Promise<Result<{ messageId: string }>> {
  const parsed = coachSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  const admin = await createAdminClient();

  // Profile role check.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile as { role: string } | null)?.role;
  if (role !== "expert" && role !== "admin") {
    return { ok: false, error: "not_authorized" };
  }

  // Expert-couple link (admins skip).
  if (role === "expert") {
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("couple_id", parsed.data.coupleId)
      .eq("expert_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { ok: false, error: "not_assigned" };
  }

  await ensureCoupleChannel(parsed.data.coupleId);

  // Layer-3 admin tracker — when this message came from a library
  // row, copy its tags onto the message for admin filtering/aggregation.
  let topicTags: string[] = [];
  if (parsed.data.libraryId) {
    const { data: libRow } = await admin
      .from("journey_expert_library")
      .select("tags")
      .eq("id", parsed.data.libraryId)
      .maybeSingle();
    const tags = (libRow as { tags: string[] | null } | null)?.tags;
    if (Array.isArray(tags)) topicTags = tags;
  }

  const { data, error } = await admin
    .from("journey_couple_channel_messages")
    .insert({
      couple_id:        parsed.data.coupleId,
      author_user_id:   auth.user.id,
      author_kind:      "expert",
      expert_signed_by: auth.user.id,
      body:             parsed.data.body.trim(),
      topic_tags:       topicTags,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[postCoachCoupleMessage]", error);
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  await admin
    .from("journey_couple_channels")
    .update({ last_message_at: new Date().toISOString() })
    .eq("couple_id", parsed.data.coupleId);

  // WhatsApp delivery (additive, admin-only). Best-effort — never blocks or
  // fails the action; the message is already saved to the channel above and
  // the email path is unaffected. Each partner is sent free text if their 24h
  // window is open, else the coach_nudge template (handled in the WA layer).
  if (
    role === "admin" &&
    (parsed.data.channel === "whatsapp" || parsed.data.channel === "both")
  ) {
    try {
      await sendCoupleWhatsApp(admin, {
        coupleId: parsed.data.coupleId,
        body: parsed.data.body.trim(),
        adminId: auth.user.id,
      });
    } catch (err) {
      console.warn("[postCoachCoupleMessage] whatsapp send failed (non-fatal)", err);
    }
  }

  // Bump library use_count if the message came from a saved snippet.
  if (parsed.data.libraryId) {
    try {
      const { recordCoachLibraryUse } = await import(
        "@/app/dashboard/actions/coach-library"
      );
      await recordCoachLibraryUse(parsed.data.libraryId);
    } catch (err) {
      console.warn("[postCoachCoupleMessage] library bump failed (non-fatal)", err);
    }
  }

  revalidatePath("/[locale]/my/journey/together", "layout");
  revalidatePath(`/dashboard/my-clients/${parsed.data.coupleId}`, "layout");

  return { ok: true, data: { messageId: (data as { id: string }).id } };
}

/**
 * Fan a couple-addressed message out to each partner over WhatsApp and record
 * a unified-history row in sent_messages. The WA layer (sendWhatsAppMessage)
 * resolves opt-in / phone / 24h window per partner and picks free text vs the
 * coach_nudge template, logging each attempt to whatsapp_messages. Partners who
 * aren't reachable (no opt-in / no phone) are simply skipped — they still got
 * the in-app message + email. Best-effort throughout.
 */
async function sendCoupleWhatsApp(
  admin: SupabaseClient,
  args: { coupleId: string; body: string; adminId: string },
): Promise<void> {
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", args.coupleId);
  const ids = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  if (ids.length === 0) return;

  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name, mobile")
    .in("id", ids);

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/$/, "");
  const conversationUrl = `${base}/he/my/journey/together`;

  for (const p of (profs ?? []) as Array<{
    id: string;
    full_name: string | null;
    mobile: string | null;
  }>) {
    const name = p.full_name?.trim() || "";
    const outcome = await sendWhatsAppMessage({
      userId: p.id,
      freeText: args.body,
      template: coachNudgeTemplate({ name, conversationUrl }),
    });

    // Record history only when we actually attempted a send (success, or a
    // real send failure). Eligibility fallbacks (no opt-in / no phone) aren't
    // failures — those partners are reachable by email only.
    const attempted = outcome.sent || outcome.reason?.startsWith("send-failed");
    if (!attempted) continue;

    await admin
      .from("sent_messages")
      .insert({
        user_id: p.id,
        channel: "whatsapp",
        body: args.body,
        to_address: p.mobile ?? "",
        sent_by: "admin",
        sent_by_admin: args.adminId,
        provider_id: outcome.waMessageId ?? null,
        status: outcome.sent ? "sent" : "failed",
      })
      .then(() => undefined, () => undefined);
  }
}
