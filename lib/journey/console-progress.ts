import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Compact journey-progress strip for the coach console active window.
 *
 * ONE deriver for both conversation kinds — the only difference is the
 * assignment scope:
 *   • couple → journey_assignments.couple_id  (matches couple-workflow-state,
 *     which is couple-scoped; the completed/scheduled counts here are computed
 *     from the SAME active-assignment → scheduled-items → completions tables, so
 *     they equal the workflow chip's X/Y).
 *   • solo   → journey_assignments.user_id    (the user-scoped variant the
 *     couple workflow state can't give a solo user).
 *
 * Pure derivation from existing tables — no new schema. "Chapter" = a
 * journey_scheduled_item (a lesson). "אישר" (approved) for the current chapter
 * = the user has a journey_item_completions row for it (Itzik 2026-06-23).
 */

export interface ConsoleChapter {
  title: string;
  /** Approved = a completion record exists for this scheduled item. */
  approved: boolean;
  unlockAt: string;
}

export interface ConsoleProgress {
  /** Earliest active assignment created_at — the journey start. ISO | null. */
  startedAt: string | null;
  completedCount: number;
  scheduledCount: number;
  /** Latest already-unlocked chapter (the one they're on / just had). */
  currentChapter: ConsoleChapter | null;
  /** Soonest not-yet-unlocked chapter (what they'll receive next). */
  nextChapter: ConsoleChapter | null;
}

export type ProgressScope = { coupleId: string } | { userId: string };

const EMPTY: ConsoleProgress = {
  startedAt: null,
  completedCount: 0,
  scheduledCount: 0,
  currentChapter: null,
  nextChapter: null,
};

export async function loadConsoleProgress(
  scope: ProgressScope,
): Promise<ConsoleProgress | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  try {
    // 1. Active assignments in scope.
    let q = admin
      .from("journey_assignments")
      .select("id, created_at")
      .eq("is_active", true);
    q =
      "coupleId" in scope
        ? q.eq("couple_id", scope.coupleId)
        : q.eq("user_id", scope.userId);
    const { data: aRows, error: aErr } = await q;
    if (aErr) return EMPTY;

    const assignments = (aRows ?? []) as Array<{
      id: string;
      created_at: string;
    }>;
    if (assignments.length === 0) return EMPTY;

    const assignmentIds = assignments.map((a) => a.id);
    const startedAt =
      assignments
        .map((a) => a.created_at)
        .filter(Boolean)
        .sort((x, y) => x.localeCompare(y))[0] ?? null;

    // 2. Scheduled items (chapters), oldest unlock first.
    const { data: sRows } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id, unlock_at")
      .in("assignment_id", assignmentIds)
      .order("unlock_at", { ascending: true });
    const scheduled = (sRows ?? []) as Array<{
      id: string;
      item_id: string;
      unlock_at: string;
    }>;
    if (scheduled.length === 0) return { ...EMPTY, startedAt };

    // 3. Completions for those chapters.
    const schedIds = scheduled.map((s) => s.id);
    const { data: cRows } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", schedIds);
    const completed = new Set(
      ((cRows ?? []) as Array<{ scheduled_item_id: string }>).map(
        (r) => r.scheduled_item_id,
      ),
    );

    // 4. Chapter titles.
    const itemIds = Array.from(new Set(scheduled.map((s) => s.item_id)));
    const titleById = new Map<string, string>();
    const { data: iRows } = await admin
      .from("journey_items")
      .select("id, title_he, title_en")
      .in("id", itemIds);
    for (const i of (iRows ?? []) as Array<{
      id: string;
      title_he: string | null;
      title_en: string | null;
    }>) {
      titleById.set(i.id, (i.title_he || i.title_en || "").trim() || "פריט");
    }

    // 5. Current = latest unlocked; next = soonest upcoming.
    const now = Date.now();
    const unlocked = scheduled.filter(
      (s) => new Date(s.unlock_at).getTime() <= now,
    );
    const upcoming = scheduled.filter(
      (s) => new Date(s.unlock_at).getTime() > now,
    );
    const toChapter = (
      s: { id: string; item_id: string; unlock_at: string } | undefined,
    ): ConsoleChapter | null =>
      s
        ? {
            title: titleById.get(s.item_id) ?? "פריט",
            approved: completed.has(s.id),
            unlockAt: s.unlock_at,
          }
        : null;

    return {
      startedAt,
      completedCount: completed.size,
      scheduledCount: scheduled.length,
      currentChapter: toChapter(unlocked[unlocked.length - 1]),
      nextChapter: toChapter(upcoming[0]),
    };
  } catch {
    return EMPTY;
  }
}
