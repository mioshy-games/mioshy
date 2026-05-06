"use server";

// ============================================================
// Expert push v2 - slice 8 admin action.
//
// Pushes a batch of items to a recipient (user / couple / group).
// Fans out to journey_pending_pushes, ONE row per (target user × item).
// The cadence engine consumes the oldest pending row on each user's
// next delivery slot - pushes don't deliver instantly, they ride the
// next slot per Itzik's slice 8 brief.
//
// Recipients:
//   user   → 1 target (the user themselves)
//   couple → 2 targets (both partners via couple_members)
//   group  → N targets (all journey_group_members.user_id)
//
// Idempotency: not enforced at the table level - the same item can
// be pushed twice with two pending rows. The cadence engine's
// delivered-items dedup catches it on consumption (the second row
// becomes a no-op once the first one materializes), so admin can
// re-push freely without breaking invariants.
// ============================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  pushPayloadSchema,
  type PushPayload,
} from "@/lib/journey-content/validations";

type Result =
  | { ok: true; targetCount: number; rowsCreated: number }
  | { ok: false; error: string };

async function adminDb() {
  const session = await requireAdmin();
  return { db: await createAdminClient(), adminUserId: session.user.id };
}

type AdminDbClient = Awaited<ReturnType<typeof adminDb>>["db"];

async function resolveTargetUserIds(
  supabase: AdminDbClient,
  recipient: PushPayload["recipient"],
): Promise<{ ok: true; userIds: string[] } | { ok: false; error: string }> {
  if (recipient.kind === "user") {
    return { ok: true, userIds: [recipient.id] };
  }
  if (recipient.kind === "couple") {
    const { data, error } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", recipient.id);
    if (error) return { ok: false, error: error.message };
    const ids = ((data ?? []) as Array<{ user_id: string }>).map(
      (r) => r.user_id,
    );
    if (ids.length === 0) {
      return { ok: false, error: "couple has no members" };
    }
    return { ok: true, userIds: ids };
  }
  // group
  const { data, error } = await supabase
    .from("journey_group_members")
    .select("user_id, journey_groups!inner(is_active)")
    .eq("group_id", recipient.id)
    .eq("journey_groups.is_active", true);
  if (error) return { ok: false, error: error.message };
  const ids = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (ids.length === 0) {
    return { ok: false, error: "group has no members or is inactive" };
  }
  return { ok: true, userIds: ids };
}

export async function pushItemsToRecipient(raw: unknown): Promise<Result> {
  const parsed = pushPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "invalid payload";
    return { ok: false, error: firstIssue };
  }
  const v = parsed.data;
  const { db: supabase, adminUserId } = await adminDb();

  // Validate every item exists + is active. Bail before any insert
  // if any id is bogus - better than half-created push rows.
  const { data: itemsRows, error: itemsErr } = await supabase
    .from("journey_items")
    .select("id, is_active")
    .in("id", v.itemIds);
  if (itemsErr) return { ok: false, error: itemsErr.message };
  const found = (itemsRows ?? []) as Array<{ id: string; is_active: boolean }>;
  if (found.length !== v.itemIds.length) {
    return { ok: false, error: "one or more items do not exist" };
  }
  const inactive = found.filter((r) => !r.is_active);
  if (inactive.length > 0) {
    return {
      ok: false,
      error: `cannot push inactive items: ${inactive.map((r) => r.id).join(", ")}`,
    };
  }

  const targets = await resolveTargetUserIds(supabase, v.recipient);
  if (!targets.ok) return targets;

  // Group fan-out: capture group_id when applicable so the cadence
  // engine can later show "from your coach (via group X)" if we ever
  // need that telemetry.
  const groupId = v.recipient.kind === "group" ? v.recipient.id : null;
  const reason = v.reasonNote.trim().length > 0 ? v.reasonNote.trim() : null;

  // Build the cross-product (targets × items).
  const rows = targets.userIds.flatMap((uid) =>
    v.itemIds.map((itemId) => ({
      recipient_user_id: uid,
      item_id: itemId,
      pushed_by: adminUserId,
      reason_note: reason,
      group_id: groupId,
    })),
  );

  const { error: insErr } = await supabase
    .from("journey_pending_pushes")
    .insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/dashboard/journey/push", "page");
  revalidatePath("/dashboard/journey", "layout");
  return {
    ok: true,
    targetCount: targets.userIds.length,
    rowsCreated: rows.length,
  };
}

