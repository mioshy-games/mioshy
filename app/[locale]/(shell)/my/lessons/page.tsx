/**
 * /my/lessons — the unified post-login landing.
 *
 *   <PageHeader>
 *   ─ Today (top section) ─
 *     Today pill + focus pill
 *     <CurrentLessonHero>
 *     <ChatRowPreview>          ← expert's last message + unread count
 *   ─ Archive ─
 *     <AssessmentRow>
 *     <HistoryList>             ← completed
 *     <UpcomingList>            ← locked / preview
 *
 * 2026-05-31 — collapsed /my/today into this page. Two-tab "היום + השיעורים
 * שלי" was confusing users into navigating away from a screen that
 * already had everything. Single tab = single landing.
 *
 * Data flow:
 *   • getShellData         — identity + expert preview + badges (one shot)
 *   • getLessonsData       — assessments, current lesson, completed,
 *                            upcoming, focusLabel (the Today section data)
 *
 * No second `getTodayData` call: focusLabel + the chat data are now
 * supplied directly (focus via getLessonsData, chat via shell.expert).
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { MarkSurfaceSeen } from "@/components/shell/MarkSurfaceSeen";
import { FocusPill } from "@/components/shell/today/FocusPill";
import { CurrentLessonHero } from "@/components/shell/today/CurrentLessonHero";
import { ChatRowPreview } from "@/components/shell/today/ChatRowPreview";
import { ExpertSoonCard } from "@/components/shell/today/ExpertSoonCard";
import { HistoryList } from "@/components/shell/today/HistoryList";
import { NoJourneyUpsell } from "@/components/shell/today/NoJourneyUpsell";
import { AssessmentRow } from "@/components/shell/lessons/AssessmentRow";
import { UpcomingList } from "@/components/shell/lessons/UpcomingList";

import { getShellData } from "@/lib/shell/getShellData";
import { getLessonsData } from "@/lib/shell/lessons/getLessonsData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { resolvePrioritiesForUser } from "@/lib/journey-content/resolve-priorities";
import { partnerAssessmentGateState } from "@/lib/journey-content/partner-gate";
import { getNoJourneyUpsellCopy } from "@/lib/shell/today/noJourneyUpsellCopy";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

/** Build a tiny "X ago" stamp for the expert chat preview. Hebrew-aware. */
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

