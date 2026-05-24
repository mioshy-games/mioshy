// ============================================================
// Server-side Supabase query helpers for the Journey Content System.
//
// Per the project's @supabase/ssr pattern: reads go through the session
// client (RLS honored) and writes go through the admin/service-role
// client (RLS bypassed). These read helpers are safe for both admin and
// user-facing pages.
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type {
  JourneyAssignment,
  JourneyCategory,
  JourneyGroup,
  JourneyGroupMember,
  JourneyGroupSubtopicBinding,
  JourneyItem,
  JourneyItemCompletion,
  JourneyItemResponse,
  JourneyOwner,
  JourneyProgram,
  JourneyScheduledItem,
  JourneySubtopic,
  ProgramWithContent,
  TimelineEntry,
} from "./types";
import { deriveStatus } from "./status";
import { ownerFilter } from "./owner";

// ------------------------------------------------------------
// Programs
// ------------------------------------------------------------

export interface ListProgramsFilters {
  onlyActive?: boolean;
  search?: string;
}

export async function listPrograms(
  filters: ListProgramsFilters = {},
): Promise<JourneyProgram[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_programs")
    .select("*")
    .order("sort_weight", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.onlyActive) q = q.eq("is_active", true);
  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    q = q.or(
      `slug.ilike.${term},name_he.ilike.${term},name_en.ilike.${term}`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyProgram[];
}

export async function getProgramById(id: string): Promise<JourneyProgram | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyProgram) ?? null;
}

export async function getProgramBySlug(slug: string): Promise<JourneyProgram | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_programs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyProgram) ?? null;
}

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

export interface ListCategoriesFilters {
  /** null → standalone only, string → program-owned, undefined → all */
  programId?: string | null;
  onlyActive?: boolean;
}

export async function listCategories(
  filters: ListCategoriesFilters = {},
): Promise<JourneyCategory[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.programId === null) {
    q = q.is("program_id", null);
  } else if (typeof filters.programId === "string") {
    q = q.eq("program_id", filters.programId);
  }

  if (filters.onlyActive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyCategory[];
}

export async function getCategoryById(id: string): Promise<JourneyCategory | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyCategory) ?? null;
}

// ------------------------------------------------------------
// Subtopics (v3 slice 2)
// ------------------------------------------------------------

export interface ListSubtopicsFilters {
  categoryId: string;
  onlyActive?: boolean;
}

export async function listSubtopics(
  filters: ListSubtopicsFilters,
): Promise<JourneySubtopic[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_subtopics")
    .select("*")
    .eq("category_id", filters.categoryId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (filters.onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneySubtopic[];
}

/**
 * Cross-catalog: every subtopic, regardless of category. Used by the
 * item form to populate its subtopic picker; the form itself filters
 * by the currently-selected category_id at render time.
 */
export async function adminListAllSubtopics(): Promise<JourneySubtopic[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_subtopics")
    .select("*")
    .order("category_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneySubtopic[];
}

export async function getSubtopicById(
  id: string,
): Promise<JourneySubtopic | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_subtopics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneySubtopic) ?? null;
}

// ------------------------------------------------------------
// Items
// ------------------------------------------------------------

export interface ListItemsFilters {
  categoryId?: string;
  /** v3 slice 2: filter by subtopic.
   *   - undefined → don't filter on subtopic at all (any subtopic, or none)
   *   - null      → only items with NO subtopic (direct-on-category)
   *   - string    → items in that exact subtopic */
  subtopicId?: string | null;
  onlyActive?: boolean;
  search?: string;
}

export async function listItems(
  filters: ListItemsFilters = {},
): Promise<JourneyItem[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.subtopicId === null) {
    // Direct-on-category items (no subtopic)
    q = q.is("subtopic_id", null);
  } else if (typeof filters.subtopicId === "string") {
    q = q.eq("subtopic_id", filters.subtopicId);
  }
  if (filters.onlyActive) q = q.eq("is_active", true);
  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    q = q.or(
      `slug.ilike.${term},title_he.ilike.${term},title_en.ilike.${term}`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyItem[];
}

export async function getItemById(id: string): Promise<JourneyItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyItem) ?? null;
}

