"use server";

/**
 * Server actions for the "Mioshy Coaching" expert flow.
 *
 *   - linkExpertToCouple / unlinkExpertFromCouple - admin only. Creates a
 *     row in expert_couples so the expert can see the couple in their
 *     "My Clients" dashboard.
 *
 *   - assignContentToCouple - used by experts (or admins) on the couple
 *     detail page to push a program/category/item onto the couple's
 *     timeline. Wraps the existing createJourneyAssignment so the
 *     materialization pipeline stays a single code path.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient, createServiceRoleClient } from "@/lib/supabase-admin";
import { resolveAnchorDate } from "@/lib/journey-content/schedule";
import { materializeAssignment } from "@/lib/journey-content/materialize";
import type { JourneyAssignment } from "@/lib/journey-content/types";

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ── Admin: link an expert to a couple by email (admin-friendly form action) ─

const linkByEmailSchema = z.object({
  email: z.string().email(),
  coupleId: z.string().uuid(),
  notes: z.string().optional(),
});

export async function linkExpertToCoupleByEmail(
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = linkByEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  await requireAdmin();
  const supabase = await createAdminClient();

  // Resolve user by email
  const { data: userRow } = await supabase
    .from("admin_users_overview")
    .select("user_id, email")
    .ilike("email", parsed.data.email.trim())
    .maybeSingle();

  if (!userRow) return { ok: false, error: "no user with that email" };

  return linkExpertToCouple({
    expertId: (userRow as { user_id: string }).user_id,
    coupleId: parsed.data.coupleId,
    notes: parsed.data.notes,
  });
}

// ── Admin: link an expert to a couple ─────────────────────────────────────

const linkSchema = z.object({
  expertId: z.string().uuid(),
  coupleId: z.string().uuid(),
  notes: z.string().optional(),
});

export async function linkExpertToCouple(
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  const session = await requireAdmin();
  const supabase = await createAdminClient();

  // Check the target user actually has a profile and is admin/expert.
  // If not, promote to 'expert' so they can sign in to the dashboard.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", parsed.data.expertId)
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: "user has no profile" };
  }
  if (profile.role !== "admin" && profile.role !== "expert") {
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "expert" })
      .eq("id", parsed.data.expertId);
    if (roleErr) {
      return { ok: false, error: `role update failed: ${roleErr.message}` };
    }
  }

  const { data, error } = await supabase
    .from("expert_couples")
    .upsert(
      {
        expert_id: parsed.data.expertId,
        couple_id: parsed.data.coupleId,
        notes: parsed.data.notes?.trim() || null,
        is_active: true,
        created_by: session.user.id,
      },
      { onConflict: "expert_id,couple_id" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/experts", "layout");
  revalidatePath("/dashboard/my-clients", "layout");

  return { ok: true, data: { id: data.id as string } };
}

export async function unlinkExpertFromCouple(linkId: string): Promise<Result> {
  if (!linkId) return { ok: false, error: "missing link id" };
  await requireAdmin();
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("expert_couples")
    .update({ is_active: false })
    .eq("id", linkId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/experts", "layout");
  revalidatePath("/dashboard/my-clients", "layout");
  return { ok: true };
}

// ── Expert: assign content to one of their couples ────────────────────────

const assignSchema = z.object({
  coupleId: z.string().uuid(),
  sourceKind: z.enum(["program", "category", "item"]),
  sourceId: z.string().uuid(),
  notes: z.string().optional(),
});

export async function assignContentToCouple(
  raw: unknown,
): Promise<Result<{ assignmentId: string }>> {
  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const v = parsed.data;

  const session = await requireExpert();

  // Authorization: experts may only assign to couples they're linked to.
  // Admins bypass.
  if (!session.isAdmin) {
    const admin = createServiceRoleClient();
    if (!admin) return { ok: false, error: "service role unavailable" };
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("expert_id", session.user.id)
      .eq("couple_id", v.coupleId)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { ok: false, error: "not linked to this couple" };
  }

  // Insert the assignment + materialize the schedule. Same pipeline as
  // createJourneyAssignment but without its internal requireAdmin gate
  // (experts have already been authenticated above).
  const supabase = await createAdminClient();
  const anchorDate = resolveAnchorDate({
    anchorKind: "assignment",
    fixedAt: null,
    purchaseAt: null,
  });

  const { data, error } = await supabase
    .from("journey_assignments")
    .insert({
      user_id: null,
      couple_id: v.coupleId,
      source_kind: v.sourceKind,
      source_id: v.sourceId,
      anchor_kind: "assignment",
      anchor_date: anchorDate,
      origin: "admin_manual",
      origin_ref: null,
      notes: v.notes?.trim() || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert failed" };
  }

  await materializeAssignment({
    assignment: data as JourneyAssignment,
    supabase,
    // Coach-pushed content surfaces "your coach hand-picked this" in the
    // user's "Why this item?" disclosure (see migration 066).
    defaultRuleSlug: "expert_recommendation",
  });

  revalidatePath(`/dashboard/my-clients/${v.coupleId}`, "layout");
  revalidatePath("/dashboard/my-clients", "layout");

  return { ok: true, data: { assignmentId: (data as { id: string }).id } };
}
