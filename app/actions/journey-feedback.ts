"use server";

/**
 * app/actions/journey-feedback.ts
 *
 * Server actions for the clinical-feedback layer (journey_feedback).
 * All actions are admin-gated. Writes go through the service-role
 * client because the table's RLS policy requires admin_author_id
 * to equal auth.uid() - which Supabase RLS evaluates against the
 * cookie session, not the service-role JWT. So we VERIFY the admin
 * via the cookie session, then write via service role with the
 * verified user id stamped onto admin_author_id.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  FEEDBACK_SEVERITIES,
  type FeedbackSeverity,
} from "@/lib/journey/feedback";

// ─── Auth helper ──────────────────────────────────────────────────────────────

/**
 * Verifies the caller is an authenticated admin and returns their id.
 * Throws strings the form layer can switch on for friendly UX.
 */
async function requireAdmin(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    throw new Error("not_admin");
  }
  return user.id;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const SeverityEnum = z.enum(
  FEEDBACK_SEVERITIES as unknown as [FeedbackSeverity, ...FeedbackSeverity[]],
);

const CreateFeedbackSchema = z
  .object({
    userId: z.string().uuid().optional().nullable(),
    coupleId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    itemId: z.string().uuid().optional().nullable(),
    questionId: z.string().min(1).max(100).optional().nullable(),
    shortSummary: z.string().min(1).max(500),
    extendedText: z.string().max(10_000).optional().nullable(),
    severity: SeverityEnum.default("observation"),
  })
  .refine(
    (v) => !!v.userId || !!v.coupleId,
    { message: "subject_required", path: ["userId"] },
  );

const UpdateFeedbackSchema = z.object({
  id: z.string().uuid(),
  shortSummary: z.string().min(1).max(500).optional(),
  extendedText: z.string().max(10_000).optional().nullable(),
  severity: SeverityEnum.optional(),
  categoryId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  questionId: z.string().min(1).max(100).optional().nullable(),
});

const DeleteFeedbackSchema = z.object({
  id: z.string().uuid(),
});

// ─── Public action types (return shapes) ──────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── createFeedback ───────────────────────────────────────────────────────────

export async function createFeedback(
  raw: z.input<typeof CreateFeedbackSchema>,
): Promise<ActionResult<{ id: string }>> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parse = CreateFeedbackSchema.safeParse(raw);
  if (!parse.success) {
    return {
      ok: false,
      error: parse.error.issues[0]?.message ?? "validation_failed",
    };
  }
  const v = parse.data;

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  const { data, error } = await admin
    .from("journey_feedback")
    .insert({
      user_id: v.userId ?? null,
      couple_id: v.coupleId ?? null,
      category_id: v.categoryId ?? null,
      item_id: v.itemId ?? null,
      question_id: v.questionId ?? null,
      short_summary: v.shortSummary.trim(),
      extended_text: v.extendedText ? v.extendedText.trim() : null,
      severity: v.severity,
      admin_author_id: adminId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Re-render the most likely consumers - list page + couple workspace.
  revalidatePath("/dashboard/journey/feedback");
  if (v.coupleId) revalidatePath(`/dashboard/my-clients/${v.coupleId}`);
  if (v.userId) revalidatePath(`/dashboard/users/${v.userId}`);

  return { ok: true, data: { id: data.id } };
}

// ─── updateFeedback ───────────────────────────────────────────────────────────

export async function updateFeedback(
  raw: z.input<typeof UpdateFeedbackSchema>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parse = UpdateFeedbackSchema.safeParse(raw);
  if (!parse.success) {
    return {
      ok: false,
      error: parse.error.issues[0]?.message ?? "validation_failed",
    };
  }
  const v = parse.data;

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  // Build a partial update - only fields the caller actually passed.
  const patch: Record<string, unknown> = {};
  if (v.shortSummary !== undefined) patch.short_summary = v.shortSummary.trim();
  if (v.extendedText !== undefined)
    patch.extended_text = v.extendedText ? v.extendedText.trim() : null;
  if (v.severity !== undefined) patch.severity = v.severity;
  if (v.categoryId !== undefined) patch.category_id = v.categoryId;
  if (v.itemId !== undefined) patch.item_id = v.itemId;
  if (v.questionId !== undefined) patch.question_id = v.questionId;

  if (Object.keys(patch).length === 0) {
    // Nothing to update - treat as success (UI calls onClose anyway)
    return { ok: true };
  }

  // We need couple_id / user_id to revalidate the right pages - pull
  // them in the same round trip as the update.
  const { data: row, error } = await admin
    .from("journey_feedback")
    .update(patch)
    .eq("id", v.id)
    .select("user_id, couple_id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/journey/feedback");
  if (row.couple_id) revalidatePath(`/dashboard/my-clients/${row.couple_id}`);
  if (row.user_id) revalidatePath(`/dashboard/users/${row.user_id}`);

  return { ok: true };
}

// ─── deleteFeedback ───────────────────────────────────────────────────────────

export async function deleteFeedback(
  raw: z.input<typeof DeleteFeedbackSchema>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parse = DeleteFeedbackSchema.safeParse(raw);
  if (!parse.success) return { ok: false, error: "validation_failed" };

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  // Pull subject ids first so we can revalidate after the delete.
  const { data: row } = await admin
    .from("journey_feedback")
    .select("user_id, couple_id")
    .eq("id", parse.data.id)
    .maybeSingle();

  const { error } = await admin
    .from("journey_feedback")
    .delete()
    .eq("id", parse.data.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/journey/feedback");
  if (row?.couple_id)
    revalidatePath(`/dashboard/my-clients/${row.couple_id}`);
  if (row?.user_id) revalidatePath(`/dashboard/users/${row.user_id}`);

  return { ok: true };
}
