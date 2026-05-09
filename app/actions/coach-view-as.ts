"use server";

/**
 * app/actions/coach-view-as.ts
 *
 * Layer-2 coach impersonation (read-only).
 *
 * The coach taps "View as Sarah" on a couple's detail page; this
 * action verifies access, opens an audit row, and sets a cookie
 * `mioshy_view_as` carrying the audit id. The view-as helper
 * (lib/journey/view-as.ts) reads that cookie on every server render
 * and re-validates against the audit row + coach identity before
 * substituting the impersonated user_id into reads.
 *
 * Why an audit row, not just a cookie? Coaches have access to
 * sensitive data; impersonation must always be observable. Every
 * start writes a row, every end stamps `ended_at`. Admin can audit
 * any time.
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient } from "@/lib/supabase-admin";

const VIEW_AS_COOKIE = "mioshy_view_as";
const VIEW_AS_TTL_SECONDS = 60 * 60; // 1 hour

const startSchema = z.object({
  userId:   z.string().uuid(),
  coupleId: z.string().uuid().optional().nullable(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function startViewAs(raw: unknown): Promise<Result> {
  const session = await requireExpert();
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { userId, coupleId } = parsed.data;

  // Coach can only impersonate users in their assigned couples.
  // Admins can impersonate anyone (the RLS policy on the audit
  // table allows the coach_id=auth.uid() insert when a coupleId
  // is set; admin-only impersonation skips the couple check).
  const admin = await createAdminClient();
  if (!session.isAdmin) {
    if (!coupleId) return { ok: false, error: "couple_required" };
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("expert_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { ok: false, error: "not_assigned" };

    // The user must actually be in that couple.
    const { data: membership } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { ok: false, error: "user_not_in_couple" };
  }

  // Open audit row.
  const { data: row, error } = await admin
    .from("journey_view_as_audit")
    .insert({
      coach_id:       session.user.id,
      viewed_user_id: userId,
      couple_id:      coupleId ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "audit_failed" };

  const auditId = (row as { id: string }).id;
  cookies().set(VIEW_AS_COOKIE, auditId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   VIEW_AS_TTL_SECONDS,
  });

  // Bust user-facing caches so the next render picks up the
  // impersonated reads.
  revalidatePath("/[locale]/my/journey", "layout");
  revalidatePath("/[locale]/my", "layout");
  return { ok: true };
}

export async function endViewAs(): Promise<Result> {
  const session = await requireExpert();
  const auditId = cookies().get(VIEW_AS_COOKIE)?.value;
  if (auditId) {
    const admin = await createAdminClient();
    await admin
      .from("journey_view_as_audit")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", auditId)
      .eq("coach_id", session.user.id)
      .is("ended_at", null);
  }
  cookies().delete(VIEW_AS_COOKIE);
  revalidatePath("/[locale]/my/journey", "layout");
  revalidatePath("/[locale]/my", "layout");
  return { ok: true };
}
