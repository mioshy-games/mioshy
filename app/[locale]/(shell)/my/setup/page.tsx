/**
 * /my/setup — non-blocking "complete your setup" landing (C, work-order
 * 2026-06-15, revised concept).
 *
 * This is NOT a gate. It is the post-login landing surface shown only while the
 * user's assessment is still pending (decided at /my/start). It blocks nothing:
 * the user is free to navigate to lessons / journey / settings from here. The
 * sole condition for it to exist is the assessment — partner connection never
 * affects it (see getSetupLandingState).
 *
 * Once the assessment is done it stops being the landing (it bounces to
 * /my/lessons), and a manual visit also bounces — computed live, no sticky flag.
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { OnboardingReminderCard } from "@/components/my/OnboardingReminderCard";
import { getSetupLandingState } from "@/lib/journey/setup-landing";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function SetupLandingPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const state = await getSetupLandingState();
  // Assessment complete (or no pending-assessment state) → this is no longer
  // the landing; a manual visit bounces to the normal hub.
  if (!state.pending) redirect(`/${locale}/my/lessons`);

  const tLoc = isHe ? "he" : "en";
  const t = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell",
    page: "app-shell",
  });
  const tS = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell.setup",
    page: "app-shell",
  });

  return (
    <>
      <PageHeader rootLabel={t("rootCrumb")} pageLabel={tS("pageTitle")} />

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-5 py-8">
        {/* a11y (M3): page h1 (the PageHeader title isn't a heading element). */}
        <h1 className="sr-only">{tS("pageTitle")}</h1>
        <p
          className="text-center text-[20px] leading-snug"
          style={{ color: "var(--shell-text-2)" }}
        >
          {tS("lead")}
        </p>

        <OnboardingReminderCard
          pairCode={state.pairCode}
          partnerConnected={state.partnerConnected}
          partnerMode={state.partnerMode}
        />
      </div>
    </>
  );
}
