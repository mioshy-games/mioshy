/**
 * /[locale]/my/journey - "החדר הפרטי שלך"
 *
 * Post-purchase private space for an active Journey subscriber.
 *
 * What this page is NOT (anymore):
 *   - It is NOT the assessment. A paying user must NEVER land back on
 *     the questionnaire - that was the worst UX issue documented in
 *     docs/post-purchase-experience-spec.md §1.
 *   - It is NOT a marketing page. "40 questions, personal report,
 *     practical guidance" copy does not appear here.
 *
 * What this page IS (per spec §6):
 *   - A greeting tied to the user's #1 chosen priority from the ranking
 *     question of the assessment they already finished.
 *   - A "Today / Open" rail showing whatever the admin-coach has
 *     prescribed in journey_assignments. While the admin hasn't added
 *     anything yet, a default category card stands in.
 *   - A "Coming up" rail with locked placeholders so the page never
 *     looks empty even on day one.
 *   - Footer reassurance - "we'll keep you posted, just check back".
 *
 * Routing logic:
 *   - No journey subscription → redirect to /journey marketing.
 *   - Subscription but no responses yet → redirect to /journey/assessment
 *     so they actually take the assessment. (Edge case: someone paid
 *     without going through the funnel.)
 *   - Otherwise: render the private space.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import {
  buildDynamicRail,
  buildDbBackedEmptyRail,
  type RailEntry,
} from "@/lib/dashboard/journey-rail";
import {
  getViewerPriorityOrder,
  sortRailByPriorities,
} from "@/lib/dashboard/priority-routing";
import type { AssessmentStage } from "@/lib/dashboard/pillar-state";
import { JourneyDesk } from "@/components/my/JourneyDesk";
import { ClinicianReplyBanner } from "@/components/my/ClinicianReplyBanner";
import { getFreshClinicianReplies } from "@/lib/journey-content/fresh-replies";
import { SubscriptionStatusBanner } from "@/components/my/SubscriptionStatusBanner";
import { JourneyGraceBanner } from "@/components/my/JourneyGraceBanner";
import { WelcomeProcessingBanner } from "@/components/my/WelcomeProcessingBanner";
import {
  JourneyKickoffCards,
  type JourneyKickoffStartItem,
} from "@/components/my/JourneyKickoffCards";
import {
  JourneyActivityHistory,
  type JourneyActivityEntry,
} from "@/components/my/JourneyActivityHistory";
import {
  JourneyPriorityRanking,
  type PriorityItem,
} from "@/components/my/JourneyPriorityRanking";
import { GeneralChannelThread } from "@/components/my/GeneralChannelThread";
import {
  ensureUserChannel,
  getGeneralChannelThread,
} from "@/lib/journey-content/messages";
import { JourneyDashboardViewTracker } from "@/components/my/JourneyDashboardViewTracker";
import { getTimelineForOwner } from "@/lib/journey-content/queries";
import {
  journeyOwnerForUser,
  preferCoupleOwner,
} from "@/lib/journey-content/owner";
import type { JourneyOwner } from "@/lib/journey-content/types";
import { isPriorityKey, type PriorityKey } from "@/lib/journey/priorities";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "הקליניקה המכווננת שלכם" : "Your tuned clinic"}`,
    description: isHe
      ? "תוכן אישי שמותאם להעדפות שלכם, מסונן ומדורג לפי מה שחשוב לכם."
      : "Personal content tuned to your priorities and what matters most to you.",
    robots: { index: false, follow: false },
  };
}

/**
 * Pulls the user's #1 priority from the ranking response. Returns null
 * if the user hasn't answered the ranking question yet (in which case
 * the upstream redirect to /journey/assessment will handle it).
 */
async function getUserTopPriority(userId: string): Promise<{
  topPriority: PriorityKey | null;
  hasAnyResponses: boolean;
}> {
  const admin = createServiceRoleClient();
  if (!admin) return { topPriority: null, hasAnyResponses: false };

  // Find this user's most recent journey row.
  const { data: journey } = await admin
    .from("journeys")
    .select("id")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!journey?.id) return { topPriority: null, hasAnyResponses: false };

  // Pull their responses. We only need answer.kind === 'ranking' rows, but
  // we ALSO want to know if they have any responses at all (for the
  // "redirect to assessment" decision).
  const { data: responses } = await admin
    .from("journey_responses")
    .select("question_id, answer")
    .eq("journey_id", journey.id);

  if (!responses || responses.length === 0) {
    return { topPriority: null, hasAnyResponses: false };
  }

  for (const r of responses) {
    const ans = r.answer as { kind?: string; order?: unknown };
    if (ans?.kind !== "ranking") continue;
    const order = ans.order;
    if (!Array.isArray(order) || order.length === 0) continue;
    const first = order[0];
    if (typeof first !== "string") continue;
    if (isPriorityKey(first)) {
      return { topPriority: first, hasAnyResponses: true };
    }
  }

  return { topPriority: null, hasAnyResponses: true };
}

