"use server";

// ============================================================
// Server actions for v3 group cohorts (slice 7).
//
// Member storage rule (locked in slice 1 spec § answers): members
// are USERS only. "Add this couple" is sugar that resolves to both
// `couple_members.user_id` rows and inserts them.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  journeyGroupSchema,
  journeyGroupSubtopicBindingSchema,
  type JourneyGroupFormValues,
  type JourneyGroupSubtopicBindingInput,
} from "@/lib/journey-content/validations";

type Result<T = string> =
  | { ok: true; id: T }
  | { ok: false; error: Record<string, string[] | undefined> };

function normalizeOptional(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function adminDb() {
  await requireAdmin();
  return createAdminClient();
}

function revalidateGroups() {
  revalidatePath("/dashboard/journey/groups", "layout");
  revalidatePath("/dashboard/journey", "layout");
}

// ============================================================
// Group CRUD
// ============================================================

export async function saveJourneyGroup(
  groupId: string | null,
  raw: unknown,
): Promise<Result<string>> {
  const parsed = journeyGroupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: JourneyGroupFormValues = parsed.data;
  const supabase = await adminDb();

  const row = {
    slug: v.slug,
    label_he: v.label_he,
    label_en: normalizeOptional(v.label_en),
    description_he: normalizeOptional(v.description_he),
    description_en: normalizeOptional(v.description_en),
    is_active: v.is_active,
  };

  let savedId = groupId;
  if (groupId) {
    const { error } = await supabase
      .from("journey_groups")
      .update(row)
      .eq("id", groupId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("journey_groups")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    }
    savedId = data.id as string;
  }
  revalidateGroups();
  return { ok: true, id: savedId! };
}

export async function deleteJourneyGroup(groupId: string) {
  if (!groupId) return { ok: false as const, error: "missing groupId" };
  const supabase = await adminDb();
  // FK cascades on journey_group_members + journey_group_subtopics drop
  // dependent rows automatically (per migration 054 ON DELETE CASCADE).
  const { error } = await supabase
    .from("journey_groups")
    .delete()
    .eq("id", groupId);
  if (error) return { ok: false as const, error: error.message };
  revalidateGroups();
  return { ok: true as const };
}

export async function createAndRedirectNewGroup() {
  const supabase = await adminDb();
  const slug = `new-group-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_groups")
    .insert({
      slug,
      label_he: "קבוצה חדשה",
      label_en: "New Group",
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/groups/${data.id}`);
}

// ============================================================
// Member management
// ============================================================