// ------------------------------------------------------------
// Composite - programs with inlined content
// ------------------------------------------------------------

/**
 * Return a program and its categories + items nested inside. Used by the
 * admin program editor and the bulk-assign preview. Excludes inactive
 * rows so the preview shows exactly what will be materialized.
 */
export async function getProgramWithContent(
  programId: string,
): Promise<ProgramWithContent | null> {
  const program = await getProgramById(programId);
  if (!program) return null;

  const categories = await listCategories({
    programId,
    onlyActive: false,
  });
  if (categories.length === 0) {
    return { program, categories: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data: items, error } = await supabase
    .from("journey_items")
    .select("*")
    .in(
      "category_id",
      categories.map((c) => c.id),
    )
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const byCategory = new Map<string, JourneyItem[]>();
  for (const it of (items ?? []) as JourneyItem[]) {
    const list = byCategory.get(it.category_id) ?? [];
    list.push(it);
    byCategory.set(it.category_id, list);
  }

  return {
    program,
    categories: categories.map((c) => ({
      category: c,
      items: byCategory.get(c.id) ?? [],
    })),
  };
}

// ------------------------------------------------------------
// Assignments
// ------------------------------------------------------------

export async function listAssignmentsForOwner(
  owner: JourneyOwner,
  opts: {
    onlyActive?: boolean;
    /** v3 slice 4: narrow by source_kind. Pass ['cadence'] to fetch
     *  only the per-user cadence container, or ['program','category',
     *  'item'] to fetch only legacy v2 sources. Omit for all kinds. */
    sourceKinds?: Array<"program" | "category" | "item" | "cadence">;
  } = {},
): Promise<JourneyAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const { column, value } = ownerFilter(owner);
  let q = supabase
    .from("journey_assignments")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false });
  if (opts.onlyActive) q = q.eq("is_active", true);
  if (opts.sourceKinds && opts.sourceKinds.length > 0) {
    q = q.in("source_kind", opts.sourceKinds);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyAssignment[];
}

export async function getAssignmentById(
  id: string,
): Promise<JourneyAssignment | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyAssignment) ?? null;
}

// ------------------------------------------------------------
// Timeline (the materialized, user-facing view)
// ------------------------------------------------------------

/**
 * Hydrate the timeline for an owner - returns every scheduled item across
 * all of the owner's active assignments, enriched with content, category,
 * completion state, and visible responses (private filtering applied for
 * the given viewerUserId).
 */
