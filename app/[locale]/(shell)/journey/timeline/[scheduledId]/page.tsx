/**
 * /journey/timeline/[scheduledId] — single-lesson detail (shell-wrapped).
 *
 * 2026-05-31 — moved into the (shell) route group so the sidebar +
 * mobile tabs + brand backdrop persist while the user reads a lesson.
 * Previously this page lived under `app/[locale]/journey/timeline/...`
 * with its own marketing-style header (breadcrumb + aurora blobs),
 * which broke the "stay inside the menu" UX promise.
 *
 * Behaviour preserved verbatim from the old page:
 *   • Auth + pause + view-as gates.
 *   • Ownership gate (user-owned OR couple member).
 *   • Audience gate (couple-targeted rows hidden from the other partner).
 *   • Locked-item bounce back to /journey/timeline.
 *   • LessonView (9-block) + ItemDetailClient (legacy fields) + WhyThisItem
 *     + AssessmentItemForm + ItemFeedbackBar + PerItemThread.
 *
 * What's new:
 *   • Replaces the marketing breadcrumb header with the shell PageHeader.
 *   • Drops the aurora blob CSS — shell already paints a brand backdrop.
 *   • Container collapses to the shell's standard 880px column.
 *   • getShellData() supplies the crumb + notification bell.
 */

import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import { Compass } from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { deriveStatus, isOpenable } from "@/lib/journey-content/status";
import { logActivity } from "@/lib/journey/activity";
import type {
  JourneyAssignment,
  JourneyCategory,
  JourneyItem,
  JourneyItemCompletion,
  JourneyItemResponse,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";
import { ItemDetailClient } from "@/components/journey/timeline/ItemDetailClient";
import { LessonView } from "@/components/journey/timeline/LessonView";
import { WhyThisItem } from "@/components/journey/timeline/WhyThisItem";
import { ItemFeedbackBar } from "@/components/journey/timeline/ItemFeedbackBar";
import { markFirstSessionCompleted } from "@/app/actions/journey-first-session";
import { getCurrentUserPauseState } from "@/lib/billing/pause-state";
import { getActiveViewAs } from "@/lib/journey/view-as";
import { ViewAsBanner } from "@/components/my/ViewAsBanner";
import { PerItemThread } from "@/components/journey/timeline/PerItemThread";
import { getPerItemThread } from "@/lib/journey-content/messages";
import { AssessmentItemForm } from "@/components/my/AssessmentItemForm";

import { PageHeader } from "@/components/shell/PageHeader";
import { getShellData } from "@/lib/shell/getShellData";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export async function generateMetadata({
  params,
}: {
  params: { locale: string; scheduledId: string };
}) {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "journeyTimeline.itemPage",
    page: "journey",
  });
  return {
    title: `Mioshy - ${t("metaTitle")}`,
    robots: { index: false, follow: false },
  };
}