export default async function PrivateJourneyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // ── Auth + entitlement gate ───────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("[/my/journey:GATE] no user → /auth");
    redirect(`/${locale}/auth`);
  }

  const entitlements = await getUserEntitlements();
  console.log("[/my/journey:GATE] entitlements", {
    user_id: user.id,
    email: user.email,
    entitlements,
  });
  if (!entitlements) {
    console.log("[/my/journey:GATE] null entitlements → /auth");
    redirect(`/${locale}/auth`);
  }
  if (!entitlements.journey) {
    console.log(
      "[/my/journey:GATE] not entitled to journey → /journey marketing",
      { user_id: user.id, entitlements },
    );
    redirect(`/${locale}/journey`);
  }

  // ── Did they actually take the assessment? ────────────────────────────────
  const { topPriority, hasAnyResponses } = await getUserTopPriority(user.id);
  console.log("[/my/journey:GATE] assessment probe", {
    user_id: user.id,
    topPriority,
    hasAnyResponses,
  });

  // Detection of the bug we hit before: paid + signed in + assessment
  // looked complete during onboarding, but the responses table is empty
  // for this user_id (anon journey wasn't linked, or RLS blocked the
  // read). Bouncing back to /journey/assessment in this case loops the
  // user. Instead we render the page with a recovery banner - the user
  // sees their dashboard, knows their subscription is active, and gets
  // a one-click "complete the assessment" CTA. No infinite loop.
  const assessmentMissing = !hasAnyResponses;
  if (assessmentMissing) {
    console.warn(
      "[/my/journey:GATE] paid user has no responses - rendering recovery banner instead of redirecting",
      {
        user_id: user.id,
        email: user.email,
        suggestion: "verify journeys.user_id link + journey_responses RLS",
      },
    );
  }

  // Resolve the priority into bilingual labels - defaults if the user
  // skipped the ranking question. Labels come from the DB seed in
  // journey_categories (assessment_priority_key) - replaces the old
  // PRIORITY_LABELS_HE/EN constant maps.
  const priorityLabels = await getPriorityLabels();
  const focusLabel = topPriority
    ? isHe
      ? priorityLabels.labelsHe[topPriority]
      : priorityLabels.labelsEn[topPriority]
    : isHe
      ? "חיבור כללי"
      : "Connection";
  const focusDesc = topPriority
    ? isHe
      ? priorityLabels.descsHe[topPriority]
      : priorityLabels.descsEn[topPriority]
    : "";

  // ── Load admin-prescribed content ─────────────────────────────────────────
  // Anything the admin assigned via /dashboard/my-clients (the
  // SendInterventionModule writes to journey_assignments) flows
  // through here. If `getTimelineForOwner` returns rows, we render
  // them as the "Today / Open" rail; if not, the default placeholder
  // takes over.
  //
  // Owner resolution: if the user is part of a couple, prefer the
  // couple-owned timeline (admin assignments tend to live at couple
  // level). Otherwise fall back to user-owned. v3 cadence rows live
  // under a strict per-partner owner - see journeyOwnerForUser() - and
  // are merged into the legacy v2 timeline below.
  const couple = await getCurrentCoupleContext();
  const legacyOwner: JourneyOwner = preferCoupleOwner(
    user.id,
    couple?.couple_id ?? null,
  );
  const cadenceOwner: JourneyOwner = journeyOwnerForUser(user.id);
  const viewerRole =
    couple?.role === "owner" || couple?.role === "partner"
      ? couple.role
      : null;

  // v3 slice 4: TWO timeline fetches.
  //   * Legacy v2: program/category/item assignments - couple-scoped
  //     when the user is paired (preserves existing behaviour for any
  //     pre-v3 admin-assigned content).
  //   * v3 cadence: cadence-source assignments - strict per-partner so
  //     each partner has their own queue regardless of couple status.
  // The merged list drives every downstream surface (rail, activity
  // history, open/upcoming/completed buckets).
  let legacyTimeline: Awaited<ReturnType<typeof getTimelineForOwner>> = [];
  let cadenceTimeline: Awaited<ReturnType<typeof getTimelineForOwner>> = [];
  try {
    [legacyTimeline, cadenceTimeline] = await Promise.all([
      getTimelineForOwner({
        owner: legacyOwner,
        viewerUserId: user.id,
        viewerCoupleRole: viewerRole,
        sourceKinds: ["program", "category", "item"],
      }),
      getTimelineForOwner({
        owner: cadenceOwner,
        viewerUserId: user.id,
        // Cadence assignments are user-owned; the audience filter is
        // a no-op when owner.kind === 'user', so role doesn't matter.
        viewerCoupleRole: null,
        sourceKinds: ["cadence"],
      }),
    ]);
  } catch (err) {
    console.error("[/my/journey] failed to load timeline", err);
    // Non-fatal - fall through to placeholder.
  }
  // Merge by unlock_at ascending. Items from both axes appear in one
  // chronological list - the rail/buckets don't care about source.
  const timeline = [...legacyTimeline, ...cadenceTimeline].sort((a, b) => {
    const ua = new Date(a.scheduled.unlock_at).getTime();
    const ub = new Date(b.scheduled.unlock_at).getTime();
    return ua - ub;
  });

  // v3 slice 6 - load the user's general expert channel thread.
  // ensureUserChannel is a no-op upsert that creates the row on first
  // visit (so getGeneralChannelThread doesn't return an empty array
  // for users who've never opened the channel).
  await ensureUserChannel(user.id);
  const channelMessages = await getGeneralChannelThread(user.id, user.id);

  const now = Date.now();
  const openItems = timeline.filter((entry) => {
    const unlockAt = new Date(entry.scheduled.unlock_at).getTime();
    return unlockAt <= now && !entry.completion?.completed_at;
  });
  const upcomingItems = timeline.filter((entry) => {
    const unlockAt = new Date(entry.scheduled.unlock_at).getTime();
    return unlockAt > now;
  });
  const completedItems = timeline.filter(
    (entry) => !!entry.completion?.completed_at,
  );

  // ── Rail + work-area data ────────────────────────────────────────────
  // The /my/journey page is the therapeutic surface - past / present /
  // future of the work plan. Rail at the top gives the orientation,
  // WorkArea below gives the per-tab detail. Both reuse the same
  // tokens as the /my pillar cards (slate-950/40 dark glass).
  const journeyStatus = await getOwnerJourneyStatus({
    userId: user.id,
    coupleId: couple?.couple_id ?? null,
  });
  const assessmentStage: AssessmentStage = journeyStatus.hasCompletedAssessment
    ? "completed"
    : journeyStatus.hasInProgressAssessment
      ? "in_progress"
      : "not_started";
  // Empty timeline → pull the program's actual categories from the DB
  // (Phase 2 step C). The page is never empty: even before any item is
  // scheduled the user sees the program's real categories instead of
  // the hardcoded six-topic fallback. buildDbBackedEmptyRail itself
  // falls back to the hardcoded list if the DB query fails.
  const railEntriesRaw: RailEntry[] =
    timeline.length > 0
      ? buildDynamicRail({
          isHe,
          timeline,
          assessmentCompleted: journeyStatus.hasCompletedAssessment,
          viewerUserId: user.id,
          // itemSeenAt: not yet wired - until we have a seen-state
          // table, every clinician reply is considered "unread"
          // until the user clicks into the item.
        })
      : await buildDbBackedEmptyRail({
          isHe,
          assessmentStage,
        });

  // Phase 5 - adaptive ordering. Pull THIS viewer's priority ranking
  // (each partner has their own) and reorder the rail accordingly so
  // their #1 priority surfaces first. Categories whose slug isn't in
  // the priority taxonomy keep their natural position after the
  // priority block.
  const viewerPriorities = await getViewerPriorityOrder(user.id);
  // Build the rail-key → category-slug lookup from the live timeline.
  // For dynamic categories the slug comes from journey_categories;
  // for the empty/static rails we pull slugs from the bucket data.
  const categorySlugByKey = new Map<string, string | null>();
  for (const entry of timeline) {
    categorySlugByKey.set(`dyn:${entry.category.id}`, entry.category.slug ?? null);
  }
  const railEntries: RailEntry[] = sortRailByPriorities(
    railEntriesRaw,
    viewerPriorities,
    categorySlugByKey,
  );
  const railIsDynamic = timeline.length > 0;

  // Phase 2F - surface a calm banner when the clinician has replied
  // since the user's last visit. Client-side localStorage handles the
  // "since last visit" part; server fetches the latest reply only.
  const freshReplies = await getFreshClinicianReplies(user.id);

  // ── Phase 4 - dashboard data ────────────────────────────────────────
  // Activity history: derived from data we already have on the page.
  // In a follow-up phase we'll add a dedicated event-log table; for
  // now we synthesise a believable timeline from the assessment +
  // timeline + clinician replies the user has actually accumulated.
  const activityEntries: JourneyActivityEntry[] = [];
  if (hasAnyResponses) {
    activityEntries.push({
      id: "assessment_completed",
      kind: "assessment_completed",
      title: isHe ? "השלמתם את האבחון האישי" : "Assessment completed",
      detail:
        focusLabel && topPriority
          ? isHe
            ? `המוקד הראשון: ${focusLabel}`
            : `Top focus: ${focusLabel}`
          : null,
      whenIso: new Date().toISOString(),
    });
  }
  for (const entry of completedItems.slice(0, 5)) {
    const title =
      (isHe
        ? entry.item.title_he
        : entry.item.title_en || entry.item.title_he) ?? "";
    const cat =
      (isHe
        ? entry.category.name_he
        : entry.category.name_en || entry.category.name_he) ?? null;
    activityEntries.push({
      id: `done-${entry.scheduled.id}`,
      kind: "item_completed",
      title: isHe ? `סיימתם: ${title}` : `Completed: ${title}`,
      detail: cat,
      whenIso:
        entry.completion?.completed_at ?? entry.scheduled.unlock_at,
    });
  }
  // Recent unlocks for the "item_unlocked" timeline lane
  for (const entry of openItems.slice(0, 3)) {
    const title =
      (isHe
        ? entry.item.title_he
        : entry.item.title_en || entry.item.title_he) ?? "";
    activityEntries.push({
      id: `unlock-${entry.scheduled.id}`,
      kind: "item_unlocked",
      title: isHe ? `נפתח עבורכם: ${title}` : `Just opened: ${title}`,
      detail: null,
      whenIso: entry.scheduled.unlock_at,
    });
  }
  if (freshReplies.latestReplyAt) {
    activityEntries.push({
      id: `reply-${freshReplies.latestReplyAt}`,
      kind: "clinician_replied",
      title: isHe
        ? "המומחה שלכם השיב על תגובה"
        : "Your clinician replied",
      detail: null,
      whenIso: freshReplies.latestReplyAt,
    });
  }

  // Priority ranking - seeds from the user's assessment ranking when
  // available, otherwise from the canonical six topics. Server passes
  // the seed; the client component owns the reorder/add UI.
  const seededPriorities: PriorityItem[] = topPriority
    ? // Top priority first, then the rest of the canonical six
      [
        {
          id: `priority-${topPriority}`,
          label: focusLabel,
          note: focusDesc || null,
        },
        ...["communication", "intimacy", "love", "friendship", "family"]
          .filter((k) => k !== topPriority)
          .map((k) => ({
            id: `priority-${k}`,
            label:
              k === "communication"
                ? isHe ? "תקשורת זוגית" : "Communication"
                : k === "intimacy"
                  ? isHe ? "מיניות ואינטימיות" : "Intimacy"
                  : k === "love"
                    ? isHe ? "אהבה וחיבור רגשי" : "Love & emotional connection"
                    : k === "friendship"
                      ? isHe ? "חברות ושותפות יומיומית" : "Friendship & daily partnership"
                      : isHe ? "משפחה ולחצים פנימיים" : "Family & internal stress",
          })),
      ]
    : [
        { id: "p-comm", label: isHe ? "תקשורת זוגית" : "Communication" },
        { id: "p-intim", label: isHe ? "מיניות ואינטימיות" : "Intimacy" },
        { id: "p-love", label: isHe ? "אהבה וחיבור רגשי" : "Love & emotional connection" },
        { id: "p-friend", label: isHe ? "חברות ושותפות יומיומית" : "Friendship & daily partnership" },
        { id: "p-family", label: isHe ? "משפחה ולחצים פנימיים" : "Family & internal stress" },
      ];

  // Decide whether to show the "experts are reviewing" banner - only
  // for users who finished the assessment but don't yet have any
  // assigned content. It would be misleading otherwise.
  const showWelcomeProcessingBanner =
    !assessmentMissing &&
    journeyStatus.hasCompletedAssessment &&
    !journeyStatus.hasActiveAssignments;

  console.log("[/my/journey] rendered for", {
    user_id: user.id,
    legacy_owner_kind: legacyOwner.kind,
    cadence_owner_kind: cadenceOwner.kind,
    timeline_total: timeline.length,
    timeline_legacy: legacyTimeline.length,
    timeline_cadence: cadenceTimeline.length,
    rail_dynamic: railIsDynamic,
    open: openItems.length,
    upcoming: upcomingItems.length,
    completed: completedItems.length,
    recent_replies: freshReplies.recentReplyCount,
  });

  return (
    <div dir={isHe ? "rtl" : "ltr"} className="min-h-[100dvh] text-white">
      {/* Phase 2E - fire one analytics event per session when the user
          lands on the dashboard. Pure side-effect; renders nothing. */}
      <JourneyDashboardViewTracker
        hasJourneyEntitlement={true}
        hasCompletedAssessment={journeyStatus.hasCompletedAssessment}
        hasActiveAssignments={journeyStatus.hasActiveAssignments}
        timelineSize={timeline.length}
        railIsDynamic={railIsDynamic}
        freshReplyCount={freshReplies.recentReplyCount}
      />
      {/* Solid slate frame around the entire therapeutic surface - sets
          this room apart from the global gradient backdrop. Width matches
          /my (max-w-6xl) so the user sees the same canvas across pages. */}
      <div className="mx-auto mt-6 max-w-6xl px-3 sm:px-4">
        <div className="rounded-3xl border border-white/[0.06] bg-slate-950/75 px-2 pb-8 pt-2 backdrop-blur-md sm:px-4 sm:pb-10 sm:pt-4">
      <main className="mx-auto w-full px-4 pb-20 pt-10 sm:pt-14">
        {/* Breadcrumb back to /my */}
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        {/* ─────── Header ───────
            Same visual register as the rest of the redesigned surface:
            slate-toned glass, calm typography, no marketing voice. */}
        <header className="mt-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-slate-950/40 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-white/70" />
            <span className="font-semibold text-white/85">
              {isHe ? "ליווי עם מיאושי" : "Coaching with Mioshy"}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {isHe ? "הקליניקה המכווננת שלכם" : "Your tuned clinic"}
          </h1>
          <p className="mt-2 max-w-xl text-white/65">
            {isHe
              ? "תוכן שמסודר לפי מה שחשוב לכם. כל אחד רואה את השלבים בסדר שמתאים למה שביקש באבחון."
              : "Content ordered by what matters to you. Each partner sees their own ranking - your priorities lead."}
          </p>
        </header>

        {/* ─────── v3 slice 5 - grace / blocked banner ───────
            Renders nothing when the user is in 'active' state. During
            grace it's amber with a renewal CTA; on blocked it's rose.
            Sits above the existing subscription-status banner so the
            two never compete (active subs don't see grace, grace subs
            don't see "your subscription is active"). */}
        {entitlements.journeyState && entitlements.journeyState !== "active" ? (
          <section className="mt-6">
            <JourneyGraceBanner
              isHe={isHe}
              state={entitlements.journeyState}
              graceUntil={entitlements.journeyGraceUntil}
            />
          </section>
        ) : (
          /* ─────── Subscription status - explicit confirmation ───────
              A calm "your subscription is active" line when entitled,
              or a recovery banner when the assessment didn't get
              attached to this account (we don't loop back to it; the
              user controls when they restart). */
          <section className="mt-6">
            <SubscriptionStatusBanner
              isHe={isHe}
              variant={assessmentMissing ? "assessment_missing" : "active"}
            />
          </section>
        )}

        {/* ─────── Phase 2F - clinician reply banner ───────
            Calm one-liner shown when there's at least one new reply
            from the clinician since the user's last visit (tracked
            client-side via localStorage). Self-dismisses on click. */}
        {freshReplies.latestReplyAt ? (
          <section className="mt-4">
            <ClinicianReplyBanner
              isHe={isHe}
              latestReplyAt={freshReplies.latestReplyAt}
              freshCount={freshReplies.recentReplyCount}
              href={freshReplies.latestReplyHref ?? undefined}
            />
          </section>
        ) : null}

        {/* ─────── "Experts are reviewing" banner ───────
            Shown for users who completed the assessment but don't yet
            have assigned content. Stays above the desk so it doesn't
            compete with the rail/content layout below. */}
        {showWelcomeProcessingBanner ? (
          <section className="mt-6">
            {/* v2 (Itzik 2026-05-07): the banner now shows the user's
                actual top focus from their assessment ranking + an
                optional "start with the opening exercise" link when
                the day-1 override has unlocked one. firstItemHref is
                left null here because the rail+desk below already
                renders unlocked items prominently — keeping it null
                avoids duplicating a CTA. */}
            <WelcomeProcessingBanner
              isHe={isHe}
              focusLabel={topPriority ? focusLabel : null}
              firstItemHref={null}
            />
          </section>
        ) : null}

        {/* ─────── Personal-priority hint ───────
            Tells the viewer (each partner sees their OWN order) why
            the steps below are arranged the way they are. We surface
            this only when the user has actually ranked priorities. */}
        {viewerPriorities && viewerPriorities.length > 0 && topPriority ? (
          <section className="mt-6">
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-2.5 text-[13px] text-emerald-100">
              {isHe
                ? `מסודר לפי הדירוג שלך: המוקד הראשון הוא ${focusLabel}. בן/בת הזוג רואה את הסדר שלהם בנפרד.`
                : `Ordered by your ranking: top focus is ${focusLabel}. Your partner sees their own order.`}
            </p>
          </section>
        ) : null}

        {/* ─────── #66 Post-purchase kickoff cards ───────
            Two recap cards near the top of the dashboard:
            (a) assessment results — top focus + program size,
            (b) start-here — first available item from the day-1 unlock.
            Both render conditionally — the section disappears when
            neither is meaningful. */}
        {(() => {
          const first = openItems[0] ?? null;
          const startItem: JourneyKickoffStartItem | null = first
            ? {
                scheduledId: first.scheduled.id,
                title:
                  (isHe
                    ? first.item.title_he
                    : first.item.title_en || first.item.title_he) ?? "",
                categoryName:
                  (isHe
                    ? first.category.name_he
                    : first.category.name_en || first.category.name_he) ??
                  null,
                snippet:
                  (isHe
                    ? first.item.body_he
                    : first.item.body_en || first.item.body_he) ?? null,
              }
            : null;
          return (
            <JourneyKickoffCards
              isHe={isHe}
              focusLabel={topPriority ? focusLabel : null}
              focusDesc={topPriority ? focusDesc : null}
              totalItems={timeline.length}
              openItemCount={openItems.length}
              completedItemCount={completedItems.length}
              startItem={startItem}
            />
          );
        })()}

        {/* ─────── The desk - vertical rail + content panel ───────
            The rail (right in RTL, top on mobile) acts as the menu;
            clicking a step swaps the panel content on the left. The
            rail order has been re-sorted per the viewer's ranking
            (Phase 5 - sortRailByPriorities). */}
        <section className="mt-8">
          <JourneyDesk isHe={isHe} entries={railEntries} />
        </section>

        {/* ─────── Secondary dashboard ───────
            The desk above answers "what am I working on now". This
            grid answers "what's the bigger picture" - history,
            priorities, and the message channel to the clinician. */}
        <section className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <JourneyActivityHistory
              isHe={isHe}
              entries={activityEntries}
            />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <JourneyPriorityRanking
              isHe={isHe}
              initialItems={seededPriorities}
            />
            <GeneralChannelThread
              initialMessages={channelMessages}
              viewerUserId={user.id}
              isHe={isHe}
            />
          </div>
        </section>

        {/* ─────── Footer note ─────── */}
        <footer className="mt-12 border-t border-white/5 pt-6 text-center">
          <p className="text-xs text-white/40">
            {isHe
              ? "אזור פרטי. הכל פה אישי לכם בלבד."
              : "Private space. Everything here is yours alone."}
          </p>
        </footer>
      </main>
        </div>
      </div>
    </div>
  );
}
