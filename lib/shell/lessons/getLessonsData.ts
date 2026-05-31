/**
 * Resolves data for /my/lessons.
 *
 * Section order matches Studio v12 #2:
 *   1. Assessments — one entry per assessment the user took.
 *   2. Current lesson (the same hero used on /my/today, in compact form).
 *   3. Completed — full list, newest first.
 *   4. Upcoming — locked items the cadence engine has scheduled.
 *
 * Reuses the same `getTimelineForOwner` pair the today page uses; the
 * timeline is naturally rich enough to feed all four sections without
 * additional reads.
 */

import "server-only";

import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import {
  getShellTimelineEntries,
  type ShellTimelineEntry,
} from "@/lib/shell/shell-timeline";
import { journeyOwnerForUser, preferCoupleOwner } from "@/lib/journey-content/owner";
import { createServiceRoleClient } from "@/lib/supabase-admin";

import type { CurrentLessonHeroData } from "@/components/shell/today/CurrentLessonHero";
import type { HistoryItem } from "@/components/shell/today/HistoryList";
import type { UpcomingItem } from "@/components/shell/lessons/UpcomingList";
import type { AssessmentRowData } from "@/components/shell/lessons/AssessmentRow";

/**
 * Pull up to 5 items from the canonical journey curriculum to show as
 * disabled "previews" in the בקרוב section. Used only when the user's
 * actual timeline has no scheduled future items — gives them a sense
 * of "what's next" without claiming a delivery date.
 *
 * Selection logic:
 *   1. Resolve the canonical journey program (product_slug='journey').
 *   2. Fetch active items joined with their category names, ordered
 *      by sort_order ascending.
 *   3. Exclude items that already appear in the timeline (by id),
 *      so previews never duplicate something the user has already
 *      seen / completed.
 *
 * Returns empty array on any failure — caller treats this as "no
 * preview to show" and falls back to the static empty state.
 */
async function getUpcomingPreviewItems(args: {
  excludeItemIds: Set<string>;
  locale: "he" | "en";
  isHe: boolean;
}): Promise<UpcomingItem[]> {
  try {
    const admin = createServiceRoleClient();
    if (!admin) return [];

    const { data: program } = await admin
      .from("journey_programs")
      .select("id")
      .eq("product_slug", "journey")
      .eq("is_active", true)
      .maybeSingle();
    const programId = (program as { id: string } | null)?.id;
    if (!programId) return [];

    // We over-fetch (5 + exclude buffer) so post-filtering by
    // already-seen item ids still leaves 5. 20 is a generous ceiling
    // — the early/middle catalogue rarely has more than a few stale
    // entries per user.
    const { data: items } = await admin
      .from("journey_items")
      .select("id, title_he, title_en, category_id, sort_order")
      .eq("is_active", true)
      .in(
        "category_id",
        // Subquery substitute: fetch all category ids for the program
        // in one shot, then `.in()` filter. Two queries vs a join, but
        // mirrors the pattern used elsewhere in lib/journey-content.
        (
          await admin
            .from("journey_categories")
            .select("id")
            .eq("program_id", programId)
            .eq("is_active", true)
        ).data?.map((c) => (c as { id: string }).id) ?? [],
      )
      .order("sort_order", { ascending: true })
      .limit(20);
    const rows = (items ?? []) as Array<{
      id: string;
      title_he: string;
      title_en: string | null;
      category_id: string;
      sort_order: number;
    }>;

    const filtered = rows.filter((r) => !args.excludeItemIds.has(r.id));
    if (filtered.length === 0) return [];
    const head = filtered.slice(0, 5);

    // Resolve category names for the items we picked.
    const catIds = Array.from(new Set(head.map((r) => r.category_id)));
    const { data: catsData } = await admin
      .from("journey_categories")
      .select("id, name_he, name_en")
      .in("id", catIds);
    const catMap = new Map<string, { name_he: string; name_en: string | null }>();
    for (const c of (catsData ?? []) as Array<{
      id: string;
      name_he: string;
      name_en: string | null;
    }>) {
      catMap.set(c.id, { name_he: c.name_he, name_en: c.name_en });
    }

    return head.map((r) => {
      const cat = catMap.get(r.category_id);
      const title = args.isHe ? r.title_he : r.title_en || r.title_he;
      const categoryName = cat
        ? args.isHe
          ? cat.name_he
          : cat.name_en || cat.name_he
        : null;
      return {
        // Prefix preview ids so they never collide with scheduled-item
        // ids. UpcomingList renders these as non-interactive static
        // rows (cursor:not-allowed, no link).
        id: `preview:${r.id}`,
        title,
        categoryName,
        whenLabel: args.isHe ? "בקרוב במסע" : "Coming soon",
        href: "/journey",
        disabled: true,
      };
    });
  } catch (err) {
    console.warn("[lessons.getUpcomingPreviewItems] failed", err);
    return [];
  }
}

