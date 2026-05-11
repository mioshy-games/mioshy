"use server";

/**
 * app/dashboard/actions/coach-library.ts
 *
 * Layer-2 server actions for the coach's personal saved-snippets
 * library. Three kinds:
 *   - 'saved_reply'   — reusable expert reply text
 *   - 'content_pin'   — pinned content item the coach often pushes
 *   - 'couple_note'   — markdown note tied to a specific couple
 *
 * RLS already enforces "owner only" on journey_expert_library, but
 * we re-verify the actor here so service-role writes also stay
 * scoped correctly.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient } from "@/lib/supabase-admin";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const KIND = ["saved_reply", "content_pin", "couple_note"] as const;

const upsertSchema = z.object({
  id:        z.string().uuid().optional().nullable(),
  kind:      z.enum(KIND),
  label:     z.string().trim().min(1, "label_required").max(120),
  body_he:   z.string().trim().min(1, "body_he_required").max(4000),
  body_en:   z.string().trim().max(4000).optional().nullable(),
  tags:      z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  couple_id: z.string().uuid().optional().nullable(),
});

export async function saveCoachLibraryEntry(
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const session = await requireExpert();
  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }

  const v = parsed.data;
  const admin = await createAdminClient();

  if (v.id) {
    const { data, error } = await admin
      .from("journey_expert_library")
      .update({
        kind:      v.kind,
        label:     v.label,
        body_he:   v.body_he,
        body_en:   v.body_en?.trim() || null,
        tags:      v.tags,
        couple_id: v.kind === "couple_note" ? v.couple_id ?? null : null,
      })
      .eq("id", v.id)
      .eq("expert_id", session.user.id)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/coach-library");
    return { ok: true, data: { id: (data as { id: string }).id } };
  }

  const { data, error } = await admin
    .from("journey_expert_library")
    .insert({
      expert_id: session.user.id,
      kind:      v.kind,
      label:     v.label,
      body_he:   v.body_he,
      body_en:   v.body_en?.trim() || null,
      tags:      v.tags,
      couple_id: v.kind === "couple_note" ? v.couple_id ?? null : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/coach-library");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deleteCoachLibraryEntry(id: string): Promise<Result> {
  if (!id) return { ok: false, error: "missing_id" };
  const session = await requireExpert();
  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_expert_library")
    .delete()
    .eq("id", id)
    .eq("expert_id", session.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/coach-library");
  return { ok: true };
}

/**
 * Bump use_count + last_used_at for a saved-reply row. Called from
 * the /library popover in compose boxes when the coach actually
 * inserts a reply.
 */
export async function recordCoachLibraryUse(id: string): Promise<Result> {
  if (!id) return { ok: false, error: "missing_id" };
  const session = await requireExpert();
  const admin = await createAdminClient();

  // Read-modify-write since Postgres + Supabase doesn't expose a
  // simple atomic increment in the JS client without rpc(). One
  // round trip per insert is acceptable — this is a low-volume path.
  const { data: row } = await admin
    .from("journey_expert_library")
    .select("use_count")
    .eq("id", id)
    .eq("expert_id", session.user.id)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };

  const next = ((row as { use_count: number }).use_count ?? 0) + 1;
  await admin
    .from("journey_expert_library")
    .update({
      use_count:    next,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("expert_id", session.user.id);

  return { ok: true };
}