export async function getTimelineForOwner(args: {
  owner: JourneyOwner;
  viewerUserId: string;
  /** Viewer's role inside the couple (owner|partner) when owner.kind ===
   * 'couple'. Used to filter out scheduled items targeted at the OTHER
   * partner. Pass null for solo timelines or when role is unknown. */
  viewerCoupleRole?: "owner" | "partner" | null;
  /** v3 slice 4: narrow the underlying assignments by source_kind.
   *  Pass ['cadence'] to fetch only the per-user cadence container's
   *  scheduled rows; pass ['program','category','item'] to fetch only
   *  legacy v2 rows. /my/journey calls this twice - once per axis -
   *  and merges the entries by unlock_at. */
  sourceKinds?: Array<"program" | "category" | "item" | "cadence">;
  now?: Date;
}): Promise<TimelineEntry[]> {
  const { owner, viewerUserId, viewerCoupleRole, sourceKinds, now } = args;
  // P1.3: hoisted from below so the .lte filter on scheduled_items uses
  // the same clock value that deriveStatus uses for status derivation.
  // Same clock → no race between the SQL filter and the JS computation.
  const clock = now ?? new Date();
  const clockIso = clock.toISOString();
  const supabase = await createServerSupabaseClient();

  // 1. Active assignments for this owner (optionally narrowed by source_kind).
  const assignments = await listAssignmentsForOwner(owner, {
    onlyActive: true,
    sourceKinds,
  });
  if (assignments.length === 0) return [];
  const assignmentIds = assignments.map((a) => a.id);

  // 2. Scheduled items — only those already unlocked.
  // P1.3 (2026-05-24): added .lte("unlock_at", clockIso) so locked/upcoming
  // items don't render in JourneyDesk. The cadence engine drips one item
  // per delivery slot, so future items don't normally exist — but
  // pre-materialized rows from program assignments (or items with
  // non-zero default_offset_days) would otherwise leak through.
  const { data: scheduledRows, error: sErr } = await supabase
    .from("journey_scheduled_items")
    .select("*")
    .in("assignment_id", assignmentIds)
    .lte("unlock_at", clockIso)
    .order("unlock_at", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  let scheduled = (scheduledRows ?? []) as JourneyScheduledItem[];

  // Audience filter - only relevant for couple-owned timelines.
  // 'both' is always shown; 'owner' / 'partner' rows show only to the
  // matching couple_member.role. Unknown role falls back to 'both' only.
  if (owner.kind === "couple") {
    scheduled = scheduled.filter((s) => {
      if (s.audience === "both") return true;
      if (!viewerCoupleRole) return false; // unknown role → hide targeted rows
      return s.audience === viewerCoupleRole;
    });
  }

  if (scheduled.length === 0) return [];

  const itemIds = Array.from(new Set(scheduled.map((s) => s.item_id)));
  const scheduledIds = scheduled.map((s) => s.id);
  // Migration 066 — collect rule ids in this batch so we can resolve
  // them in one tiny lookup. Skips nulls (legacy unattributed rows).
  const ruleIds = Array.from(
    new Set(
      scheduled
        .map((s) => s.matched_by_rule_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  type RuleSlim = {
    id: string;
    slug: string;
    rationale_he: string;
    rationale_en: string;
  };

  // 3. Items + completions + responses + rules in parallel
  const [itemsRes, completionsRes, responsesRes, rulesRes] = await Promise.all([
    supabase.from("journey_items").select("*").in("id", itemIds),
    supabase
      .from("journey_item_completions")
      .select("*")
      .in("scheduled_item_id", scheduledIds),
    supabase
      .from("journey_item_responses")
      .select("*")
      .in("scheduled_item_id", scheduledIds)
      .order("created_at", { ascending: true }),
    ruleIds.length === 0
      ? Promise.resolve({ data: [] as RuleSlim[], error: null })
      : supabase
          .from("journey_match_rules")
          .select("id, slug, rationale_he, rationale_en")
          .in("id", ruleIds),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (completionsRes.error) throw new Error(completionsRes.error.message);
  if (responsesRes.error) throw new Error(responsesRes.error.message);
  // Rules failure is non-fatal — UI degrades to "no rationale" gracefully.
  const rulesById = new Map<string, RuleSlim>(
    ((rulesRes.data ?? []) as RuleSlim[]).map((r) => [r.id, r]),
  );

  const items = (itemsRes.data ?? []) as JourneyItem[];
  const itemsById = new Map(items.map((it) => [it.id, it]));

  const categoryIds = Array.from(new Set(items.map((it) => it.category_id)));
  type CategorySlim = Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug">;
  const { data: categoryRows, error: cErr } = await supabase
    .from("journey_categories")
    .select("id, name_he, name_en, slug")
    .in("id", categoryIds);
  if (cErr) throw new Error(cErr.message);
  const categoriesById = new Map<string, CategorySlim>(
    ((categoryRows ?? []) as CategorySlim[]).map((c) => [c.id, c]),
  );

  const completionsById = new Map(
    ((completionsRes.data ?? []) as JourneyItemCompletion[]).map((c) => [
      c.scheduled_item_id,
      c,
    ]),
  );

  const responsesByScheduled = new Map<string, JourneyItemResponse[]>();
  for (const r of (responsesRes.data ?? []) as JourneyItemResponse[]) {
    // Private responses are only visible to the author (RLS also enforces
    // this for non-admin reads, but we filter defensively here so admin
    // session clients get the same view users get).
    if (r.is_private && r.user_id !== viewerUserId) continue;
    const list = responsesByScheduled.get(r.scheduled_item_id) ?? [];
    list.push(r);
    responsesByScheduled.set(r.scheduled_item_id, list);
  }

  return scheduled
    .map<TimelineEntry | null>((s) => {
      const item = itemsById.get(s.item_id);
      if (!item) return null;
      const category = categoriesById.get(item.category_id);
      if (!category) return null;
      const completion = completionsById.get(s.id) ?? null;
      const rule = s.matched_by_rule_id
        ? rulesById.get(s.matched_by_rule_id) ?? null
        : null;
      return {
        scheduled: s,
        item,
        category: {
          id: category.id,
          name_he: category.name_he,
          name_en: category.name_en,
          slug: category.slug,
        },
        status: deriveStatus({
          unlockAt: s.unlock_at,
          hasCompletion: !!completion,
          now: clock,
        }),
        completion,
        responses: responsesByScheduled.get(s.id) ?? [],
        matchRule: rule,
      };
    })
    .filter((x): x is TimelineEntry => x !== null);
}

// ------------------------------------------------------------
// Admin-scoped variants (use service-role client so RLS never blocks a
// management page). Call only from admin-gated server contexts.
// ------------------------------------------------------------

export async function adminListPrograms(): Promise<JourneyProgram[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");
  const { data, error } = await supabase
    .from("journey_programs")
    .select("*")
    .order("sort_weight", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyProgram[];
}

// ------------------------------------------------------------
// Owner lookup for the admin bulk-assign picker. Combines users + couples
// into a unified option list. Kept admin-only because we expose raw
// auth.users emails.
// ------------------------------------------------------------

export interface OwnerOption {
  /** Stable key used as Select value - "user:<uuid>" or "couple:<uuid>". */
  key: string;
  kind: "user" | "couple";
  label: string;
  sublabel?: string;
}

export async function adminListOwnerOptions(args: {
  search?: string;
  limit?: number;
} = {}): Promise<OwnerOption[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");

  const limit = Math.min(args.limit ?? 200, 500);
  const search = args.search?.trim() ?? "";

  // Couples first (usually a smaller set) - show paired couples by display
  // name + their pair_code so the admin can match a lead to the right row.
  let cq = supabase
    .from("couples")
    .select("id, display_name, pair_code")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (search) {
    const term = `%${search}%`;
    cq = cq.or(`display_name.ilike.${term},pair_code.ilike.${term}`);
  }
  const { data: couples, error: cErr } = await cq;
  if (cErr) throw new Error(cErr.message);

  // Users - prefer the admin_users_overview view which already joins in
  // email; fall back to auth.users if the view is missing.
  let uq = supabase
    .from("admin_users_overview")
    .select("user_id, email")
    .order("user_created_at", { ascending: false })
    .limit(limit);
  if (search) {
    uq = uq.ilike("email", `%${search}%`);
  }
  const { data: users, error: uErr } = await uq;
  if (uErr) throw new Error(uErr.message);

  const options: OwnerOption[] = [];
  for (const c of (couples ?? []) as Array<{
    id: string;
    display_name: string | null;
    pair_code: string | null;
  }>) {
    options.push({
      key: `couple:${c.id}`,
      kind: "couple",
      label: c.display_name?.trim() || "Couple",
      sublabel: c.pair_code ?? undefined,
    });
  }
  for (const u of (users ?? []) as Array<{ user_id: string; email: string }>) {
    options.push({
      key: `user:${u.user_id}`,
      kind: "user",
      label: u.email ?? "(no email)",
    });
  }
  return options;
}

export async function adminGetOwnerLabel(
  ownerKey: string,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const [kind, id] = ownerKey.split(":");
  if (!id) return null;

  if (kind === "couple") {
    const { data } = await supabase
      .from("couples")
      .select("display_name, pair_code")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const row = data as { display_name: string | null; pair_code: string | null };
    return row.display_name ?? row.pair_code ?? `Couple ${id.slice(0, 8)}`;
  }
  if (kind === "user") {
    const { data } = await supabase
      .from("admin_users_overview")
      .select("email")
      .eq("user_id", id)
      .maybeSingle();
    if (!data) return null;
    return (data as { email: string }).email ?? `User ${id.slice(0, 8)}`;
  }
  return null;
}

export async function adminListAssignments(args: {
  ownerKey?: string;
  limit?: number;
  /** v3 slice 4: when ownerKey identifies a COUPLE, also include
   *  cadence assignments belonging to either partner (resolved via
   *  couple_members). Cadence is per-user so it never appears under
   *  a couple_id; the couple-aggregate admin views opt in via this
   *  flag to roll both partners' cadence into the couple workspace. */
  includeCoupleMembersCadence?: boolean;
} = {}): Promise<JourneyAssignment[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");

  const limit = Math.min(args.limit ?? 200, 500);

  // Build the primary owner-scoped query.
  let q = supabase
    .from("journey_assignments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  let kind: string | null = null;
  let id: string | null = null;
  if (args.ownerKey) {
    const [k, i] = args.ownerKey.split(":");
    if (!i) return [];
    kind = k;
    id = i;
    if (kind === "user") q = q.eq("user_id", id);
    else if (kind === "couple") q = q.eq("couple_id", id);
    else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const primary = (data ?? []) as JourneyAssignment[];

  // Slice 4 rollup: pull each partner's cadence assignment when this
  // is a couple ownerKey AND the caller opted in. Cadence rows live
  // under user_id, never couple_id, so the primary query above
  // misses them by design.
  if (
    args.includeCoupleMembersCadence &&
    kind === "couple" &&
    id
  ) {
    const { data: members } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", id);
    const memberUserIds = (members ?? [])
      .map((m) => m.user_id as string)
      .filter(Boolean);
    if (memberUserIds.length > 0) {
      const { data: cadenceRows } = await supabase
        .from("journey_assignments")
        .select("*")
        .in("user_id", memberUserIds)
        .eq("source_kind", "cadence")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cadenceRows && cadenceRows.length > 0) {
        // De-dupe defensively (a cadence row should never appear
        // twice, but a future schema change could wire it both ways).
        const seen = new Set(primary.map((a) => a.id));
        for (const row of cadenceRows as JourneyAssignment[]) {
          if (!seen.has(row.id)) primary.push(row);
        }
      }
    }
  }

  return primary;
}

// ------------------------------------------------------------
// Groups (v3 slice 7)
// ------------------------------------------------------------

export interface GroupListRow extends JourneyGroup {
  member_count: number;
  binding_count: number;
}

export async function adminListGroups(): Promise<GroupListRow[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");

  const [groupsRes, memberRes, bindingRes] = await Promise.all([
    supabase
      .from("journey_groups")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("journey_group_members").select("group_id"),
    supabase.from("journey_group_subtopics").select("group_id"),
  ]);

  if (groupsRes.error) throw new Error(groupsRes.error.message);
  const groups = (groupsRes.data ?? []) as JourneyGroup[];
  if (groups.length === 0) return [];

  const memberCountByGroup = new Map<string, number>();
  for (const m of (memberRes.data ?? []) as Array<{ group_id: string }>) {
    memberCountByGroup.set(
      m.group_id,
      (memberCountByGroup.get(m.group_id) ?? 0) + 1,
    );
  }
  const bindingCountByGroup = new Map<string, number>();
  for (const b of (bindingRes.data ?? []) as Array<{ group_id: string }>) {
    bindingCountByGroup.set(
      b.group_id,
      (bindingCountByGroup.get(b.group_id) ?? 0) + 1,
    );
  }

  return groups.map((g) => ({
    ...g,
    member_count: memberCountByGroup.get(g.id) ?? 0,
    binding_count: bindingCountByGroup.get(g.id) ?? 0,
  }));
}

export async function getGroupById(id: string): Promise<JourneyGroup | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("journey_groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyGroup) ?? null;
}

export interface GroupMemberRow extends JourneyGroupMember {
  email: string | null;
  full_name: string | null;
}

/** Members enriched with email + full_name for the picker UI. */
export async function listGroupMembers(
  groupId: string,
): Promise<GroupMemberRow[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("journey_group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  const members = (rows ?? []) as JourneyGroupMember[];
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);
  const [profilesRes, emailsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", userIds),
  ]);
  const fullNameById = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map(
      (p) => [p.id, p.full_name],
    ),
  );
  const emailById = new Map(
    ((emailsRes.data ?? []) as Array<{ user_id: string; email: string | null }>).map(
      (u) => [u.user_id, u.email],
    ),
  );

  return members.map((m) => ({
    ...m,
    full_name: fullNameById.get(m.user_id) ?? null,
    email: emailById.get(m.user_id) ?? null,
  }));
}

export interface GroupSubtopicBindingRow extends JourneyGroupSubtopicBinding {
  subtopic_name_he: string;
  subtopic_name_en: string | null;
  category_id: string;
  category_name_he: string;
}

/** Bindings enriched with subtopic + category labels. */
export async function listGroupSubtopicBindings(
  groupId: string,
): Promise<GroupSubtopicBindingRow[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("journey_group_subtopics")
    .select("*")
    .eq("group_id", groupId)
    .order("sort_weight", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const bindings = (rows ?? []) as JourneyGroupSubtopicBinding[];
  if (bindings.length === 0) return [];

  const subtopicIds = bindings.map((b) => b.subtopic_id);
  const { data: subRows } = await supabase
    .from("journey_subtopics")
    .select("id, name_he, name_en, category_id")
    .in("id", subtopicIds);
  const subtopicById = new Map(
    ((subRows ?? []) as Array<{
      id: string;
      name_he: string;
      name_en: string | null;
      category_id: string;
    }>).map((s) => [s.id, s]),
  );

  const categoryIds = Array.from(
    new Set(
      ((subRows ?? []) as Array<{ category_id: string }>).map(
        (s) => s.category_id,
      ),
    ),
  );
  const { data: catRows } =
    categoryIds.length > 0
      ? await supabase
          .from("journey_categories")
          .select("id, name_he")
          .in("id", categoryIds)
      : { data: [] as Array<{ id: string; name_he: string }> };
  const categoryById = new Map(
    ((catRows ?? []) as Array<{ id: string; name_he: string }>).map(
      (c) => [c.id, c.name_he],
    ),
  );

  return bindings.map((b) => {
    const sub = subtopicById.get(b.subtopic_id);
    return {
      ...b,
      subtopic_name_he: sub?.name_he ?? "(unknown)",
      subtopic_name_en: sub?.name_en ?? null,
      category_id: sub?.category_id ?? "",
      category_name_he: sub
        ? categoryById.get(sub.category_id) ?? "(unknown)"
        : "(unknown)",
    };
  });
}

/**
 * Reverse lookup - for a set of subtopic_ids, return the count of
 * groups bound to each. Used by the items list to show "this
 * subtopic is bound to N group(s)" so admins know cadence behaves
 * differently for some users.
 */
export async function countGroupBindingsForSubtopics(
  subtopicIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (subtopicIds.length === 0) return out;
  const supabase = createServiceRoleClient();
  if (!supabase) return out;
  const { data, error } = await supabase
    .from("journey_group_subtopics")
    .select("subtopic_id")
    .in("subtopic_id", subtopicIds);
  if (error) {
    console.error("[countGroupBindingsForSubtopics]", error);
    return out;
  }
  for (const r of (data ?? []) as Array<{ subtopic_id: string }>) {
    out.set(r.subtopic_id, (out.get(r.subtopic_id) ?? 0) + 1);
  }
  return out;
}

/**
 * Cadence engine helper - for a given user, return the set of
 * subtopic_ids they're in REPLACE mode for (across all groups).
 * If the user is in BOTH a replace and an interleave group for the
 * same subtopic, replace wins (per Itzik's slice 7 brief).
 *
 * Two-query implementation: PostgREST nested filters with multi-hop
 * inner joins are fragile; the user's group count is small (~5) so
 * the round-trip overhead is negligible.
 */
export async function getReplaceSubtopicsForUser(
  userId: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const supabase = createServiceRoleClient();
  if (!supabase) return out;

  // Step 1: active groups the user belongs to.
  const { data: memberRows, error: mErr } = await supabase
    .from("journey_group_members")
    .select("group_id, journey_groups!inner(is_active)")
    .eq("user_id", userId)
    .eq("journey_groups.is_active", true);
  if (mErr) {
    console.error("[getReplaceSubtopicsForUser:members]", mErr);
    return out;
  }
  const groupIds = ((memberRows ?? []) as Array<{ group_id: string }>).map(
    (r) => r.group_id,
  );
  if (groupIds.length === 0) return out;

  // Step 2: replace-mode bindings on those groups.
  const { data: bindRows, error: bErr } = await supabase
    .from("journey_group_subtopics")
    .select("subtopic_id")
    .in("group_id", groupIds)
    .eq("mode", "replace");
  if (bErr) {
    console.error("[getReplaceSubtopicsForUser:bindings]", bErr);
    return out;
  }
  for (const r of (bindRows ?? []) as Array<{ subtopic_id: string }>) {
    out.add(r.subtopic_id);
  }
  return out;
}

/**
 * Cross-couple "active in cadence: N this week" stat for the groups
 * list page. Counts distinct member user_ids that received any
 * cadence-source scheduled_item in the last 7 days.
 */
export async function countActiveMembersThisWeek(
  groupId: string,
): Promise<number> {
  const supabase = createServiceRoleClient();
  if (!supabase) return 0;
  const { data: members } = await supabase
    .from("journey_group_members")
    .select("user_id")
    .eq("group_id", groupId);
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (userIds.length === 0) return 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from("journey_scheduled_items")
    .select("journey_assignments!inner(user_id, source_kind)")
    .eq("source", "cadence")
    .gte("unlock_at", sevenDaysAgo)
    .in("journey_assignments.user_id", userIds)
    .eq("journey_assignments.source_kind", "cadence");
  // PostgREST nested resources come back as arrays even on a !inner
  // join. We unwrap defensively.
  const seen = new Set<string>();
  for (const r of (rows ?? []) as Array<{
    journey_assignments:
      | { user_id: string | null }
      | Array<{ user_id: string | null }>
      | null;
  }>) {
    const a = r.journey_assignments;
    if (!a) continue;
    const list = Array.isArray(a) ? a : [a];
    for (const item of list) {
      if (item?.user_id) seen.add(item.user_id);
    }
  }
  return seen.size;
}

export async function adminListCategoriesWithItemCounts(
  programId?: string | null,
): Promise<Array<JourneyCategory & { item_count: number }>> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");

  let cq = supabase
    .from("journey_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (programId === null) cq = cq.is("program_id", null);
  else if (typeof programId === "string") cq = cq.eq("program_id", programId);

  const { data: cats, error: cErr } = await cq;
  if (cErr) throw new Error(cErr.message);
  const categories = (cats ?? []) as JourneyCategory[];
  if (categories.length === 0) return [];

  const { data: counts, error: iErr } = await supabase
    .from("journey_items")
    .select("category_id")
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  if (iErr) throw new Error(iErr.message);

  const byCat = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ category_id: string }>) {
    byCat.set(row.category_id, (byCat.get(row.category_id) ?? 0) + 1);
  }
  return categories.map((c) => ({
    ...c,
    item_count: byCat.get(c.id) ?? 0,
  }));
}
