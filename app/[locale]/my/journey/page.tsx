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
import { getOnboardingGate } from "@/lib/journey/onboarding-gate";
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
// JourneyKickoffCards import removed 2026-05-28 — section was
// removed from the render below per Itzik. Component file remains
// on disk for possible later use.
import { JourneyFirstSession } from "@/components/my/JourneyFirstSession";
import { getCoachPersonaForUser } from "@/lib/journey/coach";
import { getActiveViewAs } from "@/lib/journey/view-as";
import { ViewAsBanner } from "@/components/my/ViewAsBanner";
import { getDriftBannerForCurrentUser } from "@/lib/journey/drift-user";
import { DriftAwarenessBanner } from "@/components/my/DriftAwarenessBanner";
import { getCurrentUserPauseState } from "@/lib/billing/pause-state";
import { PausedStateScreen } from "@/components/my/PausedStateScreen";
import { getLatestRecapForCurrentUser } from "@/lib/journey/recap-read";
import { WeeklyRecapCard } from "@/components/my/WeeklyRecapCard";
import {
  getPendingMilestoneForCurrentUser,
  getMilestoneDef,
} from "@/lib/journey/milestones";
import { MilestoneRevealModal } from "@/components/my/MilestoneRevealModal";
import { generateCoupleStoryNarrative } from "@/lib/journey/story-narrative";
import { getScoreHistoryForUser } from "@/lib/journey/score-history";
import { ScoreEvolutionChart } from "@/components/my/ScoreEvolutionChart";
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
import { ensureCadenceAssignment } from "@/lib/journey-content/cadence-engine";
import { resolvePrioritiesForUser } from "@/lib/journey-content/resolve-priorities";
// 2026-05-28 — surface the assessment analysis (top scores +
// narrative + recommendations) on the dashboard. Until now the
// `journey_analysis` row was written but never displayed to the
// paying user post-funnel.
import { getLatestAnalysisForUser } from "@/lib/journey/analysis-read";
import { JourneyAnalysisCard } from "@/components/my/JourneyAnalysisCard";
import {
  journeyOwnerForUser,
  preferCoupleOwner,
} from "@/lib/journey-content/owner";
import type { JourneyOwner } from "@/lib/journey-content/types";
import { isPriorityKey, type PriorityKey } from "@/lib/journey/priorities";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "myJourney",
    page: "my",
  });
  return {
    title: `Mioshy - ${t("metaTitle")}`,
    description: t("metaDescription"),
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
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "myJourney",
    page: "my",
  });

  // ── Auth + entitlement gate ───────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("[/my/journey:GATE] no user → /auth");
    redirect(`/${locale}/auth`);
  }

  // Layer-2 view-as: when active, surface the banner AND substitute
  // every read to use the impersonated user. The coach sees the
  // user's actual dashboard (timeline, channel, priorities, score
  // history, etc.) — not their own. Writes (markFirstSessionCompleted,
  // ensureUserChannel write paths) keep `user.id` so a coach can never
  // mutate the user's profile by accident. The banner stays so
  // impersonation is always observable.
  const viewAsContext = await getActiveViewAs();
  // FU6.S3 — read substitution. Falls back to the auth user when no
  // impersonation is active, so behaviour is unchanged for normal users.
  const effectiveUserId = viewAsContext?.viewedUserId ?? user.id;
  let viewAsLabel: string | null = null;
  if (viewAsContext) {
    const adminClient = createServiceRoleClient();
    if (adminClient) {
      const { data: viewedRow } = await adminClient
        .from("profiles")
        .select("full_name, id")
        .eq("id", viewAsContext.viewedUserId)
        .maybeSingle();
      const fullName =
        (viewedRow as { full_name: string | null } | null)?.full_name ?? null;
      const { data: viewedAuth } = await adminClient.auth.admin.getUserById(
        viewAsContext.viewedUserId,
      );
      viewAsLabel =
        fullName ||
        viewedAuth.user?.email ||
        viewAsContext.viewedUserId.slice(0, 8);
    } else {
      viewAsLabel = viewAsContext.viewedUserId.slice(0, 8);
    }
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

  // ── C.2 — "complete your setup" gate ──────────────────────────────────────
  // The journey area is blocked until the user connects a partner AND finishes
  // the full assessment; both-incomplete → the /my/setup checklist is the main
  // page. Skipped under coach impersonation (view-as) so a coach can still
  // inspect a user's private journey.
  if (!viewAsContext) {
    const onboarding = await getOnboardingGate();
    if (onboarding.gated) {
      redirect(`/${locale}/my/setup`);
    }
  }

  // Layer-3 follow-up — if the user has an active pause, replace
  // the entire dashboard with a calm "you're on pause" screen.
  // This is the read-side gate; the cadence engine has its own
  // defensive guard that skips paused users from materialization.
  const pauseState = await getCurrentUserPauseState();
  if (pauseState.isActive && pauseState.pausedUntil) {
    return (
      <PausedStateScreen isHe={isHe} pausedUntil={pauseState.pausedUntil} />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // P1.2 gate (added 2026-05-24): cadence assignment + priorities.
  //
  // Runs AFTER entitlements + pause, BEFORE the first-session branch.
  // Order matters: a user with first_session set but no priorities
  // would otherwise see an empty dashboard.
  //
  // Skipped when impersonating (viewAs) so a coach can debug a user's
  // missing-priorities state without being redirected away.
  // ════════════════════════════════════════════════════════════════
  if (!viewAsContext) {
    const gateAdmin = createServiceRoleClient();
    if (gateAdmin) {
      // (a) Self-heal: paying users created before P1.1 deployed (or
      // whose Cardcom webhook race-conditioned) may not have a cadence
      // assignment. ensureCadenceAssignment is idempotent — no-op if
      // one exists.
      const { data: existingCadence } = await gateAdmin
        .from("journey_assignments")
        .select("id")
        .eq("user_id", effectiveUserId)
        .eq("source_kind", "cadence")
        .eq("is_active", true)
        .maybeSingle();

      if (!existingCadence) {
        // Self-heal anchor is NOW — not subscription.created_at.
        // Backfilled cadence assignments start dripping from "now",
        // not from the original purchase date. Otherwise users who
        // paid weeks ago would receive a burst of items they're
        // supposed to have already seen.
        // couples.started_journey_at remains untouched — anniversary
        // milestones still anchor to the original journey start.
        // New purchases via Cardcom still anchor to purchase_time
        // (handled in assignJourneyOnPurchase, not here).
        const anchor = new Date();
        const createdId = await ensureCadenceAssignment(
          effectiveUserId,
          anchor,
        );

        if (!createdId) {
          // Self-heal failed — log loudly and continue. The user will
          // see an empty state but at least we know about it. Better
          // than silent failure.
          console.error(
            "[/my/journey:GATE] self-heal FAILED — no assignment created",
            {
              user_id: effectiveUserId,
              anchor: anchor.toISOString(),
            },
          );
        } else {
          console.log("[/my/journey:GATE] self-heal cadence assignment", {
            user_id: effectiveUserId,
            created_id: createdId,
            anchor: anchor.toISOString(),
          });
        }
      }

      // (b) Lazy-resolve priorities.
      //
      //     2-step cascade — see
      //     lib/journey-content/resolve-priorities.ts:
      //       A. Row already exists with valid ranking → 'ready'
      //          (also materializes day-1 if no item exists yet —
      //          hotfix for backfilled rows).
      //       B. q_priorities response found → resolve slugs →
      //          upsert (source='assessment') → materialize day-1 →
      //          'ready'.
      //       (Default-ranking fallback was removed 2026-05-24:
      //        product rule says every user needs a real assessment.)
      //
      //     On 'needs_assessment' (no q_priorities at all) we send
      //     the user straight to the questionnaire. The /intro page
      //     was removed from the flow 2026-06-01 — it was an extra
      //     click that interrupted the funnel.
      //
      //     Idempotent; silent (no logs/alerts per product decision).
      const resolveResult = await resolvePrioritiesForUser(
        gateAdmin,
        effectiveUserId,
      );
      if (resolveResult.kind === "needs_assessment") {
        redirect(`/${locale}/journey/assessment`);
      }
      // 'ready' or 'no_program' → fall through to firstSession check.
    }
  }

  // ── Layer-1 first-session branch ─────────────────────────────────────────
  // A brand-new paying user who has not yet opened their day-1 item sees
  // a single-purpose screen with one goal: tap into that first item.
  // Once they open it, journey_first_session_completed_at flips and
  // subsequent visits render the full dashboard below.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("journey_first_session_completed_at")
    .eq("id", effectiveUserId)
    .maybeSingle();
  const firstSessionDone =
    !!(profileRow as { journey_first_session_completed_at: string | null } | null)
      ?.journey_first_session_completed_at;

  if (!firstSessionDone) {
    // Fetch the day-1 unlocked item (if any) for the assigned program.
    // We do a lightweight lookup: find the user's active assignment,
    // then the earliest scheduled item that's already unlocked.
    let firstItem: {
      scheduledId: string;
      title: string;
      bodySnippet: string | null;
      categoryName: string | null;
    } | null = null;

    const { data: anyAssignment } = await createServiceRoleClient()!
      .from("journey_assignments")
      .select("id, couple_id, user_id")
      .or(`user_id.eq.${effectiveUserId},couple_id.in.(${(await (async () => {
        // Resolve the couples this user belongs to so we can OR them
        // into the assignment query. Empty result -> just user-owned.
        const { data: cm } = await createServiceRoleClient()!
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", effectiveUserId);
        const ids = (cm ?? []).map((r) => (r as { couple_id: string }).couple_id);
        return ids.length > 0 ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
      })())})`)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyAssignment) {
      const admin = createServiceRoleClient()!;
      const nowIso = new Date().toISOString();
      const { data: scheduledRow } = await admin
        .from("journey_scheduled_items")
        .select("id, item_id")
        .eq("assignment_id", (anyAssignment as { id: string }).id)
        .lte("unlock_at", nowIso)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (scheduledRow) {
        const sr = scheduledRow as { id: string; item_id: string };
        const { data: itemRow } = await admin
          .from("journey_items")
          .select("title_he, title_en, body_he, body_en, category_id")
          .eq("id", sr.item_id)
          .maybeSingle();

        if (itemRow) {
          const ir = itemRow as {
            title_he: string;
            title_en: string | null;
            body_he: string;
            body_en: string | null;
            category_id: string;
          };
          const { data: catRow } = await admin
            .from("journey_categories")
            .select("name_he, name_en")
            .eq("id", ir.category_id)
            .maybeSingle();
          const cr = catRow as { name_he: string; name_en: string | null } | null;

          firstItem = {
            scheduledId: sr.id,
            title:
              (isHe ? ir.title_he : ir.title_en || ir.title_he) ?? "",
            bodySnippet:
              (isHe ? ir.body_he : ir.body_en || ir.body_he) ?? null,
            categoryName:
              (isHe
                ? cr?.name_he
                : cr?.name_en || cr?.name_he) ?? null,
          };
        }
      }
    }

    // Layer 2 — resolve the assigned coach's persona. Returns null
    // when the user has no couple yet, no expert assigned, or the
    // expert hasn't filled out their persona yet — JourneyFirstSession
    // falls through to its generic "your coach" copy in any of those.
    const coachPersona = await getCoachPersonaForUser(effectiveUserId);

    return (
      <>
        {viewAsContext && viewAsLabel ? (
          <ViewAsBanner viewedLabel={viewAsLabel} isHe={isHe} />
        ) : null}
        <JourneyFirstSession
          isHe={isHe}
          firstItem={firstItem}
          expertPersona={
            coachPersona
              ? {
                  displayName:
                    (isHe
                      ? coachPersona.displayNameHe
                      : coachPersona.displayNameEn) ||
                    coachPersona.displayNameHe ||
                    "",
                  avatarUrl: coachPersona.avatarUrl,
                  shortBio: isHe
                    ? coachPersona.shortBioHe
                    : coachPersona.shortBioEn,
                }
              : null
          }
        />
      </>
    );
  }

  // ── Did they actually take the assessment? ────────────────────────────────
  const { topPriority, hasAnyResponses } = await getUserTopPriority(effectiveUserId);
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
    : t("focusFallback");
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
    effectiveUserId,
    couple?.couple_id ?? null,
  );
  const cadenceOwner: JourneyOwner = journeyOwnerForUser(effectiveUserId);
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
        viewerUserId: effectiveUserId,
        viewerCoupleRole: viewerRole,
        sourceKinds: ["program", "category", "item"],
      }),
      getTimelineForOwner({
        owner: cadenceOwner,
        viewerUserId: effectiveUserId,
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
  // for users who've never opened the channel). When viewing-as we
  // skip the upsert (don't write on the user's behalf) but still
  // read their channel; if it doesn't exist yet we just see no msgs.
  if (!viewAsContext) {
    await ensureUserChannel(user.id);
  }
  const channelMessages = await getGeneralChannelThread(
    effectiveUserId,
    effectiveUserId,
  );

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
    userId: effectiveUserId,
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
          viewerUserId: effectiveUserId,
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
  const viewerPriorities = await getViewerPriorityOrder(effectiveUserId);
  // Build the rail-key → category-slug lookup from the live timeline.
  // For dynamic categories the slug comes from journey_categories;
  // for the empty/static rails we pull slugs from the bucket data.
  // (Declared early so the missing-categories pad block below can
  // extend the Map for newly-added pending entries.)
  const categorySlugByKey = new Map<string, string | null>();
  for (const entry of timeline) {
    categorySlugByKey.set(`dyn:${entry.category.id}`, entry.category.slug ?? null);
  }

  // ── Pad with pending categories (2026-05-24) ─────────────────────────
  // Restore the original "show all steps, lock the future ones" UX.
  // buildDynamicRail only emits entries for categories that have items
  // in the timeline. We now ALSO pull the program's active categories
  // and inject pending entries for any that are missing, so the rail
  // always shows the full set with locks on what hasn't started yet.
  //
  // Only runs when timeline.length > 0 (the dynamic path). For an empty
  // timeline, buildDbBackedEmptyRail above already includes every
  // active category.
  let railEntriesPadded: RailEntry[] = railEntriesRaw;
  if (timeline.length > 0) {
    const padAdmin = createServiceRoleClient();
    if (padAdmin) {
      try {
        const { data: program } = await padAdmin
          .from("journey_programs")
          .select("id")
          .eq("product_slug", "journey")
          .eq("is_active", true)
          .maybeSingle();
        const programId = (program as { id: string } | null)?.id ?? null;
        if (programId) {
          const { data: allCats } = await padAdmin
            .from("journey_categories")
            .select("id, name_he, name_en, slug, sort_order")
            .eq("program_id", programId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true });
          const cats =
            (allCats as Array<{
              id: string;
              name_he: string;
              name_en: string | null;
              slug: string | null;
              sort_order: number;
            }> | null) ?? [];
          if (cats.length > 0) {
            // Identify which category UUIDs are already represented in
            // railEntriesRaw via the "dyn:<uuid>" key shape (set by
            // buildDynamicRail line 372).
            const existingCategoryIds = new Set<string>();
            for (const entry of railEntriesRaw) {
              if (entry.key.startsWith("dyn:")) {
                existingCategoryIds.add(entry.key.slice(4));
              }
            }
            const missingEntries: RailEntry[] = [];
            for (const cat of cats) {
              if (existingCategoryIds.has(cat.id)) continue;
              missingEntries.push({
                key: `dyn:${cat.id}`,
                label: isHe ? cat.name_he : (cat.name_en || cat.name_he),
                status: "pending",
                // Matches hintFor("pending", isHe, false) in
                // journey-rail.ts:585-591 — that helper is private to
                // its module, so we duplicate the exact string here.
                hint: isHe ? "ייפתח בהמשך" : "Coming up",
                href: null,
                items: [],
              });
              // Extend the slug Map so sortRailByPriorities can route
              // this pending entry by the user's ranking too (Option X).
              categorySlugByKey.set(`dyn:${cat.id}`, cat.slug ?? null);
            }
            if (missingEntries.length > 0) {
              railEntriesPadded = [...railEntriesRaw, ...missingEntries];
            }
          }
        }
      } catch (err) {
        console.warn(
          "[/my/journey] missing-categories pad failed (non-fatal)",
          err,
        );
        // Fall through with railEntriesRaw unchanged.
      }
    }
  }

  const railEntries: RailEntry[] = sortRailByPriorities(
    railEntriesPadded,
    viewerPriorities,
    categorySlugByKey,
  );
  const railIsDynamic = timeline.length > 0;

  // Phase 2F - surface a calm banner when the clinician has replied
  // since the user's last visit. Client-side localStorage handles the
  // "since last visit" part; server fetches the latest reply only.
  const freshReplies = await getFreshClinicianReplies(effectiveUserId);

  // Layer-3 drift awareness — banner only renders when the coach
  // has actually reached out. Pure user-facing read; cron + coach
  // action keep the underlying drift_alerts row up to date.
  const driftBanner = await getDriftBannerForCurrentUser();
  // Layer-4 weekly recap — most recent one the user is allowed to see.
  // Falls through silently when no recap row exists yet.
  const latestRecap = await getLatestRecapForCurrentUser();

  // Layer-4 milestone reveal — only renders when there's a pending
  // (revealed_at IS NULL) milestone for this couple.
  const pendingMilestone = await getPendingMilestoneForCurrentUser();
  const pendingMilestoneDef = pendingMilestone
    ? getMilestoneDef(pendingMilestone.slug)
    : null;

  // FU6.S5 — build the "your story so far" narrative for the
  // ten/twenty thresholds. Returns null when the milestone doesn't
  // qualify or there's not enough data yet — the modal hides the
  // CTA in that case.
  let pendingMilestoneStory: Awaited<
    ReturnType<typeof generateCoupleStoryNarrative>
  > = null;
  if (
    pendingMilestone &&
    (pendingMilestone.slug === "ten_items" ||
      pendingMilestone.slug === "twenty_items")
  ) {
    pendingMilestoneStory = await generateCoupleStoryNarrative({
      coupleId:  couple?.couple_id ?? null,
      userId:    effectiveUserId,
      isHe,
      threshold: pendingMilestone.slug === "ten_items" ? 10 : 20,
    });
  }

  // Layer-4 score evolution chart — visible after the user has had
  // at least two analysis rows (i.e. after a retake). Renders nothing
  // for week-1 users.
  const scoreHistory = await getScoreHistoryForUser(effectiveUserId);

  // 2026-05-28 — Latest computed assessment analysis. The row was
  // already being written on assessment completion (api/journey/answer
  // → journey_analysis INSERT) but no dashboard surface read it.
  // Loaded once here and passed into JourneyAnalysisCard below;
  // returns null for users who finished anonymously and never relinked
  // their row, in which case the card hides itself.
  const latestAnalysis = await getLatestAnalysisForUser(effectiveUserId);

  // Layer-5 — surface the "together" link only when the user is
  // actually paired. Solo users never see it.
  const isPaired = !!couple?.couple_id;
  const coachPersonaForBanner = await getCoachPersonaForUser(effectiveUserId);
  const coachNameForBanner = coachPersonaForBanner
    ? (isHe
        ? coachPersonaForBanner.displayNameHe
        : coachPersonaForBanner.displayNameEn) ||
      coachPersonaForBanner.displayNameHe
    : null;

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
      title: t("assessmentCompleted"),
      detail:
        focusLabel && topPriority
          ? t("activityAssessmentDetail").replace("{focusLabel}", focusLabel)
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
      title: t("activityCompleted").replace("{title}", title),
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
      title: t("activityJustOpened").replace("{title}", title),
      detail: null,
      whenIso: entry.scheduled.unlock_at,
    });
  }
  if (freshReplies.latestReplyAt) {
    activityEntries.push({
      id: `reply-${freshReplies.latestReplyAt}`,
      kind: "clinician_replied",
      title: t("activityClinicianReplied"),
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
                ? t("priorityCommunication")
                : k === "intimacy"
                  ? t("priorityIntimacy")
                  : k === "love"
                    ? t("priorityLove")
                    : k === "friendship"
                      ? t("priorityFriendship")
                      : t("priorityFamily"),
          })),
      ]
    : [
        { id: "p-comm", label: t("priorityCommunication") },
        { id: "p-intim", label: t("priorityIntimacy") },
        { id: "p-love", label: t("priorityLove") },
        { id: "p-friend", label: t("priorityFriendship") },
        { id: "p-family", label: t("priorityFamily") },
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
    <div
      dir={isHe ? "rtl" : "ltr"}
      // 2026-05-23 — overflow-x-hidden added. Without it, any child that
      // accidentally exceeds the viewport width turns the WHOLE page
      // into a horizontal scroll area — especially nasty under RTL on
      // Safari iOS, where the scroll direction flips and Safari shows
      // a sliver of the next-section background bleeding from the side.
      // Belt-and-suspenders: even after fixing the JourneyDesk /
      // JourneyProgressRail overflows in the same commit, this acts as
      // a guard against future regressions.
      className="min-h-[100dvh] overflow-x-hidden text-white"
    >
      {viewAsContext && viewAsLabel ? (
        <ViewAsBanner viewedLabel={viewAsLabel} isHe={isHe} />
      ) : null}
      {pendingMilestone && pendingMilestoneDef ? (
        <MilestoneRevealModal
          isHe={isHe}
          milestoneId={pendingMilestone.id}
          slug={pendingMilestone.slug}
          def={pendingMilestoneDef}
          storyNarrative={pendingMilestoneStory}
        />
      ) : null}
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
      {/* 2026-05-23 — was `px-4` flat. iPhone SE (375px) had only
          343px of useful width inside the page wrapper. Tightened to
          px-3 on base for one extra column of breathing room, then
          back up to px-4/px-6 on larger viewports. */}
      <main className="mx-auto w-full px-3 pb-20 pt-10 sm:px-4 sm:pt-14 md:px-6">
        {/* Breadcrumb back to /my */}
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          <CmsText cmsKey="myJourney.backToMyMioshy" />
        </Link>

        {/* ─────── Header ───────
            Same visual register as the rest of the redesigned surface:
            slate-toned glass, calm typography, no marketing voice. */}
        <header className="mt-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-slate-950/40 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-white/70" />
            <span className="font-semibold text-white/85">
              <CmsText cmsKey="myJourney.coachingEyebrow" />
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <CmsText cmsKey="myJourney.pageHeading" />
          </h1>
          <CmsText
            cmsKey="myJourney.headerLede"
            as="p"
            className="mt-2 max-w-xl text-white/65"
          />
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

        {/* Layer-3 drift awareness banner — surfaces only after the
            coach has actually reached out. Stays subtle. */}
        {driftBanner ? (
          <DriftAwarenessBanner
            isHe={isHe}
            coachName={coachNameForBanner}
            daysSilent={driftBanner.daysSilent}
          />
        ) : null}

        {/* Layer-4 weekly recap — auto-generated by the Sunday cron.
            Auto-hides when no recap row exists (week-1 users). */}
        {latestRecap ? (
          <WeeklyRecapCard
            isHe={isHe}
            weekStarting={latestRecap.weekStarting}
            summaryHe={latestRecap.summaryHe}
            summaryEn={latestRecap.summaryEn}
            notableSignals={
              latestRecap.notableSignals as {
                items_completed?:    number;
                responses_posted?:   number;
                reactions_received?: number;
                expert_replies?:     number;
                top_item_title?:     string | null;
              }
            }
          />
        ) : null}

        {/* Layer-5 — paired users get a soft link to the shared "we"
            surface. Solo users never see this. */}
        {isPaired ? (
          <Link
            href="/my/journey/together"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#B83C4D]/30 bg-[#B83C4D]/[0.06] px-4 py-3 transition hover:bg-[#B83C4D]/[0.10]"
          >
            <div className="min-w-0">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
                <CmsText cmsKey="myJourney.sharedSpace" />
              </div>
              <CmsText
                cmsKey="myJourney.sharedSpaceBody"
                as="p"
                className="mt-1 text-[14px] leading-snug text-white/75"
              />
            </div>
            <Arrow className="h-4 w-4 shrink-0 text-white/55" />
          </Link>
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
              {t("priorityHintTemplate").replace("{focusLabel}", focusLabel)}
            </p>
          </section>
        ) : null}

        {/* #66 Kickoff cards (AssessmentRecapCard + StartHereCard)
            removed 2026-05-28 per Itzik — both cards duplicated content
            already surfaced elsewhere on the dashboard:
              • AssessmentRecapCard's "top focus + program size" → now
                lives inside the new JourneyAnalysisCard below.
              • StartHereCard's day-1 item title/body/CTA → renders
                inside the JourneyDesk panel below, where the user has
                full media + sibling items + conversation thread.
            Showing the same item twice (in the kickoff card AND in
            the Desk) felt confusing once the Desk became the primary
            work surface. The component file + CMS keys remain on disk
            so the kickoff section can be reinstated by uncommenting
            the original IIFE in git history. */}

        {/* ─────── Assessment analysis card (2026-05-28) ───────
            Compact post-purchase read of the user's journey_analysis
            row. Self-hides when the analysis hasn't been computed
            yet (anonymous-flow link races, etc.). Sits above the
            desk so a returning paying user sees their actual
            assessment output before the work plan. */}
        <JourneyAnalysisCard
          analysis={latestAnalysis}
          isHe={isHe}
          focusLabel={topPriority ? focusLabel : null}
        />

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
              viewerUserId={effectiveUserId}
              isHe={isHe}
            />
          </div>
        </section>

        {/* ─────── Score cards (v2 2026-05-22) ───────
            Moved here from above WeeklyRecap — at the bottom of the
            dashboard the cards act as a summary glance rather than a
            primary surface. Gate relaxed to length>=1 so the new
            card design shows a baseline state on the first
            measurement (the old SVG line chart needed >=2 to draw a
            line; the cards just show "ממתינים למדידה נוספת" until a
            second measurement lands). */}
        {scoreHistory.length >= 1 ? (
          <section className="mt-10">
            <ScoreEvolutionChart isHe={isHe} points={scoreHistory} />
          </section>
        ) : null}

        {/* ─────── Footer note ─────── */}
        <footer className="mt-12 border-t border-white/5 pt-6 text-center">
          <CmsText
            cmsKey="myJourney.footerNote"
            as="p"
            className="text-xs text-white/40"
          />
        </footer>
      </main>
        </div>
      </div>
    </div>
  );
}
