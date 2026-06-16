/**
 * /my/setup — the "complete your setup" gate (C, work-order 2026-06-15).
 *
 * A journey subscriber who finished the SHORT assessment lands here until they
 * (1) connect a partner and (2) finish the FULL assessment. While EITHER is
 * outstanding this is the main surface: the journey landing (/my/lessons) and
 * the journey area (/my/journey) redirect here (see getOnboardingGate callers).
 *
 * The checklist itself is the existing <OnboardingReminderCard> — the same
 * source of truth that drove the old non-blocking /my reminder (partner_count
 * for item 1, full-assessment-pending for item 2), now promoted to a blocker.
 *
 * Escape hatches stay open by design: this page renders INSIDE the AppShell, so
 * the settings gear (PageHeader) and logout (shell nav) are always one tap away
 * — the gate blocks the journey, never the ability to leave or manage the
 * account. The gate is NOT applied to this route, so there is no redirect loop;
 * and once both tasks are done getOnboardingGate returns gated:false forever, so
 * this page bounces to /my/lessons and never shows again.
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { OnboardingReminderCard } from "@/components/my/OnboardingReminderCard";
import { getOnboardingGate } from "@/lib/journey/onboarding-gate";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function SetupGatePage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const gate = await getOnboardingGate();
  // Both tasks complete (or not a journey user) → the gate is gone for good.
  if (!gate.gated) redirect(`/${locale}/my/lessons`);

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
        <p
          className="text-center text-[20px] leading-snug"
          style={{ color: "var(--shell-text-2)" }}
        >
          {tS("lead")}
        </p>

        <OnboardingReminderCard
          pairCode={gate.pairCode}
          partnerConnected={gate.partnerConnected}
          fullAssessmentPending={gate.fullAssessmentPending}
        />
      </div>
    </>
  );
}
