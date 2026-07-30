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
      "id, item_id, rank_position, is_substitute, completed_at, journey_items(title_he), journey_categories!journey_cycle_items_category_id_fkey(name_he)",
    )
    .eq("cycle_id", c.id)
    .order("rank_position", { ascending: true });

  const typed = (rows ?? []) as unknown as Array<{
    id: string;
    item_id: string;
    is_substitute: boolean;
    completed_at: string | null;
    journey_items: { title_he: string | null } | null;
    journey_categories: { name_he: string } | null;
  }>;

  const cards: UserCycleCard[] = typed.map((r) => ({
    cycleItemId: r.id,
    itemId: r.item_id,
    categoryName: r.journey_categories?.name_he ?? "",
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
