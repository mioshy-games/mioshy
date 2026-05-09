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
import { ensureCoupleChannel } from "@/lib/journey-content/couple-channel";
import { classifyAndStampMessage } from "@/lib/ai/classify-message";

const partnerSchema = z.object({
  coupleId: z.string().uuid(),
  body:     z.string().trim().min(1, "empty").max(4000),
});

const coachSchema = partnerSchema.extend({
  libraryId: z.string().uuid().optional().nullable(),
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
