// ============================================================
// lib/journey-content/cycle-user.ts
//
// The user's own view of their open cycle — the data behind the five cards on
// /my/journey (spec §4).
//
// Separate from cycle-admin.ts on purpose: this one never resolves emails and
// never reads another user's rows, so it stays cheap enough for a page load.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface UserCycleCard {
  cycleItemId: string;
  itemId: string;
  categoryName: string;
  /** journey_categories.slug — picks the line icon. */
  categorySlug: string;
  /** First time the user opened it. Drives the middle visual state. */
  openedAt: string | null;
  title: string;
  /** The slot was filled from a neighbouring area because this one ran dry.
   *  Surfaced to the user only as a gentle visual cue — never as jargon. */
  isSubstitute: boolean;
  completedAt: string | null;
}

export interface OpenCycle {
  cycleId: string;
  cycleNumber: number;
  openedAt: string;
  plannedNextOpenAt: string;
  cards: UserCycleCard[];
  completedCount: number;
  totalCount: number;
}

export interface ChapterRow {
  cycleItemId: string;
  itemId: string;
  cycleNumber: number;
  categoryName: string;
  title: string;
  isSubstitute: boolean;
  completedAt: string | null;
}

/**
 * Every chapter this user has ever been given, from journey_cycle_items — the
 * single source of truth for "what content does this user have".
 *
 * `open` deliberately spans ALL cycles, not just the current one: §3 says a
 * chapter left unmarked when the month rolls over "stays open and reachable —
 * nothing gets closed off". Anything else would quietly take content away from
 * a paying customer.
 */
export async function getUserChapters(
  userId: string,
): Promise<{ open: ChapterRow[]; completed: ChapterRow[] }> {
  const admin = createServiceRoleClient();
  if (!admin) return { open: [], completed: [] };

  const { data } = await admin
    .from("journey_cycle_items")
    .select(
      "id, item_id, rank_position, is_substitute, completed_at, journey_cycles!inner(user_id, cycle_number, opened_at), journey_items(title_he), journey_categories!journey_cycle_items_category_id_fkey(name_he)",
    )
    .eq("journey_cycles.user_id", userId);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    item_id: string;
    rank_position: number;
    is_substitute: boolean;
    completed_at: string | null;
    journey_cycles: { cycle_number: number; opened_at: string };
    journey_items: { title_he: string | null } | null;
    journey_categories: { name_he: string } | null;
  }>;

  const mapped: Array<ChapterRow & { rank: number; openedAt: string }> = rows.map((r) => ({
    cycleItemId: r.id,
    itemId: r.item_id,
    cycleNumber: r.journey_cycles.cycle_number,
    categoryName: r.journey_categories?.name_he ?? "",
    title: r.journey_items?.title_he ?? "",
    isSubstitute: r.is_substitute,
    completedAt: r.completed_at,
    rank: r.rank_position,
    openedAt: r.journey_cycles.opened_at,
  }));

  const open = mapped
    .filter((c) => !c.completedAt)
    // Newest cycle first, then the user's own ranking order inside it.
    .sort((a, b) => b.cycleNumber - a.cycleNumber || a.rank - b.rank)
    .map(strip);

  const completed = mapped
    .filter((c) => c.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .map(strip);

  return { open, completed };
}

function strip(c: ChapterRow & { rank: number; openedAt: string }): ChapterRow {
  const { rank: _rank, openedAt: _openedAt, ...rest } = c;
  return rest;
}

export interface NextCyclePeek {
  categoryName: string;
  categorySlug: string;
  title: string;
}

/**
 * The chapters that will open in the NEXT cycle, for the teaser (§ retention).
 *
 * This is not a mock-up: it runs the real selector over the real remaining
 * library, so what the teaser promises is what the next cycle actually opens.
 * Returns [] when the library is spent — the caller hides the section rather
 * than filling the space, which is the whole lesson of the invented cards.
 */
export async function getNextCyclePeek(userId: string): Promise<NextCyclePeek[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  const { data: prioritiesRow } = await admin
    .from("journey_user_priorities")
    .select("ranking")
    .eq("user_id", userId)
    .maybeSingle();
  const ranking = (prioritiesRow as { ranking?: string[] } | null)?.ranking;
  if (!Array.isArray(ranking) || !ranking.length) return [];

  const { loadUnseenCandidates } = await import("./cycle-engine");
  const { selectCycleItems } = await import("./cycle-selection");

  // Everything in the open cycle is already in the delivered ledger, so the
  // candidate pool here is genuinely "what comes after this cycle".
  const candidates = await loadUnseenCandidates(userId);
  if (!candidates.length) return [];

  const { slots } = selectCycleItems(ranking, candidates);
  if (!slots.length) return [];

  const [items, cats] = await Promise.all([
    admin.from("journey_items").select("id, title_he").in("id", slots.map((s) => s.itemId)),
    admin
      .from("journey_categories")
      .select("id, name_he, slug")
      .in("id", Array.from(new Set(slots.map((s) => s.categoryId)))),
  ]);

  const titleById = new Map(
    ((items.data ?? []) as Array<{ id: string; title_he: string | null }>).map((i) => [
      i.id,
      i.title_he ?? "",
    ]),
  );
  const catById = new Map(
    ((cats.data ?? []) as Array<{ id: string; name_he: string; slug: string }>).map((c) => [
      c.id,
      c,
    ]),
  );

  return slots.map((s) => ({
    categoryName: catById.get(s.categoryId)?.name_he ?? "",
    categorySlug: catById.get(s.categoryId)?.slug ?? "",
    title: titleById.get(s.itemId) ?? "",
  }));
}

/** The user's currently open cycle, in their own ranking order. */
export async function getOpenCycleForUser(userId: string): Promise<OpenCycle | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: cycle } = await admin
    .from("journey_cycles")
    .select("id, cycle_number, opened_at, planned_next_open_at")
    .eq("user_id", userId)
    .is("closed_at", null)
    .maybeSingle();
  if (!cycle) return null;

  const c = cycle as {
    id: string;
    cycle_number: number;
    opened_at: string;
    planned_next_open_at: string;
  };

  const { data: rows } = await admin
    .from("journey_cycle_items")
    .select(
      "id, item_id, rank_position, is_substitute, opened_at, completed_at, journey_items(title_he), journey_categories!journey_cycle_items_category_id_fkey(name_he, slug)",
    )
    .eq("cycle_id", c.id)
    .order("rank_position", { ascending: true });

  const typed = (rows ?? []) as unknown as Array<{
    id: string;
    item_id: string;
    is_substitute: boolean;
    opened_at: string | null;
    completed_at: string | null;
    journey_items: { title_he: string | null } | null;
    journey_categories: { name_he: string; slug: string } | null;
  }>;

  const cards: UserCycleCard[] = typed.map((r) => ({
    cycleItemId: r.id,
    itemId: r.item_id,
    categoryName: r.journey_categories?.name_he ?? "",
    categorySlug: r.journey_categories?.slug ?? "",
    openedAt: r.opened_at,
    title: r.journey_items?.title_he ?? "",
    isSubstitute: r.is_substitute,
    completedAt: r.completed_at,
  }));

  return {
    cycleId: c.id,
    cycleNumber: c.cycle_number,
    openedAt: c.opened_at,
    plannedNextOpenAt: c.planned_next_open_at,
    cards,
    completedCount: cards.filter((x) => x.completedAt).length,
    totalCount: cards.length,
  };
}
