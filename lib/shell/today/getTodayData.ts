/**
 * Resolves the data needed by /my/today.
 *
 *   - Focus area label (from user's priority ranking)
 *   - Current lesson (first open + unlocked item, picked from the
 *     existing timeline read so we don't introduce a new query path)
 *   - Latest expert message + unread count
 *   - Last 3 completed items for the history strip
 *
 * Designed to be SAFE on a fresh account: every helper degrades to
 * null when data is missing rather than throwing. The page itself
 * decides what to show in each empty state via CMS-driven copy.
 */

import "server-only";

import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import {
  getShellTimelineEntries,
  type ShellTimelineEntry,
} from "@/lib/shell/shell-timeline";
import { journeyOwnerForUser, preferCoupleOwner } from "@/lib/journey-content/owner";
import { getViewerPriorityOrder } from "@/lib/dashboard/priority-routing";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";

import type { CurrentLessonHeroData } from "@/components/shell/today/CurrentLessonHero";
import type { ChatRowPreviewData } from "@/components/shell/today/ChatRowPreview";
import type { HistoryItem } from "@/components/shell/today/HistoryList";

export interface TodayPageData {
  /** Resolved focus label in the active locale, e.g. "מיניות ואינטימיות". */
  focusLabel: string | null;
  /** The current lesson hero card. Null when nothing is open. */
  lesson: CurrentLessonHeroData | null;
  /** Latest expert message preview. Null when there's no thread yet. */
  chat: ChatRowPreviewData | null;
  /** Recently completed lessons (newest first, ≤3). */
  history: HistoryItem[];
  /** Total completed count for the "(N)" suffix on the history link. */
  historyTotal: number;
}

interface Args {
  userId: string;
  locale: "he" | "en";
  /** Expert name (already resolved by the shell layout). Used for the
   *  chat row preview. Null = no expert assigned. */
  expertName: string | null;
  expertInitial: string;
  /** Latest expert-channel message body, already fetched once by the
   *  shell layout. /my/today shows the same preview as the sidebar so we
   *  pass it through instead of re-fetching. Null = no thread yet. */
  expertLastMessage?: string | null;
  /** ISO timestamp of the last message — drives the "X ago" stamp. */
  expertLastMessageAt?: string | null;
  /** Unread clinician-reply count, already computed for the shell badge.
   *  Surfaces directly in the chat-row "unread" affordance. */
  expertUnreadCount?: number;
}

/**
 * Friendly Hebrew "X ago" stamp. Falls back to ISO date when too old.
 * We only do Hebrew for now — English fallback returns ISO date.
 */
