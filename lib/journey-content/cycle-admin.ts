// ============================================================
// lib/journey-content/cycle-admin.ts
//
// Read layer for the cycle admin (spec §5).
//
// The rule from §5 is that the admin must show the SAME thing the user gets —
// otherwise we are back to two sources of truth. So the "what the user sees
// now" view reads journey_cycle_items directly, exactly the rows the user's
// screen will render, rather than recomputing what we think should be there.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface CategoryPoolRow {
  categoryId: string;
  slug: string;
  nameHe: string;
  /** Every active content item in the category. */
  total: number;
  /** Ordered queue: title + admin sort order. */
  queue: Array<{ id: string; title: string; sortOrder: number }>;
}

export interface PoolSummary {
  categories: CategoryPoolRow[];
  /** Cycles of coverage for a brand-new user = the smallest category. */
  cyclesOfCoverage: number;
  /** The category that caps everyone. */
  bindingCategorySlug: string | null;
  totalItems: number;
}

const ACTIVE_PROGRAM_SLUG = "journey";

/**
 * The content pool, per category, in the order it will be handed out (§5:
 * management moves from a weekly sequence to a per-category queue).
 */
export async function getCategoryPool(): Promise<PoolSummary> {
  const admin = createServiceRoleClient();
  const empty: PoolSummary = {
    categories: [],
    cyclesOfCoverage: 0,
    bindingCategorySlug: null,
    totalItems: 0,
  };
  if (!admin) return empty;

  const { data: program } = await admin
    .from("journey_programs")
    .select("id")
    .eq("product_slug", ACTIVE_PROGRAM_SLUG)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!program) return empty;

  const { data: cats } = await admin
    .from("journey_categories")
    .select("id, slug, name_he, sort_order")
    .eq("program_id", (program as { id: string }).id)
    .eq("is_active", true)
    .not("assessment_priority_key", "is", null)
    .order("sort_order", { ascending: true });

  const { data: items } = await admin
    .from("journey_items")
    .select("id, category_id, title_he, sort_order")
    .eq("is_active", true)
    .eq("kind", "content")
    .order("sort_order", { ascending: true });

  const byCategory = new Map<string, Array<{ id: string; title: string; sortOrder: number }>>();
  for (const i of (items ?? []) as Array<{
    id: string;
    category_id: string;
    title_he: string | null;
    sort_order: number | null;
  }>) {
    const list = byCategory.get(i.category_id) ?? [];
    list.push({ id: i.id, title: i.title_he ?? "(ללא כותרת)", sortOrder: i.sort_order ?? 0 });
    byCategory.set(i.category_id, list);
  }

  const categories: CategoryPoolRow[] = ((cats ?? []) as Array<{
    id: string;
    slug: string;
    name_he: string;
  }>).map((c) => {
    const queue = byCategory.get(c.id) ?? [];
    return {
      categoryId: c.id,
      slug: c.slug,
      nameHe: c.name_he,
      total: queue.length,
      queue,
    };
  });

  const smallest = categories.reduce<CategoryPoolRow | null>(
    (min, c) => (min === null || c.total < min.total ? c : min),
    null,
  );

  return {
    categories,
    cyclesOfCoverage: smallest?.total ?? 0,
    bindingCategorySlug: smallest?.slug ?? null,
    totalItems: categories.reduce((n, c) => n + c.total, 0),
  };
}

export interface CycleItemView {
  cycleItemId: string;
  rankPosition: number;
  categoryName: string;
  itemTitle: string;
  isSubstitute: boolean;
  intendedCategoryName: string | null;
  completedAt: string | null;
  completedByEmail: string | null;
}

export interface UserCycleView {
  userId: string;
  email: string | null;
  cycleId: string | null;
  cycleNumber: number | null;
  openedAt: string | null;
  plannedNextOpenAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
  rankingSource: string | null;
  items: CycleItemView[];
  completedCount: number;
  totalCount: number;
  /** Cycles this user already finished. */
  historyCount: number;
}

/**
 * "What the user sees right now" — the open cycle, in display order, with the
 * marks. Falls back to the most recent closed cycle so a user between cycles
 * still shows something meaningful instead of an empty card.
 */
export async function getUserCycleView(userId: string): Promise<UserCycleView | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: user } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: cycles } = await admin
    .from("journey_cycles")
    .select("id, cycle_number, opened_at, planned_next_open_at, closed_at, close_reason, ranking_source")
    .eq("user_id", userId)
    .order("cycle_number", { ascending: false });

  const all = (cycles ?? []) as Array<{
    id: string;
    cycle_number: number;
    opened_at: string;
    planned_next_open_at: string;
    closed_at: string | null;
    close_reason: string | null;
    ranking_source: string | null;
  }>;
  const current = all.find((c) => c.closed_at === null) ?? all[0] ?? null;

  const base: UserCycleView = {
    userId,
    email: await emailFor(userId),
    cycleId: current?.id ?? null,
    cycleNumber: current?.cycle_number ?? null,
    openedAt: current?.opened_at ?? null,
    plannedNextOpenAt: current?.planned_next_open_at ?? null,
    closedAt: current?.closed_at ?? null,
    closeReason: current?.close_reason ?? null,
    rankingSource: current?.ranking_source ?? null,
    items: [],
    completedCount: 0,
    totalCount: 0,
    historyCount: all.filter((c) => c.closed_at !== null).length,
  };
  if (!current) return base;

  const { data: rows } = await admin
    .from("journey_cycle_items")
    .select(
      "id, rank_position, is_substitute, completed_at, completed_by, journey_items(title_he), category:journey_categories!journey_cycle_items_category_id_fkey(name_he), intended:journey_categories!journey_cycle_items_intended_category_id_fkey(name_he)",
    )
    .eq("cycle_id", current.id)
    .order("rank_position", { ascending: true });

  const typed = (rows ?? []) as unknown as Array<{
    id: string;
    rank_position: number;
    is_substitute: boolean;
    completed_at: string | null;
    completed_by: string | null;
    journey_items: { title_he: string | null } | null;
    category: { name_he: string } | null;
    intended: { name_he: string } | null;
  }>;

  const markerIds = Array.from(
    new Set(typed.map((r) => r.completed_by).filter((v): v is string => Boolean(v))),
  );
  const markerEmail = new Map<string, string>();
  for (const id of markerIds) {
    const email = await emailFor(id);
    if (email) markerEmail.set(id, email);
  }

  base.items = typed.map((r) => ({
    cycleItemId: r.id,
    rankPosition: r.rank_position,
    categoryName: r.category?.name_he ?? "—",
    itemTitle: r.journey_items?.title_he ?? "(ללא כותרת)",
    isSubstitute: r.is_substitute,
    intendedCategoryName: r.intended?.name_he ?? null,
    completedAt: r.completed_at,
    completedByEmail: r.completed_by ? markerEmail.get(r.completed_by) ?? null : null,
  }));
  base.totalCount = base.items.length;
  base.completedCount = base.items.filter((i) => i.completedAt).length;
  return base;
}

/** Every user who has ever had a cycle, newest activity first. */
export async function listUsersWithCycles(): Promise<UserCycleView[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data } = await admin
    .from("journey_cycles")
    .select("user_id")
    .order("opened_at", { ascending: false });
  const ids = Array.from(
    new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  );
  const views: UserCycleView[] = [];
  for (const id of ids) {
    const v = await getUserCycleView(id);
    if (v) views.push(v);
  }
  return views;
}

async function emailFor(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}
