import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Query helpers for the "My Clients" expert dashboard. All run with the
 * service-role client (the dashboard already requires expert/admin auth at
 * the layout level), so we don't re-enforce RLS here.
 *
 * If `isAdmin === false`, list/detail queries are scoped to couples the
 * expert is explicitly linked to via `expert_couples`. Admins see all.
 */

export type ExpertClientSummary = {
  coupleId: string;
  displayName: string | null;
  pairCode: string | null;
  isActive: boolean;
  memberCount: number;
  members: { userId: string; email: string | null; role: string }[];
  activeAssignments: number;
  scheduledItems: number;
  completedItems: number;
  lastActivityAt: string | null;
  linkCreatedAt: string;
  linkNotes: string | null;
};

export type ExpertClientDetail = {
  coupleId: string;
  displayName: string | null;
  pairCode: string | null;
  members: { userId: string; email: string | null; role: string; joinedAt: string }[];
  expertLink: { id: string; createdAt: string; notes: string | null } | null;
  assignments: ExpertAssignmentRow[];
};

export type ExpertAssignmentRow = {
  id: string;
  /** v3 slice 4: 'cadence' is a per-partner engine container.
   *  sourceTitle for cadence rows looks like "Cadence · alice@example.com". */
  sourceKind: "program" | "category" | "item" | "cadence";
  sourceId: string;
  sourceTitle: string | null;
  /** Per-partner cadence rows carry user_id; legacy v2 rows have it null
   *  (their owner is on couple_id). Null is fine for the existing UI. */
  userId?: string | null;
  isActive: boolean;
  createdAt: string;
  anchorDate: string | null;
  scheduledTotal: number;
  scheduledCompleted: number;
};

/**
 * List all couples linked to this expert. For admins, lists every couple
 * that has at least one expert link OR at least one journey assignment
 * (so admins can spot couples without an assigned expert).
 */
