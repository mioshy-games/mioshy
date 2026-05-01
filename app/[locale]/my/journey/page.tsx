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
  CheckCircle2,
  Lock,
  Sparkles,
  Star,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
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
  if (!user) redirect(`/${locale}/auth`);

  const entitlements = await getUserEntitlements();
  if (!entitlements) redirect(`/${locale}/auth`);
  if (!entitlements.journey) {
    // Not paid — bounce them to the marketing page where they can start
    // the free assessment. The /my page entitlement-aware CTAs do the
    // same thing; this is the deep-link fallback.
    redirect(`/${locale}/journey`);
  }

  // ── Did they actually take the assessment? ────────────────────────────────
  const { topPriority, hasAnyResponses } = await getUserTopPriority(user.id);
  if (!hasAnyResponses) {
    // Edge case: paid the subscription but never completed the
    // assessment. Send them to finish it; the assessment page's own
    // logic will then route back here once they're done.
    console.log(
      "[/my/journey] subscriber with no responses — redirecting to assessment",
      { user_id: user.id },
    );
    redirect(`/${locale}/journey/assessment`);
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

  console.log("[/my/journey] rendered for", {
    user_id: user.id,
    owner_kind: owner.kind,
    timeline_total: timeline.length,
    open: openItems.length,
    upcoming: upcomingItems.length,
    completed: completedItems.length,
  });

  return (
    <div dir={isHe ? "rtl" : "ltr"} className="min-h-[100dvh] text-white">
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:pt-14">
        {/* Breadcrumb back to /my */}
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        {/* ─────── Header ─────── */}
        <header className="mt-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            <span className="font-semibold text-amber-100">
              {isHe ? "החדר הפרטי" : "Private space"}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {isHe ? "ברוכים הבאים לחדר שלכם" : "Welcome to your space"}
          </h1>
          <p className="mt-2 max-w-xl text-white/70">
            {isHe
              ? "המומחים שלנו עובדים על תוכנית עבודה מותאמת אישית עבורכם — סביב מה שבחרתם בעדיפות הראשונה."
              : "Our experts are crafting a personal program for you — around the priority you chose first."}
          </p>
        </header>

        {/* ─────── Chosen priority highlight ─────── */}
        {topPriority ? (
          <section className="mt-8 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-5 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/15">
                <Star className="size-5 text-amber-200" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-amber-200/80">
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

        {/* ─────── Today / Open ───────
            Shows admin-prescribed content if any exists. Falls back to
            the spec §6.2 placeholder ("our experts will update this
            page shortly") when the admin hasn't pushed anything yet. */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
            {isHe ? "פתוח עכשיו" : "Open now"}
          </h2>

          {openItems.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {openItems.map((entry) => {
                const titleHe = entry.item.title_he ?? entry.item.title_en ?? "";
                const titleEn = entry.item.title_en ?? entry.item.title_he ?? "";
                const title = isHe ? titleHe : titleEn;
                return (
                  <li key={entry.scheduled.id}>
                    <Link
                      href={`/journey/items/${entry.item.id}`}
                      className="group flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-5 backdrop-blur transition hover:border-amber-300/40"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/15">
                        <Sparkles className="size-5 text-amber-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-white group-hover:text-amber-100">
                          {title}
                        </h3>
                        {entry.item.task_he || entry.item.task_en ? (
                          <p className="mt-1 line-clamp-2 text-sm text-white/65">
                            {isHe
                              ? entry.item.task_he ?? entry.item.task_en
                              : entry.item.task_en ?? entry.item.task_he}
                          </p>
                        ) : null}
                      </div>
                      <Arrow className="mt-1 size-4 shrink-0 text-white/40 transition group-hover:text-white" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-white">
                {isHe
                  ? `${focusLabel} — מתחיל בקרוב`
                  : `${focusLabel} — coming soon`}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {isHe
                  ? "המומחים שלנו יעדכנו אתכם בעמוד הזה בקרוב על תוכנית עבודה מותאמת. כל מה שצריך לעשות זה להיכנס לכאן."
                  : "Our experts will update this page with a tailored program shortly. All you have to do is come back here."}
              </p>
              <p className="mt-3 text-xs text-white/45">
                {isHe
                  ? "טיפ: שמרו את העמוד הזה במועדפים — נתחיל לדחוף תוכן ברגע שהוא מוכן."
                  : "Tip: bookmark this page — we'll start pushing content the moment it's ready."}
              </p>
            </div>
          )}
        </section>

        {/* ─────── Coming up ─────── */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
            {isHe ? "בהמשך" : "Coming up"}
          </h2>
          <ul className="mt-3 space-y-2">
            {upcomingItems.length > 0
              ? upcomingItems.map((entry) => {
                  const titleHe = entry.item.title_he ?? entry.item.title_en ?? "";
                  const titleEn = entry.item.title_en ?? entry.item.title_he ?? "";
                  const title = isHe ? titleHe : titleEn;
                  const unlockDate = new Date(entry.scheduled.unlock_at);
                  return (
                    <li
                      key={entry.scheduled.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                        <Lock className="size-4 text-white/40" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/65">
                          {title}
                        </p>
                        <p className="text-xs text-white/35">
                          {isHe ? "ייפתח ב־" : "Unlocks "}
                          {unlockDate.toLocaleDateString(
                            isHe ? "he-IL" : "en-US",
                            { day: "numeric", month: "short" },
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })
              : // No upcoming items yet — show a few generic "coming soon" rows
                // so the section never looks broken on day one.
                [1, 2, 3].map((i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                      <Lock className="size-4 text-white/40" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/55">
                        {isHe ? "ייחשף בהדרגה" : "Unlocks gradually"}
                      </p>
                      <p className="text-xs text-white/35">
                        {isHe
                          ? "המומחים שלנו יחליטו מתי השלב הבא מתאים לכם."
                          : "Our experts will decide when the next step is right for you."}
                      </p>
                    </div>
                  </li>
                ))}
          </ul>
        </section>

        {/* ─────── Completed (only if any) ─────── */}
        {completedItems.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/55">
              {isHe ? "הושלם" : "Completed"}
            </h2>
            <ul className="mt-3 space-y-2">
              {completedItems.map((entry) => {
                const titleHe = entry.item.title_he ?? entry.item.title_en ?? "";
                const titleEn = entry.item.title_en ?? entry.item.title_he ?? "";
                const title = isHe ? titleHe : titleEn;
                return (
                  <li
                    key={entry.scheduled.id}
                    className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-4"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-300" />
                    <p className="text-sm text-white/70">{title}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

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
  );
}