export default async function LessonsPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const shell = await getShellData({ locale: isHe ? "he" : "en" });
  if (!shell) redirect(`/${locale}/auth`);

  // Shared-content gate (spec step 3, shared helper): a partner deferred to the
  // owner's queue who hasn't finished their own full assessment lands here on
  // the <NoJourneyUpsell/> takeover (a component, NOT a redirect) — the same
  // "start your journey" surface a non-subscriber sees, with the free-assessment
  // CTA. /my/lessons is the post-login landing (and /my/today + all the other
  // owner-content surfaces funnel blocked partners here), so this single screen
  // is where every blocked-partner path converges. It runs BEFORE the universal
  // assessment gate below so the partner is never bounced to /journey/assessment.
  // owner/solo/view-as → never blocked.
  if ((await partnerAssessmentGateState(shell.userId)).blocked) {
    const tLoc = isHe ? "he" : "en";
    const tHdr = await getCmsTranslations({ locale: tLoc, namespace: "appShell", page: "app-shell" });
    const tLes = await getCmsTranslations({ locale: tLoc, namespace: "appShell.lessons", page: "app-shell" });
    const tUp = await getCmsTranslations({ locale: tLoc, namespace: "appShell.today", page: "app-shell" });
    const upsell = await getNoJourneyUpsellCopy(tLoc);
    return (
      <>
        <PageHeader
          rootLabel={tHdr("rootCrumb")}
          pageLabel={tLes("pageTitle")}
          subLine={null}
          bellCount={shell.notificationCount}
        />
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-5 py-6">
          <NoJourneyUpsell
            chip={tUp("upsellChip")}
            title={tUp("upsellTitle")}
            body={upsell.body}
            ctaLabel={tUp("upsellCta")}
            ctaHref="/journey/assessment"
            bullets={upsell.bullets}
          />
        </div>
      </>
    );
  }

  // ── Universal assessment gate (Itzik 2026-06-01) ─────────────────────
  // Every user with journey access — paid, free-tier, or test_user —
  // must complete the assessment first. Without q_priorities there's
  // nothing for the expert team to anchor on, and the lessons surface
  // has nothing to show anyway (the cadence engine drives off the
  // priority ranking). Same gate that /my/journey uses; we mirror it
  // here so /my/lessons (now the shell's landing page) enforces it too.
  if (shell.hasJourney) {
    const gateAdmin = createServiceRoleClient();
    if (gateAdmin) {
      try {
        const result = await resolvePrioritiesForUser(gateAdmin, shell.userId);
        if (result.kind === "needs_assessment") {
          redirect(`/${locale}/journey/assessment`);
        }
      } catch {
        /* assessment gate is best-effort; render normally on errors */
      }
    }
  }

  const tLoc = isHe ? "he" : "en";
  const t = await getCmsTranslations({ locale: tLoc, namespace: "appShell", page: "app-shell" });
  const tL = await getCmsTranslations({ locale: tLoc, namespace: "appShell.lessons", page: "app-shell" });
  const tToday = await getCmsTranslations({ locale: tLoc, namespace: "appShell.today", page: "app-shell" });
  // Shared NoJourneyUpsell body + 2 bullets (same source the blocked-partner
  // takeover above uses) so the no-journey upsell never drifts from it.
  const upsell = await getNoJourneyUpsellCopy(tLoc);

  const data = await getLessonsData({
    userId: shell.userId,
    locale: isHe ? "he" : "en",
  });

  // CTA copy: the user is on the archive page → "המשיכו" reads better
  // than "פתחו" for a lesson they've already started but not finished.
  const continueCta = tL("continueCta");

  // ── Today section's chat row preview ───────────────────────────────
  // Built from shell.expert (already fetched once by the layout). We
  // don't call any extra DB helpers here.
  const chatPreview =
    shell.expert?.lastMessage && shell.expert?.lastMessageAt
      ? {
          expertName: shell.expert.expertName!,
          expertInitial: shell.expert.expertInitial,
          message: shell.expert.lastMessage,
          whenLabel: relativeStamp(shell.expert.lastMessageAt, isHe),
          unread: shell.badges.expert ?? 0,
          href: "/my/expert" as const,
          online: shell.expert.online ?? true,
        }
      : null;

  // Mobile sub-line uses the focus area when we have one, otherwise null.
  const mobileSubLine = data.focusLabel
    ? isHe
      ? `המוקד · ${data.focusLabel}`
      : `Focus · ${data.focusLabel}`
    : null;

  return (
    <>
      {/* B5 — clear the "lessons" nav badge once the user lands here. */}
      {shell.hasJourney ? <MarkSurfaceSeen surface="lessons" /> : null}

      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tL("pageTitle")}
        subLine={mobileSubLine}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-5 py-6">

        {/* No-journey upsell — replaces every section below when the user
            doesn't have a journey subscription. */}
        {!shell.hasJourney ? (
          <NoJourneyUpsell
            chip={tToday("upsellChip")}
            title={tToday("upsellTitle")}
            body={upsell.body}
            ctaLabel={tToday("upsellCta")}
            ctaHref="/journey"
            bullets={upsell.bullets}
          />
        ) : null}

        {/* ───────── Today section ─────────
            Top-of-page block summarizing what's happening RIGHT NOW.
            Renders only when the user has an active journey — otherwise
            the upsell above takes the whole screen. */}
        {shell.hasJourney ? (
          <section className="flex flex-col gap-3">
            {/* "Today" pill + focus pill, side by side on desktop, stacked
                on mobile. The "Today" chip carries the brand wine accent
                so it reads as the page's anchor moment. */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em]"
                style={{
                  background: "var(--shell-wine-soft)",
                  borderColor: "var(--shell-wine-edge)",
                  color: "var(--shell-pink-text)",
                }}
              >
                {tL("todayChip")}
              </span>
              {data.focusLabel ? (
                <FocusPill
                  prefix={tToday("focusPrefix")}
                  focusLabel={data.focusLabel}
                />
              ) : null}
            </div>

            {/* Current lesson hero — the one item the user should open
                right now. When null (no active lesson) we still render
                the chat preview below so the section never collapses. */}
            {data.current ? (
              <CurrentLessonHero
                lesson={data.current}
                currentChip={tL("activeChip")}
                ctaLabel={continueCta}
                freshTag={tToday("freshTag")}
                minutesSuffix={tToday("minutesSuffix")}
              />
            ) : null}

            {/* Expert chat preview — the latest line from the expert
                channel. Built entirely from shell.expert; no extra DB. */}
            {chatPreview ? (
              <ChatRowPreview data={chatPreview} />
            ) : shell.expert ? (
              <ExpertSoonCard
                title={tToday("expertSoonTitle")}
                body={tToday("expertSoonBody")}
                cta={{
                  href: `/${locale}/journey/assessment`,
                  label: tToday("expertSoonCta"),
                }}
              />
            ) : null}
          </section>
        ) : null}

        {/* ───────── Archive ─────────
            Assessments → Completed → Upcoming. Kept as separate sections
            so the user can scan past the Today block down into history.
            The "Active now" section header was removed: the current
            lesson is already inside the Today block above. */}

        {shell.hasJourney && data.assessments.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between pt-1">
              <h3
                className="m-0 text-[18px] font-extrabold tracking-tight"
                style={{ color: "var(--shell-text-1)" }}
                aria-label={`${tL("assessmentsTitle")} — ${tL("assessmentsCount").replace("{count}", String(data.assessments.length))}`}
              >
                {tL("assessmentsTitle")}
              </h3>
              <span
                className="text-[14px]"
                style={{ color: "var(--shell-text-3)" }}
              >
                {tL("assessmentsCount").replace("{count}", String(data.assessments.length))}
              </span>
            </div>
            <AssessmentRow
              rows={data.assessments}
              openLabel={tL("assessmentOpen")}
              isHe={isHe}
            />
            {/* C.3 — next-assessment notice. Date is computed per-user
                (assessment/join date + 8 weeks) in getLessonsData; copy is
                CMS-driven with a {date} placeholder. Only shown while the date
                is still ahead, so "in 8 weeks, on X" never reads a past date. */}
            {data.nextAssessmentAt &&
            new Date(data.nextAssessmentAt).getTime() > Date.now() ? (
              <p
                className="rounded-2xl border px-4 py-3 text-[15px] leading-relaxed"
                style={{
                  background: "var(--shell-wine-soft)",
                  borderColor: "var(--shell-wine-edge)",
                  color: "var(--shell-text-2)",
                }}
              >
                {tL("nextAssessmentNotice").replace(
                  "{date}",
                  new Date(data.nextAssessmentAt).toLocaleDateString(
                    isHe ? "he-IL" : "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  ),
                )}
              </p>
            ) : null}
          </section>
        ) : null}

        {shell.hasJourney ? (
          <HistoryList
            title={tL("completedTitle")}
            allLinkLabel={tL("totalLabel").replace(
              "{count}",
              String(data.completedTotal),
            )}
            allHref="/my/lessons"
            totalCount={null}
            items={data.completed}
          />
        ) : null}

        {shell.hasJourney ? (
          <UpcomingList
            title={tL("upcomingTitle")}
            waitingSuffix={tL("waitingSuffix")}
            items={data.upcoming}
            emptyTitle={tL("upcomingEmptyTitle")}
            emptyBody={tL("upcomingEmptyBody")}
          />
        ) : null}
      </div>
    </>
  );
}