export async function listExpertClients(opts: {
  expertId: string;
  isAdmin: boolean;
}): Promise<ExpertClientSummary[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  // 1. Resolve relevant couple_ids
  let coupleIds: string[];
  const linksByCouple = new Map<
    string,
    { id: string; createdAt: string; notes: string | null }
  >();

  if (opts.isAdmin) {
    const { data, error } = await admin
      .from("expert_couples")
      .select("id, couple_id, created_at, notes")
      .eq("expert_id", opts.expertId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      linksByCouple.set(row.couple_id as string, {
        id: row.id as string,
        createdAt: row.created_at as string,
        notes: (row.notes as string | null) ?? null,
      });
    }
    coupleIds = Array.from(linksByCouple.keys());
  } else {
    const { data, error } = await admin
      .from("expert_couples")
      .select("id, couple_id, created_at, notes")
      .eq("expert_id", opts.expertId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      linksByCouple.set(row.couple_id as string, {
        id: row.id as string,
        createdAt: row.created_at as string,
        notes: (row.notes as string | null) ?? null,
      });
    }
    coupleIds = Array.from(linksByCouple.keys());
  }

  if (coupleIds.length === 0) return [];

  // 2. Couple rows
  const { data: coupleRows, error: cErr } = await admin
    .from("couples")
    .select("id, display_name, pair_code, is_active")
    .in("id", coupleIds);
  if (cErr) throw new Error(cErr.message);

  // 3. Members + emails
  const { data: memberRows, error: mErr } = await admin
    .from("couple_members")
    .select("couple_id, user_id, role, joined_at")
    .in("couple_id", coupleIds);
  if (mErr) throw new Error(mErr.message);

  const userIds = Array.from(
    new Set(((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id)),
  );
  const emailByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: userRows } = await admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", userIds);
    for (const u of (userRows ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      emailByUser.set(u.user_id, u.email);
    }
  }

  // 4. Assignments — active only, for stats
  const { data: assignRows, error: aErr } = await admin
    .from("journey_assignments")
    .select("id, couple_id, is_active, created_at")
    .in("couple_id", coupleIds);
  if (aErr) throw new Error(aErr.message);

  const assignByCouple = new Map<
    string,
    { active: number; ids: string[]; lastCreated: string | null }
  >();
  for (const a of (assignRows ?? []) as Array<{
    id: string;
    couple_id: string;
    is_active: boolean;
    created_at: string;
  }>) {
    const bucket = assignByCouple.get(a.couple_id) ?? {
      active: 0,
      ids: [],
      lastCreated: null,
    };
    if (a.is_active) bucket.active += 1;
    bucket.ids.push(a.id);
    if (!bucket.lastCreated || a.created_at > bucket.lastCreated) {
      bucket.lastCreated = a.created_at;
    }
    assignByCouple.set(a.couple_id, bucket);
  }

  const allAssignmentIds = ((assignRows ?? []) as Array<{ id: string }>).map(
    (r) => r.id,
  );
  const scheduledByCouple = new Map<string, { total: number; done: number }>();
  if (allAssignmentIds.length > 0) {
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("assignment_id", allAssignmentIds);
    const schedToCouple = new Map<string, string>();
    for (const a of (assignRows ?? []) as Array<{
      id: string;
      couple_id: string;
    }>) {
      schedToCouple.set(a.id, a.couple_id);
    }
    const scheduledIds = ((schedRows ?? []) as Array<{ id: string }>).map(
      (r) => r.id,
    );
    let completedSet = new Set<string>();
    if (scheduledIds.length > 0) {
      const { data: doneRows } = await admin
        .from("journey_item_completions")
        .select("scheduled_item_id")
        .in("scheduled_item_id", scheduledIds);
      completedSet = new Set(
        ((doneRows ?? []) as Array<{ scheduled_item_id: string }>).map(
          (r) => r.scheduled_item_id,
        ),
      );
    }
    for (const s of (schedRows ?? []) as Array<{
      id: string;
      assignment_id: string;
    }>) {
      const cid = schedToCouple.get(s.assignment_id);
      if (!cid) continue;
      const bucket = scheduledByCouple.get(cid) ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (completedSet.has(s.id)) bucket.done += 1;
      scheduledByCouple.set(cid, bucket);
    }
  }

  // 5. Stitch
  const summaries: ExpertClientSummary[] = [];
  for (const cid of coupleIds) {
    const couple = (coupleRows ?? []).find((c) => (c as { id: string }).id === cid) as
      | { id: string; display_name: string | null; pair_code: string | null; is_active: boolean }
      | undefined;
    if (!couple) continue;

    const members = ((memberRows ?? []) as Array<{
      couple_id: string;
      user_id: string;
      role: string;
    }>)
      .filter((m) => m.couple_id === cid)
      .map((m) => ({
        userId: m.user_id,
        email: emailByUser.get(m.user_id) ?? null,
        role: m.role,
      }));

    const assignBucket = assignByCouple.get(cid) ?? {
      active: 0,
      ids: [],
      lastCreated: null,
    };
    const schedBucket = scheduledByCouple.get(cid) ?? { total: 0, done: 0 };
    const link = linksByCouple.get(cid);

    summaries.push({
      coupleId: cid,
      displayName: couple.display_name,
      pairCode: couple.pair_code,
      isActive: couple.is_active,
      memberCount: members.length,
      members,
      activeAssignments: assignBucket.active,
      scheduledItems: schedBucket.total,
      completedItems: schedBucket.done,
      lastActivityAt: assignBucket.lastCreated,
      linkCreatedAt: link?.createdAt ?? "",
      linkNotes: link?.notes ?? null,
    });
  }

  // Sort: most recent activity first
  summaries.sort((a, b) =>
    (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  );

  return summaries;
}

/**
 * Resolve a single couple as seen by this expert (or any admin).
 * Returns null if the expert isn't linked to this couple AND isn't admin.
 */
export async function getExpertClientDetail(opts: {
  expertId: string;
  isAdmin: boolean;
  coupleId: string;
}): Promise<ExpertClientDetail | null> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  // Authorization: admins always pass; experts must have an active link
  let link: { id: string; createdAt: string; notes: string | null } | null = null;
  {
    const { data, error } = await admin
      .from("expert_couples")
      .select("id, created_at, notes")
      .eq("expert_id", opts.expertId)
      .eq("couple_id", opts.coupleId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      link = {
        id: data.id as string,
        createdAt: data.created_at as string,
        notes: (data.notes as string | null) ?? null,
      };
    }
  }
  if (!opts.isAdmin && !link) return null;

  const { data: couple } = await admin
    .from("couples")
    .select("id, display_name, pair_code")
    .eq("id", opts.coupleId)
    .maybeSingle();
  if (!couple) return null;

  const { data: memberRows } = await admin
    .from("couple_members")
    .select("user_id, role, joined_at")
    .eq("couple_id", opts.coupleId);

  const userIds = ((memberRows ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  const emailByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: userRows } = await admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", userIds);
    for (const u of (userRows ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      emailByUser.set(u.user_id, u.email);
    }
  }

  const members = ((memberRows ?? []) as Array<{
    user_id: string;
    role: string;
    joined_at: string;
  }>).map((m) => ({
    userId: m.user_id,
    email: emailByUser.get(m.user_id) ?? null,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  // Assignments + scheduled stats. Two axes:
  //   1. Couple-scoped legacy v2 (program / category / item).
  //   2. Per-partner cadence (v3) — user-owned, never couple_id, so
  //      we fetch by user_id IN (members…) and merge.
  const [coupleAssignRes, cadenceAssignRes] = await Promise.all([
    admin
      .from("journey_assignments")
      .select(
        "id, source_kind, source_id, user_id, is_active, created_at, anchor_date",
      )
      .eq("couple_id", opts.coupleId)
      .order("created_at", { ascending: false }),
    userIds.length > 0
      ? admin
          .from("journey_assignments")
          .select(
            "id, source_kind, source_id, user_id, is_active, created_at, anchor_date",
          )
          .in("user_id", userIds)
          .eq("source_kind", "cadence")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const assignRows = [
    ...((coupleAssignRes.data ?? []) as Array<{
      id: string;
      source_kind: string;
      source_id: string;
      user_id: string | null;
      is_active: boolean;
      created_at: string;
      anchor_date: string | null;
    }>),
    ...((cadenceAssignRes.data ?? []) as Array<{
      id: string;
      source_kind: string;
      source_id: string;
      user_id: string | null;
      is_active: boolean;
      created_at: string;
      anchor_date: string | null;
    }>),
  ];

  const assignmentIds = assignRows.map((a) => a.id);

  // Resolve source titles in three lookups (program/category/item)
  const programIds = new Set<string>();
  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const a of (assignRows ?? []) as Array<{
    source_kind: string;
    source_id: string;
  }>) {
    if (a.source_kind === "program") programIds.add(a.source_id);
    else if (a.source_kind === "category") categoryIds.add(a.source_id);
    else if (a.source_kind === "item") itemIds.add(a.source_id);
  }
  const titleMap = new Map<string, string>();
  if (programIds.size > 0) {
    const { data } = await admin
      .from("journey_programs")
      .select("id, name_he, name_en")
      .in("id", Array.from(programIds));
    for (const p of (data ?? []) as Array<{
      id: string;
      name_he: string;
      name_en: string | null;
    }>) {
      titleMap.set(`program:${p.id}`, p.name_he || p.name_en || p.id);
    }
  }
  if (categoryIds.size > 0) {
    const { data } = await admin
      .from("journey_categories")
      .select("id, name_he, name_en")
      .in("id", Array.from(categoryIds));
    for (const c of (data ?? []) as Array<{
      id: string;
      name_he: string;
      name_en: string | null;
    }>) {
      titleMap.set(`category:${c.id}`, c.name_he || c.name_en || c.id);
    }
  }
  if (itemIds.size > 0) {
    const { data } = await admin
      .from("journey_items")
      .select("id, title_he, title_en")
      .in("id", Array.from(itemIds));
    for (const i of (data ?? []) as Array<{
      id: string;
      title_he: string;
      title_en: string | null;
    }>) {
      titleMap.set(`item:${i.id}`, i.title_he || i.title_en || i.id);
    }
  }

  // Scheduled / completed counts
  const schedByAssignment = new Map<string, { total: number; done: number }>();
  if (assignmentIds.length > 0) {
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("assignment_id", assignmentIds);
    const scheduledIds = ((schedRows ?? []) as Array<{ id: string }>).map(
      (r) => r.id,
    );
    let completedSet = new Set<string>();
    if (scheduledIds.length > 0) {
      const { data: doneRows } = await admin
        .from("journey_item_completions")
        .select("scheduled_item_id")
        .in("scheduled_item_id", scheduledIds);
      completedSet = new Set(
        ((doneRows ?? []) as Array<{ scheduled_item_id: string }>).map(
          (r) => r.scheduled_item_id,
        ),
      );
    }
    for (const s of (schedRows ?? []) as Array<{
      id: string;
      assignment_id: string;
    }>) {
      const bucket = schedByAssignment.get(s.assignment_id) ?? {
        total: 0,
        done: 0,
      };
      bucket.total += 1;
      if (completedSet.has(s.id)) bucket.done += 1;
      schedByAssignment.set(s.assignment_id, bucket);
    }
  }

  // Cadence partner labels — full_name on profiles + email on
  // admin_users_overview, same pattern as partner-detail.ts.
  const cadenceUserIdsForLabels = assignRows
    .filter((a) => a.source_kind === "cadence" && a.user_id)
    .map((a) => a.user_id as string);
  if (cadenceUserIdsForLabels.length > 0) {
    const [profilesRes, emailsRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name")
        .in("id", cadenceUserIdsForLabels),
      admin
        .from("admin_users_overview")
        .select("user_id, email")
        .in("user_id", cadenceUserIdsForLabels),
    ]);
    const fullNameById = new Map(
      ((profilesRes.data ?? []) as Array<{
        id: string;
        full_name: string | null;
      }>).map((p) => [p.id, p.full_name]),
    );
    const emailById = new Map(
      ((emailsRes.data ?? []) as Array<{
        user_id: string;
        email: string | null;
      }>).map((u) => [u.user_id, u.email]),
    );
    for (const uid of cadenceUserIdsForLabels) {
      titleMap.set(
        `cadence:${uid}`,
        `Cadence · ${fullNameById.get(uid) || emailById.get(uid) || `${uid.slice(0, 8)}…`}`,
      );
    }
  }

  const assignments: ExpertAssignmentRow[] = assignRows.map((a) => {
    const sched = schedByAssignment.get(a.id) ?? { total: 0, done: 0 };
    const titleKey =
      a.source_kind === "cadence"
        ? `cadence:${a.user_id ?? ""}`
        : `${a.source_kind}:${a.source_id}`;
    return {
      id: a.id,
      sourceKind: a.source_kind as ExpertAssignmentRow["sourceKind"],
      sourceId: a.source_id,
      sourceTitle: titleMap.get(titleKey) ?? null,
      userId: a.user_id,
      isActive: a.is_active,
      createdAt: a.created_at,
      anchorDate: a.anchor_date,
      scheduledTotal: sched.total,
      scheduledCompleted: sched.done,
    };
  });

  return {
    coupleId: opts.coupleId,
    displayName: (couple as { display_name: string | null }).display_name,
    pairCode: (couple as { pair_code: string | null }).pair_code,
    members,
    expertLink: link,
    assignments,
  };
}

/**
 * Source picker data for the assign-content form on the couple detail page.
 */
export type SourceOption = {
  kind: "program" | "category" | "item";
  id: string;
  title: string;
};

export async function listAssignableSources(): Promise<SourceOption[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const [{ data: programs }, { data: categories }, { data: items }] =
    await Promise.all([
      admin
        .from("journey_programs")
        .select("id, name_he, name_en")
        .eq("is_active", true)
        .order("name_he"),
      admin
        .from("journey_categories")
        .select("id, name_he, name_en")
        .eq("is_active", true)
        .order("name_he"),
      admin
        .from("journey_items")
        .select("id, title_he, title_en")
        .eq("is_active", true)
        .order("title_he"),
    ]);

  const out: SourceOption[] = [];
  for (const p of (programs ?? []) as Array<{
    id: string;
    name_he: string;
    name_en: string | null;
  }>) {
    out.push({ kind: "program", id: p.id, title: p.name_he || p.name_en || p.id });
  }
  for (const c of (categories ?? []) as Array<{
    id: string;
    name_he: string;
    name_en: string | null;
  }>) {
    out.push({
      kind: "category",
      id: c.id,
      title: c.name_he || c.name_en || c.id,
    });
  }
  for (const i of (items ?? []) as Array<{
    id: string;
    title_he: string;
    title_en: string | null;
  }>) {
    out.push({ kind: "item", id: i.id, title: i.title_he || i.title_en || i.id });
  }
  return out;
}