function relativeStamp(iso: string, hebrew: boolean): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const minutes = Math.max(1, Math.round((now - t) / 60_000));
  if (hebrew) {
    if (minutes < 60) return `לפני ${minutes} ד׳`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    const days = Math.round(hours / 24);
    if (days < 7) return `לפני ${days} ימים`;
    if (days < 30) return `לפני ${Math.round(days / 7)} שבועות`;
    return new Date(iso).toLocaleDateString("he-IL");
  }
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export async function getTodayData(args: Args): Promise<TodayPageData> {
  const {
    userId,
    locale,
    expertName,
    expertInitial,
    expertLastMessage,
    expertLastMessageAt,
    expertUnreadCount,
  } = args;
  const isHe = locale === "he";

  // ── 1. Focus label (priorities) ────────────────────────────────────
  let focusLabel: string | null = null;
  try {
    const viewerPriorities = await getViewerPriorityOrder(userId);
    const top = viewerPriorities?.[0] ?? null;
    if (top) {
      const labels = await getPriorityLabels();
      focusLabel = isHe
        ? labels.labelsHe[top] ?? null
        : labels.labelsEn[top] ?? null;
    }
  } catch (err) {
    console.warn("[today.getTodayData] focus label fetch failed", err);
  }

  // ── 2. Timeline (single source for hero + history) ─────────────────
  // 2026-05-31 — switched from `getTimelineForOwner` (~6 DB reads per
  // call × 2 axes = ~12 reads) to `getShellTimelineEntries` (~1 read per
  // axis via PostgREST embedded select). Same audience filter rules,
  // same scheduled+item+category+completion data, no responses/rules.
  const couple = await getCurrentCoupleContext();
  const legacyOwner = preferCoupleOwner(userId, couple?.couple_id ?? null);
  const cadenceOwner = await journeyOwnerForUser(userId);
  const viewerRole =
    couple?.role === "owner" || couple?.role === "partner"
      ? couple.role
      : null;

  let timeline: ShellTimelineEntry[] = [];
  try {
    const [legacy, cadence] = await Promise.all([
      getShellTimelineEntries({
        owner: legacyOwner,
        viewerCoupleRole: viewerRole,
        sourceKinds: ["program", "category", "item"],
        viewerUserId: userId,
      }),
      getShellTimelineEntries({
        owner: cadenceOwner,
        viewerCoupleRole: null,
        sourceKinds: ["cadence"],
        viewerUserId: userId,
      }),
    ]);
    timeline = [...legacy, ...cadence].sort((a, b) => {
      return (
        new Date(a.scheduled.unlock_at).getTime() -
        new Date(b.scheduled.unlock_at).getTime()
      );
    });
  } catch (err) {
    console.error("[today.getTodayData] timeline fetch failed", err);
  }

  const nowMs = Date.now();
  const openItems = timeline.filter(
    (e) =>
      new Date(e.scheduled.unlock_at).getTime() <= nowMs &&
      !e.completion?.completed_at,
  );
  const completedItems = timeline.filter((e) => !!e.completion?.completed_at);

  // Newest unlock first — so the user sees the latest thing waiting
  // (not the oldest stale one). The cadence engine usually drips one
  // item at a time so this is rarely > 1 entry.
  openItems.sort((a, b) => {
    return (
      new Date(b.scheduled.unlock_at).getTime() -
      new Date(a.scheduled.unlock_at).getTime()
    );
  });

  // ── 3. Hero (current lesson) ───────────────────────────────────────
  let lesson: CurrentLessonHeroData | null = null;
  const heroEntry = openItems[0] ?? null;
  if (heroEntry) {
    const title = isHe
      ? heroEntry.item.title_he
      : heroEntry.item.title_en || heroEntry.item.title_he;
    const categoryName = isHe
      ? heroEntry.category.name_he
      : heroEntry.category.name_en || heroEntry.category.name_he;

    // For the description we prefer the expert_insight (short, written
    // for this purpose) and fall back to the first ~180 chars of body.
    const insight = isHe
      ? heroEntry.item.expert_insight_he
      : heroEntry.item.expert_insight_en || heroEntry.item.expert_insight_he;
    const body = isHe
      ? heroEntry.item.body_he
      : heroEntry.item.body_en || heroEntry.item.body_he;
    const rawDesc = insight?.trim() || body?.trim() || "";
    // Trim to the first sentence boundary under ~200 chars, then
    // add an ellipsis if we cut mid-stream.
    const description = (() => {
      if (rawDesc.length <= 200) return rawDesc;
      const cut = rawDesc.slice(0, 200);
      const lastDot = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("·"));
      return (lastDot > 100 ? cut.slice(0, lastDot + 1) : cut.trim()) + "…";
    })();

    // "isFresh" = unlocked within the last 24 hours.
    const unlockAge = nowMs - new Date(heroEntry.scheduled.unlock_at).getTime();
    const isFresh = unlockAge < 24 * 60 * 60 * 1000;

    lesson = {
      title,
      description,
      categoryName,
      estMinutes: heroEntry.item.est_minutes ?? null,
      // Deep-link into the existing journey reader. We don't change
      // /journey/timeline/[id] in this step — it gets the shell wrapper
      // in Step 4 along with the lessons archive.
      href: `/journey/timeline/${heroEntry.scheduled.id}`,
      isFresh,
    };
  }

  // ── 4. Expert chat preview ─────────────────────────────────────────
  // 2026-05-31 — built from shell-provided data (expertLastMessage +
  // expertLastMessageAt + expertUnreadCount). The shell layout already
  // fetched these for the sidebar ExpertMini, so we don't re-query.
  // Removes 2 DB calls per /my/today render (getGeneralChannelThread +
  // getFreshClinicianReplies) — both were paying for data we already had.
  let chat: ChatRowPreviewData | null = null;
  if (expertName && expertLastMessage && expertLastMessageAt) {
    chat = {
      expertName,
      expertInitial,
      message: expertLastMessage,
      whenLabel: relativeStamp(expertLastMessageAt, isHe),
      unread: expertUnreadCount ?? 0,
      href: "/my/expert",
      online: true,
    };
  }

  // ── 5. History (last 3 completed) ──────────────────────────────────
  const historyEntries = [...completedItems].sort((a, b) => {
    const aTs = a.completion?.completed_at ?? a.scheduled.unlock_at;
    const bTs = b.completion?.completed_at ?? b.scheduled.unlock_at;
    return new Date(bTs).getTime() - new Date(aTs).getTime();
  });

  const doneLabel = isHe ? "הושלם" : "Completed";
  const history: HistoryItem[] = historyEntries.slice(0, 3).map((entry) => ({
    id: entry.scheduled.id,
    title: isHe
      ? entry.item.title_he
      : entry.item.title_en || entry.item.title_he,
    categoryName: isHe
      ? entry.category.name_he
      : entry.category.name_en || entry.category.name_he,
    whenLabel: relativeStamp(
      entry.completion?.completed_at ?? entry.scheduled.unlock_at,
      isHe,
    ),
    href: `/journey/timeline/${entry.scheduled.id}`,
    doneLabel,
  }));

  // Use the auth-session client only for a fast count of TOTAL completed
  // items. The timeline read above paginates internally so trusting it
  // for the total is OK; we just use its length to save another query.
  const historyTotal = completedItems.length;

  return {
    focusLabel,
    lesson,
    chat,
    history,
    historyTotal,
  };
}
