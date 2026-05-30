/**
 * /my/today — the post-login landing page.
 *
 * Composition (top to bottom):
 *
 *   <PageHeader>           sticky top bar with crumb + bell + settings
 *   <FocusPill>            "המוקד הנוכחי: מיניות ואינטימיות"
 *   <CurrentLessonHero>    big card with the lesson to open now
 *   <ChatRowPreview>       expert's last message + unread count
 *   <HistoryList>          last 3 completed lessons
 *
 * The shell (sidebar + mobile tabs + brand background) is supplied by
 * the wrapping (shell)/layout.tsx — this page is just content.
 *
 * Data flow: getShellData() is called by the layout; we re-fetch it
 * here for the expert identity because the page-level data fetcher
 * needs the expert name + initial for ChatRowPreview. React.cache means
 * the underlying queries only run once per request.
 *
 * Added 2026-05-29 (Step 3 of the post-login redesign).
 * Visual spec: post-login-mockup-v12.html #1 "היום".
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { FocusPill } from "@/components/shell/today/FocusPill";
import { CurrentLessonHero } from "@/components/shell/today/CurrentLessonHero";
import { ChatRowPreview } from "@/components/shell/today/ChatRowPreview";
import { ExpertSoonCard } from "@/components/shell/today/ExpertSoonCard";
import { HistoryList } from "@/components/shell/today/HistoryList";
import { NoJourneyUpsell } from "@/components/shell/today/NoJourneyUpsell";

import { getShellData } from "@/lib/shell/getShellData";
import { getTodayData } from "@/lib/shell/today/getTodayData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  // Auth gate — same as the layout, kept here for direct navigation +
  // future split. React.cache on the underlying queries means the
  // duplicate call is essentially free.
  const shell = await getShellData({ locale: isHe ? "he" : "en" });
  if (!shell) redirect(`/${locale}/auth`);

  const tLoc = isHe ? "he" : "en";
  const t = await getCmsTranslations({ locale: tLoc, namespace: "appShell", page: "app-shell" });
  const tToday = await getCmsTranslations({ locale: tLoc, namespace: "appShell.today", page: "app-shell" });

  const data = await getTodayData({
    userId: shell.userId,
    locale: isHe ? "he" : "en",
    expertName: shell.expert?.expertName ?? null,
    expertInitial: shell.expert?.expertInitial ?? " ",
  });

  // Build the page-level sub-line (mobile only): "המוקד · מיניות ואינטימיות".
  const mobileSubLine = data.focusLabel
    ? isHe
      ? `המוקד · ${data.focusLabel}`
      : `Focus · ${data.focusLabel}`
    : null;

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tToday("pageTitle")}
        subLine={mobileSubLine}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-5 py-6">

        {shell.hasJourney ? (
          // ── Subscribed user — show the journey-backed surface ──
          <>
            <FocusPill
              prefix={tToday("focusPrefix")}
              focusLabel={data.focusLabel}
            />

            <CurrentLessonHero
              lesson={data.lesson}
              currentChip={tToday("currentLessonChip")}
              ctaLabel={tToday("openLessonCta")}
              freshTag={tToday("freshTag")}
              minutesSuffix={tToday("minutesSuffix")}
              emptyTitle={tToday("emptyTitle")}
              emptyBody={tToday("emptyBody")}
            />

            {data.chat ? (
              <ChatRowPreview data={data.chat} />
            ) : shell.expert ? null : (
              // Paid for journey but no expert is attached yet — show a
              // calm placeholder so the surface doesn't read as broken.
              <ExpertSoonCard
                title={tToday("expertSoonTitle")}
                body={tToday("expertSoonBody")}
              />
            )}

            <HistoryList
              title={tToday("historyTitle")}
              allLinkLabel={tToday("historyAllLink")}
              allHref="/my/lessons"
              totalCount={data.historyTotal > 0 ? data.historyTotal : null}
              items={data.history}
            />
          </>
        ) : (
          // ── No journey — soft upsell hero replaces the lesson card. ──
          // We deliberately hide ChatRowPreview + HistoryList: there's
          // nothing to show, and an empty section would feel broken. The
          // upsell itself is the entire page.
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
        )}

      </div>
    </>
  );
}
