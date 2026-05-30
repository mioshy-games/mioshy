/**
 * /my/lessons — the user's lesson archive.
 *
 *   <PageHeader>
 *   Section: האבחונים שלכם       (AssessmentRow)
 *   Section: פעיל עכשיו           (CurrentLessonHero)
 *   Section: הושלמו               (HistoryList)
 *   Section: בקרוב                (UpcomingList)
 *
 * Per Studio v12 mockup #2 the assessment is the FIRST section because
 * users perceive their assessment as the canonical "lesson zero".
 * Future assessments (retake, partner, deep-dives) will surface as
 * additional rows in the same section without restructuring the page.
 *
 * Added 2026-05-29 (Step 4).
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { MarkSurfaceSeen } from "@/components/shell/MarkSurfaceSeen";
import { CurrentLessonHero } from "@/components/shell/today/CurrentLessonHero";
import { HistoryList } from "@/components/shell/today/HistoryList";
import { NoJourneyUpsell } from "@/components/shell/today/NoJourneyUpsell";
import { AssessmentRow } from "@/components/shell/lessons/AssessmentRow";
import { UpcomingList } from "@/components/shell/lessons/UpcomingList";

import { getShellData } from "@/lib/shell/getShellData";
import { getLessonsData } from "@/lib/shell/lessons/getLessonsData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

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

  const tLoc = isHe ? "he" : "en";
  const t = await getCmsTranslations({ locale: tLoc, namespace: "appShell", page: "app-shell" });
  const tL = await getCmsTranslations({ locale: tLoc, namespace: "appShell.lessons", page: "app-shell" });
  const tToday = await getCmsTranslations({ locale: tLoc, namespace: "appShell.today", page: "app-shell" });

  const data = await getLessonsData({
    userId: shell.userId,
    locale: isHe ? "he" : "en",
  });

  // Tweak the current-lesson CTA copy for the lessons page — instead of
  // "פתחו" we use "המשיכו" because the user is already deep in the
  // archive context.
  const continueCta = tL("continueCta");

  return (
    <>
      {/* B5 — clear the "lessons" nav badge once the user lands here.
          Only fires for users with a journey; otherwise there's no
          lessons surface to mark seen. */}
      {shell.hasJourney ? <MarkSurfaceSeen surface="lessons" /> : null}

      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tL("pageTitle")}
        subLine={null}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-5 py-6">

        {/* No-journey upsell — replaces every section below when the user
            doesn't have a journey subscription. Without this the page
            would be entirely empty (no assessments, no current lesson,
            nothing completed, nothing upcoming) which reads as broken. */}
        {!shell.hasJourney ? (
          <NoJourneyUpsell
            chip={tToday("upsellChip")}
            title={tToday("upsellTitle")}
            body={tToday("upsellBody")}
            ctaLabel={tToday("upsellCta")}
            ctaHref="/journey"
            bullets={[
              tToday("upsellBullet1"),
              tToday("upsellBullet2"),
              tToday("upsellBullet3"),
            ]}
          />
        ) : null}

        {/* Assessments */}
        {shell.hasJourney && data.assessments.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between pt-1">
              <h3
                className="m-0 text-[18px] font-extrabold tracking-tight"
                style={{ color: "var(--shell-text-1)" }}
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
          </section>
        ) : null}

        {/* Active now */}
        {shell.hasJourney && data.current ? (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between pt-1">
              <h3
                className="m-0 text-[18px] font-extrabold tracking-tight"
                style={{ color: "var(--shell-text-1)" }}
              >
                {tL("activeTitle")}
              </h3>
              <span
                className="text-[14px]"
                style={{ color: "var(--shell-text-3)" }}
              >
                {tL("activeCountOne")}
              </span>
            </div>
            <CurrentLessonHero
              lesson={data.current}
              currentChip={tL("activeChip")}
              ctaLabel={continueCta}
              freshTag={tToday("freshTag")}
              minutesSuffix={tToday("minutesSuffix")}
            />
          </section>
        ) : null}

        {/* Completed — hidden for non-journey users; the upsell card
            covers the whole page in that state. */}
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

        {/* Upcoming — same gating as Completed. Renders an "all caught
            up" empty state when items is empty so the section never
            silently disappears. */}
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
