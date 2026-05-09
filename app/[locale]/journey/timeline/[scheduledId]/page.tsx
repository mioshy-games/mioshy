/**
 * /[locale]/journey/timeline/[scheduledId]
 *
 * Detail view for a single scheduled item. Loads the item content, the
 * owning assignment, the completion state, and the responses visible to
 * the viewer (private-filtered). Hands off to ItemDetailClient for the
 * interactive surface.
 *
 * Ownership gate: viewer must either be the assignment's user_id or a
 * member of the assignment's couple. Otherwise we render 404 so we don't
 * leak the item's existence.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
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

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; scheduledId: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "פרק במסע" : "Journey chapter"}`,
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

  // ── Auth ─────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  // L3 follow-up — when paused, content surfaces are hidden behind
  // the pause screen on /my/journey. Direct deep-links bounce there.
  const pauseState = await getCurrentUserPauseState();
  if (pauseState.isActive) redirect(`/${locale}/my/journey`);

  // FU6.S3 — view-as substitution. When a coach is impersonating, the
  // ownership gate is satisfied by the impersonated user's membership,
  // every read uses `effectiveUserId`, and side-effect writes
  // (markFirstSessionCompleted, logActivity) are SKIPPED so the coach
  // never mutates the user's profile by accident.
  const viewAsContext = await getActiveViewAs();
  const effectiveUserId = viewAsContext?.viewedUserId ?? user.id;

  // ── Load scheduled + assignment (admin client - RLS would allow this
  // read for legit owners but admin is simpler and authorisation is
  // enforced below by explicit ownership checks).
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

  // ── Ownership gate: viewer is the user (or impersonated user), or a
  //    member of the couple. The check uses effectiveUserId so a coach
  //    in view-as mode satisfies the gate via the impersonated user's
  //    membership — without an audit row this is a no-op (coach blocked).
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

  // Audience gate - if this scheduled row is targeted at the OTHER partner,
  // bounce back to the timeline. ('both' is always allowed; user-owned
  // assignments are always 'both' by the migration's invariants but we still
  // check defensively for stored values.)
  if (
    assignment.couple_id &&
    scheduled.audience !== "both" &&
    scheduled.audience !== viewerCoupleRole
  ) {
    redirect(`/${locale}/journey/timeline`);
  }

  // Cancelled assignments should not surface deep-links.
  if (!assignment.is_active) {
    redirect(`/${locale}/journey/timeline`);
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
    // Migration 066 — fetch the rule attribution so we can render
    // "Why this item?" alongside the body. Skip the lookup entirely
    // when matched_by_rule_id is null (legacy rows).
    scheduled.matched_by_rule_id
      ? admin
          .from("journey_match_rules")
          .select("id, slug, rationale_he, rationale_en")
          .eq("id", scheduled.matched_by_rule_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Migration 066 — pull this user's pre-existing feedback so the bar
    // hydrates with their previous choice rather than starting blank.
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

  // Private-response filter: only the author sees their own private notes.
  // In view-as mode, the coach should see what the user sees → use
  // effectiveUserId here as well so private-by-the-user notes still show.
  const responses = ((responsesRes.data ?? []) as JourneyItemResponse[]).filter(
    (r) => !r.is_private || r.user_id === effectiveUserId,
  );

  // v3 slice 6 - load the threaded messages for this scheduled item.
  // Drives the new PerItemThread UI; the legacy `responses` list above
  // is kept for the existing ItemDetailClient surfaces during the
  // dual-write transition.
  const threadMessages = await getPerItemThread(scheduled.id, effectiveUserId);

  // Phase 3 step 2 - for assessment-kind items, the form pre-fills
  // from the user's most-recent prior response (if any) so they can
  // revise rather than re-answer from scratch.
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

  // Locked items shouldn't be reachable (TimelineList wraps them in a
  // non-link), but if someone manually hit the URL we redirect back to
  // the list rather than showing a half-functional page.
  if (!isOpenable(status)) {
    redirect(`/${locale}/journey/timeline`);
  }

  // Log item_opened for the unread-count badge on /my. Idempotent on the
  // user side - multiple visits all count as "opened" and the badge stays
  // off. Failure-tolerant (logActivity catches its own errors).
  // FU6.S3 — skip both side-effect writes when a coach is impersonating;
  // we never want a view-as session to mark the user's first-session done
  // or pollute their activity feed.
  if (!viewAsContext) {
    await logActivity({
      userId: user.id,
      coupleId: assignment.couple_id ?? null,
      scheduledItemId: scheduled.id,
      verb: "item_opened",
    });

    // Layer-1 first-session marker: the moment a user opens ANY item
    // (likely the day-1 unlocked one), flip the column so /my/journey
    // falls through to its full dashboard on the next visit. Idempotent
    // — only writes when the column is currently null.
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

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] overflow-hidden text-white"
    >
      {viewAsContext && viewAsLabel ? (
        <ViewAsBanner viewedLabel={viewAsLabel} isHe={isHe} />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] opacity-65 animate-aurora-drift"
        style={{
          background:
            "radial-gradient(1000px 500px at 15% -10%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(800px 400px at 85% 10%, rgba(16,185,129,0.14), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[55vh] h-[80vh] opacity-50 animate-aurora-breathe"
        style={{
          background:
            "radial-gradient(800px 400px at 80% 40%, rgba(236,72,153,0.10), transparent 60%), radial-gradient(700px 380px at 15% 65%, rgba(99,102,241,0.12), transparent 60%)",
        }}
      />

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:pt-14">
        <Link
          href="/journey/timeline"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה לציר המסע" : "Back to the timeline"}
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <Compass className="h-3.5 w-3.5 text-indigo-300" />
          <span>
            {category
              ? (isHe ? category.name_he : category.name_en ?? category.name_he)
              : isHe
                ? "פרק"
                : "Chapter"}
          </span>
          {/* v3 slice 8 - source badge for expert pushes. Subtle chip
              so the user knows this isn't a regular cadence pick. */}
          {scheduled.source === "expert_push" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
              {isHe ? "מהמומחה שלכם" : "From your coach"}
            </span>
          ) : null}
        </div>

        {/* Phase 3 step 2: when this is an assessment-kind item, render
            the structured form ABOVE the standard detail block. The
            standard ItemDetailClient still renders the body / category
            / past responses underneath; the assessment form is just
            a richer way to collect a response.
            For 'content' items (the existing default), the form is
            skipped - ItemDetailClient handles everything. */}
        {item.kind === "assessment" && item.assessment_payload ? (
          <div className="mt-6">
            <AssessmentItemForm
              isHe={isHe}
              scheduledItemId={scheduled.id}
              payload={item.assessment_payload}
              initialAnswers={
                myExistingResponse?.structured_answer ?? undefined
              }
              initialSummary={myExistingResponse?.response_text}
              initialPrivate={myExistingResponse?.is_private}
            />
          </div>
        ) : null}

        {/* Layer 1 (#1) — "Why this item?" disclosure. Renders the
            user-facing rationale from the match rule that produced
            this scheduled item. Falls back to a generic line when
            the row predates rule attribution. */}
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

        {/* Phase 1 — LessonView renders the structured 9-block lesson
            (insight / mistake / metaphor / body / exercise / measure /
            do / don't / progress / source). Only renders blocks that
            are populated; legacy items with empty blocks fall through
            to ItemDetailClient's body/task/challenge below. */}
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
          responses={responses}
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

        {/* Layer 1 (#3) — 4-button feedback bar.
            Only renders after completion: feedback before completion
            measures the prompt, not the experience. */}
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

        {/* v3 slice 6 - threaded messaging. Per Update B "every item
            is a prompt expecting a response": composer is the primary
            affordance, focused on mount, with thread history below.
            For assessment-kind items the AssessmentItemForm above
            already collects a structured answer, so we only show the
            thread for content/reflection kinds. */}
        {item.kind !== "assessment" ? (
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-white/85">
              {isHe ? "השיחה שלכם על הפריט" : "Your conversation on this item"}
            </h2>
            <PerItemThread
              scheduledItemId={scheduled.id}
              initialMessages={threadMessages}
              viewerUserId={effectiveUserId}
              isHe={isHe}
              promptLabel={
                isHe
                  ? "כתבו תגובה - המומחים שלנו רואים ומגיבים."
                  : "Write a response - our experts read and reply."
              }
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
