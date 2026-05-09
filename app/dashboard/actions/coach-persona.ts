"use server";

/**
 * app/dashboard/actions/coach-persona.ts
 *
 * Layer-2 action: a coach edits their own client-facing persona.
 *
 * The persona is stored on profiles.coach_* columns (migration 069)
 * and is the data source for every "your coach Yael" surface — first
 * session, message attribution, bio reveal, etc.
 *
 * Self-gated: only the row's own owner (or admin) can write.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  // Hebrew display name is the canonical one — every fallback path
  // resolves to it. English may be empty (system shows HE in EN as
  // fallback if EN is missing).
  display_name_he: z.string().trim().min(1, "display_name_he_required").max(60),
  display_name_en: z.string().trim().max(60).optional().nullable(),
  avatar_url:      z.string().trim().max(800).optional().nullable(),
  short_bio_he:    z.string().trim().max(280).optional().nullable(),
  short_bio_en:    z.string().trim().max(280).optional().nullable(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function updateCoachPersona(raw: unknown): Promise<Result> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  // Verify the caller is an expert or admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = (profile as { role: string } | null)?.role;
  if (role !== "expert" && role !== "admin") {
    return { ok: false, error: "not_authorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      coach_display_name_he: parsed.data.display_name_he.trim(),
      coach_display_name_en: parsed.data.display_name_en?.trim() || null,
      coach_avatar_url:      parsed.data.avatar_url?.trim() || null,
      coach_short_bio_he:    parsed.data.short_bio_he?.trim() || null,
      coach_short_bio_en:    parsed.data.short_bio_en?.trim() || null,
    })
    .eq("id", auth.user.id);

  if (error) {
    console.error("[updateCoachPersona] update failed", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/coach-profile");
  // Coaches' personas surface across user-facing pages — bust caches
  // so the next message renders the new persona immediately.
  revalidatePath("/[locale]/journey/timeline/[scheduledId]", "page");
  revalidatePath("/[locale]/my/journey", "layout");
  return { ok: true };
}
