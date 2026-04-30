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
  JourneyItem,
  JourneyItemCompletion,
  JourneyItemResponse,
  JourneyOwner,
  JourneyProgram,
  JourneyScheduledItem,
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
// Items
// ------------------------------------------------------------

export interface ListItemsFilters {
  categoryId?: string;
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
  opts: { onlyActive?: boolean } = {},
): Promise<JourneyAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const { column, value } = ownerFilter(owner);
  let q = supabase
    .from("journey_assignments")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false });
  if (opts.onlyActive) q = q.eq("is_active", true);

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
  now?: Date;
}): Promise<TimelineEntry[]> {
  const { owner, viewerUserId, viewerCoupleRole, now } = args;
  const supabase = await createServerSupabaseClient();

  // 1. Active assignments for this owner
  const assignments = await listAssignmentsForOwner(owner, { onlyActive: true });
  if (assignments.length === 0) return [];
  const assignmentIds = assignments.map((a) => a.id);

  // 2. Scheduled items
  const { data: scheduledRows, error: sErr } = await supabase
    .from("journey_scheduled_items")
    .select("*")
    .in("assignment_id", assignmentIds)
    .order("unlock_at", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  let scheduled = (scheduledRows ?? []) as JourneyScheduledItem[];

  // Audience filter — only relevant for couple-owned timelines.
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

  // 3. Items + categories in parallel
  const [itemsRes, completionsRes, responsesRes] = await Promise.all([
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
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (completionsRes.error) throw new Error(completionsRes.error.message);
  if (responsesRes.error) throw new Error(responsesRes.error.message);

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

  const clock = now ?? new Date();

  return scheduled
    .map<TimelineEntry | null>((s) => {
      const item = itemsById.get(s.item_id);
      if (!item) return null;
      const category = categoriesById.get(item.category_id);
      if (!category) return null;
      const completion = completionsById.get(s.id) ?? null;
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
} = {}): Promise<JourneyAssignment[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role client unavailable");

  let q = supabase
    .from("journey_assignments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(args.limit ?? 200, 500));

  if (args.ownerKey) {
    const [kind, id] = args.ownerKey.split(":");
    if (!id) return [];
    if (kind === "user") q = q.eq("user_id", id);
    else if (kind === "couple") q = q.eq("couple_id", id);
    else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneyAssignment[];
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
