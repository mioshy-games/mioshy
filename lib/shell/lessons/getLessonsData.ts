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

import { getUserChapters } from "@/lib/journey-content/cycle-user";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getViewerPriorityOrder } from "@/lib/dashboard/priority-routing";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";

import type { CurrentLessonHeroData } from "@/components/shell/today/CurrentLessonHero";
import type { HistoryItem } from "@/components/shell/today/HistoryList";
import type { UpcomingItem } from "@/components/shell/lessons/UpcomingList";
import type { AssessmentRowData } from "@/components/shell/lessons/AssessmentRow";

interface Args {
  userId: string;
  locale: "he" | "en";
}

export interface LessonsPageData {
  /** 2026-05-31 — Today section now lives at the top of /my/lessons.
   *  This field carries the focus-area label ("מיניות ואינטימיות" etc.)
   *  for the FocusPill rendered above the current-lesson hero. Null when
   *  the user hasn't completed the priorities assessment yet. */
  focusLabel: string | null;
  /** Assessment rows (newest first). Always non-empty for users who
   *  finished the funnel — empty means we redirect upstream. */
  assessments: AssessmentRowData[];
  /** True once the assessment is finished — the page then drops the card to
   *  the bottom, because the chapters are what the user came for. */
  assessmentDone: boolean;
  /** Current open lesson — same shape as /my/today's hero. */
  current: CurrentLessonHeroData | null;
  /** All completed lessons, newest first. */
  completed: HistoryItem[];
  completedTotal: number;
  /** Always empty: the cycle model has no locked/upcoming state. Kept so the
   *  page contract does not change while the section is retired. */
  upcoming: UpcomingItem[];
  /** Open chapters beyond the hero — all immediately readable. */
  openRest: UpcomingItem[];
  /** C.3 — when the next (8-week) assessment is due: the assessment/join
   *  date + 8 weeks, ISO. Null when we have no base date to compute from.
   *  Rendered as a notice in the "האבחונים שלכם" section. */
  nextAssessmentAt: string | null;
}

/** 8 weeks, the cadence between recurring assessments. */
const NEXT_ASSESSMENT_WEEKS = 8;

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

  // ── Focus label (top of page, "Today" section) ─────────────────────
  // 2026-05-31 — Today's "המוקד הנוכחי" pill now lives at the top of
  // /my/lessons (the page absorbed the standalone /my/today surface).
  // Both helpers are React.cache-wrapped, so calling them here is free
  // for any peer caller that already resolved them in the same render.
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
    console.warn("[lessons.getLessonsData] focus label fetch failed", err);
  }

  // ── Assessments ────────────────────────────────────────────────────
  // We surface a single "your first assessment" row per the launch
  // state (one assessment per user). The row's subtitle bakes in the
  // completion date when we have one.
  let assessments: AssessmentRowData[] = [];
  let assessmentDone = false;
  // C.3 — base date for the "next assessment in 8 weeks" notice.
  let nextAssessmentAt: string | null = null;
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
        assessmentDone = done;
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
            // 2026-06-02 (Itzik): completed users pass ?summary=1 so
            // /journey/assessment renders AnalysisSummary instead of
            // bouncing them to /my/journey. In-flight users go to the
            // questionnaire as before.
            href: done ? "/journey/assessment?summary=1" : "/journey/assessment",
          },
        ];

        // C.3 — next assessment = assessment/join date + 8 weeks, computed
        // per-user (never hardcoded). Base on the completion stamp, falling
        // back to last activity when the journey isn't marked complete yet.
        const baseIso = j.completed_at ?? j.last_activity_at;
        if (baseIso) {
          const next = new Date(baseIso);
          next.setDate(next.getDate() + NEXT_ASSESSMENT_WEEKS * 7);
          nextAssessmentAt = next.toISOString();
        }
        // Task 29 (Itzik 2026-07-03): the recurring-assessment notice ("בעוד 8
        // שבועות נשלח אליכם אבחון נוסף") is HIDDEN until a separate approval —
        // only the full assessment + weekly chapters exist today. Force null so
        // the notice never renders; deleting this line re-enables it.
        nextAssessmentAt = null;
      }
    }
  } catch (err) {
    console.warn("[lessons.getLessonsData] assessment lookup failed", err);
  }

  // ── Timeline ───────────────────────────────────────────────────────

  // The journey_scheduled_items timeline that used to feed this page is GONE,
  // not disabled (Itzik 2026-07-31): "if we leave a second path reading the old
  // model, we are back here in a week". journey_cycle_items is the only source.

  // ── Chapters — single source of truth (Itzik 2026-07-31) ──────────
  // journey_cycle_items IS the answer to "what content does this user have".
  // The old journey_scheduled_items path is gone, not kept as a fallback: a
  // second read path is exactly how the invented "5 waiting" cards hid a
  // paying customer receiving nothing for a month.
  //
  // There is no "upcoming/locked" concept in the cycle model — every chapter
  // in a cycle is open the moment it opens. `upcoming` stays empty by design.
  const chapters = await getUserChapters(userId);

  let current: CurrentLessonHeroData | null = null;
  const top = chapters.open[0];
  if (top) {
    current = {
      title: top.title,
      description: "",
      categoryName: top.categoryName,
      estMinutes: null,
      href: `/journey/chapter/${top.cycleItemId}`,
      isFresh: false,
    };
  }

  const doneLabel = isHe ? "הושלם" : "Completed";
  const completed: HistoryItem[] = chapters.completed.map((c) => ({
    id: c.cycleItemId,
    title: c.title,
    categoryName: c.categoryName,
    whenLabel: relativeStamp(c.completedAt as string, isHe),
    href: `/journey/chapter/${c.cycleItemId}`,
    doneLabel,
  }));

  // Everything open, beyond the hero — all reachable, none locked.
  const openRest: UpcomingItem[] = chapters.open.slice(1).map((c) => ({
    id: c.cycleItemId,
    title: c.title,
    categoryName: c.categoryName,
    whenLabel: isHe ? "פתוח עכשיו" : "Open now",
    href: `/journey/chapter/${c.cycleItemId}`,
  }));

  const upcoming: UpcomingItem[] = [];

  return {
    focusLabel,
    assessmentDone,
    openRest,
    assessments,
    current,
    completed,
    completedTotal: chapters.completed.length,
    upcoming,
    nextAssessmentAt,
  };
}