export async function addGroupMember(args: {
  groupId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.groupId || !args.userId) {
    return { ok: false, error: "missing_id" };
  }
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_group_members")
    .insert({ group_id: args.groupId, user_id: args.userId });
  if (error) {
    // 23505 = already a member; treat as success so the picker can
    // be idempotent under fast double-clicks.
    if (error.code === "23505") {
      revalidateGroups();
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  revalidateGroups();
  return { ok: true };
}

export async function removeGroupMember(args: {
  groupId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.groupId || !args.userId) {
    return { ok: false, error: "missing_id" };
  }
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_group_members")
    .delete()
    .eq("group_id", args.groupId)
    .eq("user_id", args.userId);
  if (error) return { ok: false, error: error.message };
  revalidateGroups();
  return { ok: true };
}

/**
 * Couple-as-group sugar: resolves the couple to its two member
 * user_ids and inserts both. Idempotent — already-member rows
 * silently succeed. Returns the count of NEW members added.
 */
export async function addCoupleAsGroupMembers(args: {
  groupId: string;
  coupleId: string;
}): Promise<
  { ok: true; added: number } | { ok: false; error: string }
> {
  if (!args.groupId || !args.coupleId) {
    return { ok: false, error: "missing_id" };
  }
  const supabase = await adminDb();
  const { data: members, error: mErr } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", args.coupleId);
  if (mErr) return { ok: false, error: mErr.message };
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (userIds.length === 0) {
    return { ok: false, error: "couple has no members" };
  }

  let added = 0;
  for (const uid of userIds) {
    const { error } = await supabase
      .from("journey_group_members")
      .insert({ group_id: args.groupId, user_id: uid });
    if (!error) {
      added++;
    } else if (error.code !== "23505") {
      // Duplicate is fine, anything else is a real failure.
      return { ok: false, error: error.message };
    }
  }
  revalidateGroups();
  return { ok: true, added };
}

// ============================================================
// Subtopic binding management
// ============================================================

/**
 * Replace the entire set of bindings for a group with `bindings`.
 * Atomic-ish: delete-all + bulk insert. Caller passes the COMPLETE
 * desired list — anything missing from it is removed.
 */
export async function setGroupSubtopicBindings(args: {
  groupId: string;
  bindings: JourneyGroupSubtopicBindingInput[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.groupId) return { ok: false, error: "missing_id" };
  // Validate every binding upfront — bail before any DB write if shape
  // is wrong so we don't end up with a half-cleared group.
  const validated: JourneyGroupSubtopicBindingInput[] = [];
  for (const b of args.bindings ?? []) {
    const parsed = journeyGroupSubtopicBindingSchema.safeParse(b);
    if (!parsed.success) {
      return { ok: false, error: "invalid binding payload" };
    }
    validated.push(parsed.data);
  }

  const supabase = await adminDb();
  const { error: delErr } = await supabase
    .from("journey_group_subtopics")
    .delete()
    .eq("group_id", args.groupId);
  if (delErr) return { ok: false, error: delErr.message };

  if (validated.length > 0) {
    const rows = validated.map((b, idx) => ({
      group_id: args.groupId,
      subtopic_id: b.subtopic_id,
      mode: b.mode,
      sort_weight: validated.length - idx, // first row weighted highest
    }));
    const { error: insErr } = await supabase
      .from("journey_group_subtopics")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidateGroups();
  return { ok: true };
}

// ============================================================
// User search for the member picker
// ============================================================

export interface UserSearchHit {
  user_id: string;
  email: string | null;
  full_name: string | null;
  /** Couple this user is in (null = solo). The picker uses it to
   *  surface a "+add couple" affordance next to the row. */
  couple_id: string | null;
}

/**
 * Search for users to add to a group. Returns up to 25 hits matching
 * the query against email + full_name. Always admin-gated.
 */
export async function searchGroupCandidates(
  query: string,
): Promise<UserSearchHit[]> {
  await requireAdmin();
  const supabase = await createAdminClient();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const term = `%${trimmed}%`;
  // admin_users_overview holds email; profiles holds full_name. Two
  // queries, then merge by user_id. Couple_members supplies couple_id.
  const [emailHits, nameHits] = await Promise.all([
    supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .ilike("email", term)
      .limit(25),
    supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", term)
      .limit(25),
  ]);

  const userIds = new Set<string>();
  for (const r of (emailHits.data ?? []) as Array<{ user_id: string }>) {
    if (r.user_id) userIds.add(r.user_id);
  }
  for (const r of (nameHits.data ?? []) as Array<{ id: string }>) {
    if (r.id) userIds.add(r.id);
  }
  if (userIds.size === 0) return [];

  const ids = Array.from(userIds);
  const [emailMap, nameMap, coupleMap] = await Promise.all([
    supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", ids),
    supabase.from("profiles").select("id, full_name").in("id", ids),
    supabase
      .from("couple_members")
      .select("user_id, couple_id")
      .in("user_id", ids),
  ]);
  const emailById = new Map(
    ((emailMap.data ?? []) as Array<{ user_id: string; email: string | null }>).map(
      (r) => [r.user_id, r.email],
    ),
  );
  const nameById = new Map(
    ((nameMap.data ?? []) as Array<{ id: string; full_name: string | null }>).map(
      (r) => [r.id, r.full_name],
    ),
  );
  const coupleByUser = new Map(
    ((coupleMap.data ?? []) as Array<{
      user_id: string;
      couple_id: string;
    }>).map((r) => [r.user_id, r.couple_id]),
  );

  return ids
    .map<UserSearchHit>((uid) => ({
      user_id: uid,
      email: emailById.get(uid) ?? null,
      full_name: nameById.get(uid) ?? null,
      couple_id: coupleByUser.get(uid) ?? null,
    }))
    .sort((a, b) => {
      // Surface name matches before email-only matches. Within each
      // bucket, alphabetical by name then email.
      const an = (a.full_name ?? "").toLowerCase();
      const bn = (b.full_name ?? "").toLowerCase();
      if (an && !bn) return -1;
      if (bn && !an) return 1;
      const aLabel = an || (a.email ?? "");
      const bLabel = bn || (b.email ?? "");
      return aLabel.localeCompare(bLabel);
    })
    .slice(0, 25);
}
