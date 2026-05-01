/**
 * /[locale]/my/journey — "החדר הפרטי שלך"
 *
 * Post-purchase private space for an active Journey subscriber.
 *
 * What this page is NOT (anymore):
 *   - It is NOT the assessment. A paying user must NEVER land back on
 *     the questionnaire — that was the worst UX issue documented in
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
 *   - Footer reassurance — "we'll keep you posted, just check back".
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
  Star,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import {
  buildStaticRail,
  buildDynamicRail,
  type RailEntry,
} from "@/lib/dashboard/journey-rail";
import type { AssessmentStage } from "@/lib/dashboard/pillar-state";
import { JourneyProgressRail } from "@/components/my/JourneyProgressRail";
import {
  JourneyWorkArea,
  type WorkAreaItem,
} from "@/components/my/JourneyWorkArea";
import { ClinicianReplyBanner } from "@/components/my/ClinicianReplyBanner";
import { getFreshClinicianReplies } from "@/lib/journey-content/fresh-replies";
import { SubscriptionStatusBanner } from "@/components/my/SubscriptionStatusBanner";
import { getTimelineForOwner } from "@/lib/journey-content/queries";
import { preferCoupleOwner } from "@/lib/journey-content/owner";
import type { JourneyOwner } from "@/lib/journey-content/types";
import {
  PRIORITY_KEYS,
  PRIORITY_LABELS_HE,
  PRIORITY_LABELS_EN,
  PRIORITY_DESC_HE,
  PRIORITY_DESC_EN,
  type PriorityKey,
} from "@/lib/journey/priorities";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "החדר הפרטי שלכם" : "Your private space"}`,
    description: isHe
      ? "התוכן האישי שהמומחים שלנו מעלים עבורכם."
      : "The personal content our experts curate for you.",
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
    if ((PRIORITY_KEYS as readonly string[]).includes(first)) {
      return { topPriority: first as PriorityKey, hasAnyResponses: true };
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
  // user. Instead we render the page with a recovery banner — the user
  // sees their dashboard, knows their subscription is active, and gets
  // a one-click "complete the assessment" CTA. No infinite loop.
  const assessmentMissing = !hasAnyResponses;
  if (assessmentMissing) {
    console.warn(
      "[/my/journey:GATE] paid user has no responses — rendering recovery banner instead of redirecting",
      {
        user_id: user.id,
        email: user.email,
        suggestion: "verify journeys.user_id link + journey_responses RLS",
      },
    );
  }

  // Resolve the priority into bilingual labels — defaults if the user
  // skipped the ranking question.
  const focusLabel = topPriority
    ? isHe
      ? PRIORITY_LABELS_HE[topPriority]
      : PRIORITY_LABELS_EN[topPriority]
    : isHe
      ? "חיבור כללי"
      : "Connection";
  const focusDesc = topPriority
    ? isHe
      ? PRIORITY_DESC_HE[topPriority]
      : PRIORITY_DESC_EN[topPriority]
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
  // level). Otherwise fall back to user-owned.
  const couple = await getCurrentCoupleContext();
  const owner: JourneyOwner = preferCoupleOwner(user.id, couple?.couple_id ?? null);
  const viewerRole =
    couple?.role === "owner" || couple?.role === "partner"
      ? couple.role
      : null;

  let timeline: Awaited<ReturnType<typeof getTimelineForOwner>> = [];
  try {
    timeline = await getTimelineForOwner({
      owner,
      viewerUserId: user.id,
      viewerCoupleRole: viewerRole,
    });
  } catch (err) {
    console.error("[/my/journey] failed to load timeline", err);
    // Non-fatal — fall through to placeholder.
  }

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
  // The /my/journey page is the therapeutic surface — past / present /
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
  const railEntries: RailEntry[] =
    timeline.length > 0
      ? buildDynamicRail({
          isHe,
          timeline,
          assessmentCompleted: journeyStatus.hasCompletedAssessment,
        })
      : buildStaticRail({
          isHe,
          assessmentStage,
          hasActiveAssignments: journeyStatus.hasActiveAssignments,
        });
  const railIsDynamic = timeline.length > 0;

  const workAreaItems: WorkAreaItem[] = timeline.map((entry) => {
    const title = isHe
      ? entry.item.title_he
      : entry.item.title_en || entry.item.title_he;
    const category =
      (isHe
        ? entry.category.name_he
        : entry.category.name_en || entry.category.name_he) ?? null;
    const status = entry.status;
    const href =
      status === "locked" ? null : `/journey/items/${entry.item.id}`;
    const whenIso =
      status === "completed"
        ? entry.completion?.completed_at ?? entry.scheduled.unlock_at
        : entry.scheduled.unlock_at;
    return {
      id: entry.scheduled.id,
      title,
      category,
      status,
      href,
      whenIso: whenIso ?? null,
    };
  });

  // Phase 2F — surface a calm banner when the clinician has replied
  // since the user's last visit. Client-side localStorage handles the
  // "since last visit" part; server fetches the latest reply only.
  const freshReplies = await getFreshClinicianReplies(user.id);

  console.log("[/my/journey] rendered for", {
    user_id: user.id,
    owner_kind: owner.kind,
    timeline_total: timeline.length,
    rail_dynamic: railIsDynamic,
    open: openItems.length,
    upcoming: upcomingItems.length,
    completed: completedItems.length,
    recent_replies: freshReplies.recentReplyCount,
  });

  return (
    <div dir={isHe ? "rtl" : "ltr"} className="min-h-[100dvh] text-white">
      {/* Soft slate frame around the entire therapeutic surface — sets
          this room apart from the global gradient backdrop and gives
          the user a clear sense of "I'm inside the private space".
          Very low opacity so the gradient still bleeds through. */}
      <div className="mx-auto mt-6 max-w-5xl px-3 sm:px-4">
        <div className="rounded-3xl border border-white/[0.04] bg-slate-950/30 px-2 pb-8 pt-2 backdrop-blur-[2px] sm:px-4 sm:pb-10 sm:pt-4">
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:pt-14">
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
            {isHe ? "החדר הפרטי שלכם" : "Your private space"}
          </h1>
          <p className="mt-2 max-w-xl text-white/65">
            {isHe
              ? "תוכנית עבודה אישית. המומחים שלנו עובדים על התשובות שלכם וכל שלב נבנה במיוחד עבורכם."
              : "A personal work program. Our experts read your answers and craft each step for you."}
          </p>
        </header>

        {/* ─────── Subscription status — explicit confirmation ───────
            A calm "your subscription is active" line when entitled,
            or a recovery banner when the assessment didn't get
            attached to this account (we don't loop back to it; the
            user controls when they restart). */}
        <section className="mt-6">
          <SubscriptionStatusBanner
            isHe={isHe}
            variant={assessmentMissing ? "assessment_missing" : "active"}
          />
        </section>

        {/* ─────── Phase 2F — clinician reply banner ───────
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

        {/* ─────── Coaching path rail — the orientation strip ───────
            Sits at the top of the therapeutic surface so the user
            sees past / present / future at a glance. Past = completed
            categories (emerald), present = current step, future =
            locked. */}
        <section className="mt-8">
          <JourneyProgressRail
            isHe={isHe}
            entries={railEntries}
            hasJourneyEntitlement={true}
            isDynamic={railIsDynamic}
          />
        </section>

        {/* ─────── Chosen priority highlight ───────
            Calm slate panel — same visual register as the rail and
            pillar cards. The user's chosen focus is the clinical
            anchor for everything else on this page. */}
        {topPriority ? (
          <section className="mt-8 rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                <Star className="size-5 text-white/80" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-white/55">
                  {isHe ? "המוקד הראשון שלכם" : "Your first focus"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {focusLabel}
                </h2>
                {focusDesc ? (
                  <p className="mt-1 text-sm text-white/65">{focusDesc}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* ─────── Past · Present · Future ───────
            Replaces the older Open/Coming/Completed triple with a
            single tabbed work-area component. Same data, tighter
            layout, identical visual language to the /my pillar cards
            (slate-950/40 dark glass). */}
        <section className="mt-8">
          <JourneyWorkArea isHe={isHe} items={workAreaItems} />
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