interface Args {
  userId: string;
  locale: "he" | "en";
}

export interface LessonsPageData {
  /** Assessment rows (newest first). Always non-empty for users who
   *  finished the funnel — empty means we redirect upstream. */
  assessments: AssessmentRowData[];
  /** Current open lesson — same shape as /my/today's hero. */
  current: CurrentLessonHeroData | null;
  /** All completed lessons, newest first. */
  completed: HistoryItem[];
  completedTotal: number;
  /** Locked / upcoming lessons, oldest first (closest to unlock). */
  upcoming: UpcomingItem[];
}

function relativeStamp(iso: string, hebrew: boolean): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((t - now) / 60_000);
  // future
  if (diff > 0) {
    if (diff < 60) return hebrew ? `בעוד ${diff} ד׳` : `in ${diff}m`;
    const hours = Math.round(diff / 60);
    if (hours < 24) return hebrew ? `בעוד ${hours} שעות` : `in ${hours}h`;
    const days = Math.round(hours / 24);
    if (days === 1) return hebrew ? "ייפתח מחר" : "Opens tomorrow";
    if (days < 7) return hebrew ? `ייפתח בעוד ${days} ימים` : `Opens in ${days} days`;
    return new Date(iso).toLocaleDateString(hebrew ? "he-IL" : "en-GB");
  }
  // past
  const minutes = Math.max(1, Math.abs(diff));
  if (minutes < 60) return hebrew ? `לפני ${minutes} ד׳` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hebrew ? `לפני ${hours} שעות` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return hebrew ? `לפני ${days} ימים` : `${days}d ago`;
  if (days < 30) return hebrew ? `לפני ${Math.round(days / 7)} שבועות` : `${Math.round(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(hebrew ? "he-IL" : "en-GB");
}

export async function getLessonsData(args: Args): Promise<LessonsPageData> {
  const { userId, locale } = args;
  const isHe = locale === "he";

  // ── Assessments ────────────────────────────────────────────────────
  // We surface a single "your first assessment" row per the launch
  // state (one assessment per user). The row's subtitle bakes in the
  // completion date when we have one.
  let assessments: AssessmentRowData[] = [];
  try {
    const admin = createServiceRoleClient();
    if (admin) {
      const { data: journey } = await admin
        .from("journeys")
        .select("id, status, completed_at, last_activity_at")
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const j = journey as
        | {
            id: string;
            status: string;
            completed_at: string | null;
            last_activity_at: string | null;
          }
        | null;
      if (j) {
        const done = j.status === "complete" || j.status === "completed";
        const stamp =
          j.completed_at ?? j.last_activity_at ?? new Date().toISOString();
        const datePart = new Date(stamp).toLocaleDateString(
          isHe ? "he-IL" : "en-GB",
          { day: "numeric", month: "long" },
        );
        const subtitle = done
          ? isHe
            ? `${datePart} · סיכום מלא + 5 ציונים`
            : `${datePart} · Full summary + 5 scores`
          : isHe
            ? `התחיל ב-${datePart} · המשיכו במקום שעצרתם`
            : `Started ${datePart} · Pick up where you left off`;
        assessments = [
          {
            id: j.id,
            title: isHe ? "האבחון הראשון שלכם" : "Your first assessment",
            subtitle,
            // Route to the existing analysis surface (/journey/assessment
            // detects complete + subscribed and renders the summary).
            href: done ? "/journey/assessment" : "/journey/assessment",
          },
        ];
      }
    }
  } catch (err) {
    console.warn("[lessons.getLessonsData] assessment lookup failed", err);
  }

  // ── Timeline ───────────────────────────────────────────────────────
  const couple = await getCurrentCoupleContext();
  const legacyOwner = preferCoupleOwner(userId, couple?.couple_id ?? null);
  const cadenceOwner = journeyOwnerForUser(userId);
  const viewerRole =
    couple?.role === "owner" || couple?.role === "partner"
      ? couple.role
      : null;

  // 2026-05-31 — replaced `getTimelineForOwner` (×2 axes × 6 reads each)
  // with `getShellTimelineEntries` (×2 axes × 1 embedded select). Same
  // visibility rules; we no longer load responses/rules/status because
  // /my/lessons doesn't render them.
  let timeline: ShellTimelineEntry[] = [];
  try {
    const [legacy, cadence] = await Promise.all([
      getShellTimelineEntries({
        owner: legacyOwner,
        viewerCoupleRole: viewerRole,
        sourceKinds: ["program", "category", "item"],
      }),
      getShellTimelineEntries({
        owner: cadenceOwner,
        viewerCoupleRole: null,
        sourceKinds: ["cadence"],
      }),
    ]);
    timeline = [...legacy, ...cadence];
  } catch (err) {
    console.error("[lessons.getLessonsData] timeline fetch failed", err);
  }

  const nowMs = Date.now();
  const openItems = timeline
    .filter(
      (e) =>
        new Date(e.scheduled.unlock_at).getTime() <= nowMs &&
        !e.completion?.completed_at,
    )
    .sort(
      (a, b) =>
        new Date(b.scheduled.unlock_at).getTime() -
        new Date(a.scheduled.unlock_at).getTime(),
    );

  const completedItems = timeline
    .filter((e) => !!e.completion?.completed_at)
    .sort((a, b) => {
      const aTs = a.completion?.completed_at ?? a.scheduled.unlock_at;
      const bTs = b.completion?.completed_at ?? b.scheduled.unlock_at;
      return new Date(bTs).getTime() - new Date(aTs).getTime();
    });

  const upcomingItems = timeline
    .filter((e) => new Date(e.scheduled.unlock_at).getTime() > nowMs)
    .sort(
      (a, b) =>
        new Date(a.scheduled.unlock_at).getTime() -
        new Date(b.scheduled.unlock_at).getTime(),
    );

  // ── Current lesson (hero) ──────────────────────────────────────────
  let current: CurrentLessonHeroData | null = null;
  const top = openItems[0];
  if (top) {
    const title = isHe ? top.item.title_he : top.item.title_en || top.item.title_he;
    const categoryName = isHe
      ? top.category.name_he
      : top.category.name_en || top.category.name_he;
    const insight = isHe
      ? top.item.expert_insight_he
      : top.item.expert_insight_en || top.item.expert_insight_he;
    const body = isHe ? top.item.body_he : top.item.body_en || top.item.body_he;
    const rawDesc = insight?.trim() || body?.trim() || "";
    const description =
      rawDesc.length <= 200
        ? rawDesc
        : (() => {
            const cut = rawDesc.slice(0, 200);
            const lastDot = Math.max(
              cut.lastIndexOf("."),
              cut.lastIndexOf("·"),
            );
            return (lastDot > 100 ? cut.slice(0, lastDot + 1) : cut.trim()) + "…";
          })();
    const unlockAge = nowMs - new Date(top.scheduled.unlock_at).getTime();
    current = {
      title,
      description,
      categoryName,
      estMinutes: top.item.est_minutes ?? null,
      href: `/journey/timeline/${top.scheduled.id}`,
      isFresh: unlockAge < 24 * 60 * 60 * 1000,
    };
  }

  // ── Completed list ─────────────────────────────────────────────────
  const doneLabel = isHe ? "הושלם" : "Completed";
  const completed: HistoryItem[] = completedItems.map((entry) => ({
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

  // ── Upcoming list ──────────────────────────────────────────────────
  const upcoming: UpcomingItem[] = upcomingItems.map((entry) => ({
    id: entry.scheduled.id,
    title: isHe
      ? entry.item.title_he
      : entry.item.title_en || entry.item.title_he,
    categoryName: isHe
      ? entry.category.name_he
      : entry.category.name_en || entry.category.name_he,
    whenLabel: relativeStamp(entry.scheduled.unlock_at, isHe),
    href: `/journey/timeline/${entry.scheduled.id}`,
  }));

  // ── Preview "what's coming" when no real upcoming items exist ─────
  // The shell promised users a 5-item preview of upcoming curriculum.
  // We only run this fallback when the timeline has no scheduled future
  // items — otherwise we'd duplicate what the user already sees above.
  // Items already present anywhere in the timeline (completed, open,
  // upcoming) are excluded so we don't preview something the user has
  // already encountered.
  if (upcoming.length === 0) {
    const excludeItemIds = new Set<string>();
    for (const entry of timeline) {
      const itemId = (entry.item as { id?: string }).id;
      if (itemId) excludeItemIds.add(itemId);
    }
    const previews = await getUpcomingPreviewItems({
      excludeItemIds,
      locale,
      isHe,
    });
    upcoming.push(...previews);
  }

  return {
    assessments,
    current,
    completed,
    completedTotal: completedItems.length,
    upcoming,
  };
}