// ------------------------------------------------------------
// Recipient pickers - typeahead used by the push composer.
// ------------------------------------------------------------

export interface CouplePickerHit {
  couple_id: string;
  display_name: string | null;
  pair_code: string | null;
  member_emails: string[];
}

export async function searchCouples(query: string): Promise<CouplePickerHit[]> {
  await requireAdmin();
  const supabase = await createAdminClient();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const term = `%${trimmed}%`;

  // Match by display_name or pair_code OR by any member's email.
  const [byCouple, byEmail] = await Promise.all([
    supabase
      .from("couples")
      .select("id, display_name, pair_code")
      .or(`display_name.ilike.${term},pair_code.ilike.${term}`)
      .limit(25),
    supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .ilike("email", term)
      .limit(50),
  ]);

  const coupleIds = new Set<string>();
  for (const c of (byCouple.data ?? []) as Array<{ id: string }>) {
    coupleIds.add(c.id);
  }

  // Map matched users → their couple (if any) and add those couples.
  const matchedUserIds = ((byEmail.data ?? []) as Array<{ user_id: string }>).map(
    (r) => r.user_id,
  );
  if (matchedUserIds.length > 0) {
    const { data: members } = await supabase
      .from("couple_members")
      .select("couple_id")
      .in("user_id", matchedUserIds);
    for (const m of (members ?? []) as Array<{ couple_id: string }>) {
      coupleIds.add(m.couple_id);
    }
  }
  if (coupleIds.size === 0) return [];

  const ids = Array.from(coupleIds);
  const [coupleRows, memberRows] = await Promise.all([
    supabase
      .from("couples")
      .select("id, display_name, pair_code")
      .in("id", ids),
    supabase.from("couple_members").select("couple_id, user_id").in("couple_id", ids),
  ]);
  const couples = (coupleRows.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    pair_code: string | null;
  }>;
  const memberByCouple = new Map<string, string[]>();
  for (const m of (memberRows.data ?? []) as Array<{
    couple_id: string;
    user_id: string;
  }>) {
    const list = memberByCouple.get(m.couple_id) ?? [];
    list.push(m.user_id);
    memberByCouple.set(m.couple_id, list);
  }

  const allMemberIds = Array.from(
    new Set(Array.from(memberByCouple.values()).flat()),
  );
  const emailById = new Map<string, string | null>();
  if (allMemberIds.length > 0) {
    const { data: emailRows } = await supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", allMemberIds);
    for (const r of (emailRows ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      emailById.set(r.user_id, r.email);
    }
  }

  return couples
    .map<CouplePickerHit>((c) => ({
      couple_id: c.id,
      display_name: c.display_name,
      pair_code: c.pair_code,
      member_emails: (memberByCouple.get(c.id) ?? [])
        .map((uid) => emailById.get(uid) ?? null)
        .filter((e): e is string => !!e),
    }))
    .slice(0, 25);
}

export interface GroupPickerHit {
  group_id: string;
  label_he: string;
  label_en: string | null;
  member_count: number;
  is_active: boolean;
}

/** Lists ALL active groups (cohort count is small). The push composer
 *  filters client-side. */
export async function listGroupsForPush(): Promise<GroupPickerHit[]> {
  await requireAdmin();
  const supabase = await createAdminClient();
  const [groupsRes, memberRes] = await Promise.all([
    supabase
      .from("journey_groups")
      .select("id, label_he, label_en, is_active")
      .eq("is_active", true)
      .order("label_he", { ascending: true }),
    supabase.from("journey_group_members").select("group_id"),
  ]);
  const counts = new Map<string, number>();
  for (const m of (memberRes.data ?? []) as Array<{ group_id: string }>) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }
  return ((groupsRes.data ?? []) as Array<{
    id: string;
    label_he: string;
    label_en: string | null;
    is_active: boolean;
  }>).map((g) => ({
    group_id: g.id,
    label_he: g.label_he,
    label_en: g.label_en,
    member_count: counts.get(g.id) ?? 0,
    is_active: g.is_active,
  }));
}