export default async function JourneyTimelineItemPage({
  params,
}: {
  params: { locale: string; scheduledId: string };
}) {
  const { locale, scheduledId } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const isHe = locale === "he";
  const cmsRows = await loadCmsTextsForPage("journey");
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "journeyTimeline.itemPage",
    page: "journey",
  });
  const threadPromptLabel = t("threadPromptLabel");

  // Shell identity for the PageHeader (crumb + bell). Same React.cache'd
  // resolver every other shell page uses — free on cache hit.
  const shellPage = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "appShell",
    page: "app-shell",
  });
  const shell = await getShellData({ locale: isHe ? "he" : "en" });
  if (!shell) redirect(`/${locale}/auth`);

  // ── Auth ─────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  // L3 follow-up — paused subscriptions hide content surfaces.
  const pauseState = await getCurrentUserPauseState();
  if (pauseState.isActive) redirect(`/${locale}/my/journey`);

  // FU6.S3 — view-as substitution.
  const viewAsContext = await getActiveViewAs();
  const effectiveUserId = viewAsContext?.viewedUserId ?? user.id;

  // ── Load scheduled + assignment ─────────────────────────────────────
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const { data: scheduledRow } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", scheduledId)
    .maybeSingle();
  if (!scheduledRow) notFound();
  const scheduled = scheduledRow as JourneyScheduledItem;

  const { data: assignmentRow } = await admin
    .from("journey_assignments")
    .select("*")
    .eq("id", scheduled.assignment_id)
    .maybeSingle();
  if (!assignmentRow) notFound();
  const assignment = assignmentRow as JourneyAssignment;

  // ── Ownership gate ──────────────────────────────────────────────────
  let ownedByMe = false;
  let viewerCoupleRole: "owner" | "partner" | null = null;
  if (assignment.user_id && assignment.user_id === effectiveUserId) {
    ownedByMe = true;
  } else if (assignment.couple_id) {
    const { data: membership } = await admin
      .from("couple_members")
      .select("couple_id, role")
      .eq("couple_id", assignment.couple_id)
      .eq("user_id", effectiveUserId)
      .maybeSingle();
    if (membership) {
      ownedByMe = true;
      viewerCoupleRole =
        ((membership as { role: string }).role as "owner" | "partner") ?? null;
    }
  }
  if (!ownedByMe) notFound();

  // Audience gate — partner-targeted rows bounce back to /my/lessons.
  if (
    assignment.couple_id &&
    scheduled.audience !== "both" &&
    scheduled.audience !== viewerCoupleRole
  ) {
    redirect(`/${locale}/my/lessons`);
  }

  if (!assignment.is_active) {
    redirect(`/${locale}/my/lessons`);
  }

  // ── Item + category + completion + responses + match rule + feedback ──
  const [
    itemRes,
    completionRes,
    responsesRes,
    matchRuleRes,
    myFeedbackRes,
  ] = await Promise.all([
    admin.from("journey_items").select("*").eq("id", scheduled.item_id).maybeSingle(),
    admin
      .from("journey_item_completions")
      .select("*")
      .eq("scheduled_item_id", scheduledId)
      .maybeSingle(),
    admin
      .from("journey_item_responses")
      .select("*")
      .eq("scheduled_item_id", scheduledId)
      .order("created_at", { ascending: true }),
    scheduled.matched_by_rule_id
      ? admin
          .from("journey_match_rules")
          .select("id, slug, rationale_he, rationale_en")
          .eq("id", scheduled.matched_by_rule_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("journey_item_feedback")
      .select("rating")
      .eq("scheduled_item_id", scheduledId)
      .eq("user_id", effectiveUserId)
      .maybeSingle(),
  ]);

  if (!itemRes.data) notFound();
  const item = itemRes.data as JourneyItem;

  const { data: categoryRow } = await admin
    .from("journey_categories")
    .select("id, name_he, name_en, slug")
    .eq("id", item.category_id)
    .maybeSingle();
  const category =
    (categoryRow as Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug"> | null) ??
    null;

  const completion =
    (completionRes.data as JourneyItemCompletion | null) ?? null;

  const responses = ((responsesRes.data ?? []) as JourneyItemResponse[]).filter(
    (r) => !r.is_private || r.user_id === effectiveUserId,
  );

  const threadMessages = await getPerItemThread(scheduled.id, effectiveUserId);

  const myExistingResponse =
    item.kind === "assessment"
      ? responses
          .filter((r) => r.user_id === effectiveUserId)
          .sort((a, b) =>
            (b.created_at ?? "").localeCompare(a.created_at ?? ""),
          )[0]
      : null;

  const status = deriveStatus({
    unlockAt: scheduled.unlock_at,
    hasCompletion: !!completion,
  });

  if (!isOpenable(status)) {
    redirect(`/${locale}/my/lessons`);
  }

  if (!viewAsContext) {
    await logActivity({
      userId: user.id,
      coupleId: assignment.couple_id ?? null,
      scheduledItemId: scheduled.id,
      verb: "item_opened",
    });

    await markFirstSessionCompleted().catch((err) => {
      console.warn(
        "[/journey/timeline/scheduledId] markFirstSessionCompleted failed (non-fatal)",
        err,
      );
    });
  }

  // Resolve view-as label for the banner.
  let viewAsLabel: string | null = null;
  if (viewAsContext) {
    const { data: viewedRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", viewAsContext.viewedUserId)
      .maybeSingle();
    const fullName =
      (viewedRow as { full_name: string | null } | null)?.full_name ?? null;
    viewAsLabel = fullName || viewAsContext.viewedUserId.slice(0, 8);
  }

  const categoryName = category
    ? isHe
      ? category.name_he
      : category.name_en ?? category.name_he
    : null;

  const itemTitle = isHe
    ? item.title_he
    : item.title_en || item.title_he;

  return (
    <CmsTextProvider rows={cmsRows}>
      {viewAsContext && viewAsLabel ? (
        <ViewAsBanner viewedLabel={viewAsLabel} isHe={isHe} />
      ) : null}

      <PageHeader
        rootLabel={shellPage("rootCrumb")}
        pageLabel={itemTitle}
        subLine={categoryName}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-5 py-6">
        {/* Category + source chip — kept as a thin meta line so users
            know where this lesson sits in the curriculum. */}
        <div
          className="flex flex-wrap items-center gap-2 text-[13px]"
          style={{ color: "var(--shell-text-3)" }}
        >
          <Compass className="h-3.5 w-3.5" style={{ color: "var(--shell-pink-text)" }} />
          {categoryName ? (
            <span>{categoryName}</span>
          ) : (
            <CmsText cmsKey="journeyTimeline.itemPage.chapterFallback" />
          )}
          {scheduled.source === "expert_push" ? (
            <CmsText
              cmsKey="journeyTimeline.itemPage.expertPushBadge"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100"
            />
          ) : null}
        </div>

        {/* Assessment-kind items render the structured form ABOVE the
            standard detail block (same logic as before). */}
        {item.kind === "assessment" && item.assessment_payload ? (
          <AssessmentItemForm
            isHe={isHe}
            scheduledItemId={scheduled.id}
            payload={item.assessment_payload}
            initialAnswers={myExistingResponse?.structured_answer ?? undefined}
            initialSummary={myExistingResponse?.response_text}
            initialPrivate={myExistingResponse?.is_private}
          />
        ) : null}

        {/* "Why this item?" disclosure. */}
        <WhyThisItem
          isHe={isHe}
          rationale={
            matchRuleRes.data
              ? isHe
                ? (matchRuleRes.data as { rationale_he: string }).rationale_he
                : (matchRuleRes.data as { rationale_en: string }).rationale_en
              : null
          }
        />

        {/* LessonView for the structured 9-block lesson. */}
        {(() => {
          const hasLesson = !!(
            item.expert_insight_he ||
            item.common_mistakes_he ||
            item.metaphor_he ||
            item.measurement_he ||
            item.do_this_week_he ||
            item.dont_this_week_he ||
            item.progress_marker_he ||
            item.source_attribution_he
          );
          return hasLesson ? <LessonView item={item} isHe={isHe} /> : null;
        })()}

        <ItemDetailClient
          item={item}
          scheduled={scheduled}
          status={status}
          completion={completion}
          viewerUserId={effectiveUserId}
          locale={locale}
          hideContent={!!(
            item.expert_insight_he ||
            item.common_mistakes_he ||
            item.metaphor_he ||
            item.measurement_he ||
            item.do_this_week_he ||
            item.dont_this_week_he ||
            item.progress_marker_he
          )}
        />

        {completion ? (
          <ItemFeedbackBar
            isHe={isHe}
            scheduledItemId={scheduled.id}
            initialRating={
              (myFeedbackRes.data as { rating: "helpful" | "neutral" | "not_for_us" | "made_things_worse" } | null)
                ?.rating ?? null
            }
          />
        ) : null}

        {/* Per-item thread — content-kind items only. Assessment items
            collect their answer through AssessmentItemForm above. */}
        {item.kind !== "assessment" ? (
          <section
            className="rounded-[16px] border p-5"
            style={{
              background: "rgba(29,14,54,0.30)",
              borderColor: "var(--shell-line-soft)",
            }}
          >
            <CmsText
              cmsKey="journeyTimeline.itemPage.threadHeading"
              as="h2"
              className="mb-4 m-0 text-[16px] font-semibold"
              style={{ color: "var(--shell-text-1)" }}
            />
            <PerItemThread
              scheduledItemId={scheduled.id}
              initialMessages={threadMessages}
              viewerUserId={effectiveUserId}
              isHe={isHe}
              promptLabel={threadPromptLabel}
            />
          </section>
        ) : null}
      </div>
    </CmsTextProvider>
  );
}
