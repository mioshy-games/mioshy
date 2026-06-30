/**
 * /my/expert — full-page chat surface with the assigned expert.
 *
 *   <PageHeader>
 *   <ExpertChatHeader>     avatar + name + role + online dot
 *   <ExpertConversation>   bubble thread + composer (client component)
 *
 * Reuses the existing `getGeneralChannelThread` / `ensureUserChannel`
 * pair from /my/journey so writes flow through the same dual-write
 * contract (journey_messages + journey_user_messages). The UI is new
 * and matches Studio v12 spec — the legacy GeneralChannelThread stays
 * embedded inside /my/journey untouched.
 *
 * If the user has no assigned expert (no journey entitlement), we
 * route them back to /my/today rather than showing an empty page.
 *
 * Added 2026-05-29 (Step 4).
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { MarkSurfaceSeen } from "@/components/shell/MarkSurfaceSeen";
import { ExpertChatHeader } from "@/components/shell/expert/ExpertChatHeader";
import { ExpertConversation } from "@/components/shell/expert/ExpertConversation";
import { CoachingLockedChat } from "@/components/journey/CoachingLockedChat";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { NoJourneyUpsell } from "@/components/shell/today/NoJourneyUpsell";
import { getNoJourneyUpsellCopy } from "@/lib/shell/today/noJourneyUpsellCopy";

import { getShellData } from "@/lib/shell/getShellData";
import {
  ensureUserChannel,
  getGeneralChannelThread,
} from "@/lib/journey-content/messages";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function ExpertPage({
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
  const tExpert = await getCmsTranslations({ locale: tLoc, namespace: "appShell.expert", page: "app-shell" });

  // 2026-06-02 (Itzik): non-journey users used to be silently
  // redirected to /my/lessons, with no explanation. The new behaviour
  // is to render this page with a contextual explainer + state-aware
  // CTA so the user understands *why* the chat is gated and what to
  // do next. The CTA forks on assessment status — no point asking
  // someone who already completed the assessment to retake it.
  if (!shell.expert) {
    // coupleId=null is safe here: if we got past the !shell.expert
    // gate, the user has no journey entitlement (and partner-shared
    // entitlement would have filled shell.expert via getShellData).
    // The assessment lookup keys on user_id directly anyway.
    const status = await getOwnerJourneyStatus({
      userId: shell.userId,
      coupleId: null,
    });
    const ctaHref = status.hasCompletedAssessment ? "/journey" : "/journey/assessment";
    const ctaLabel = status.hasCompletedAssessment
      ? tExpert("gateCtaSubscribe")
      : tExpert("gateCtaAssessment");
    const title = status.hasCompletedAssessment
      ? tExpert("gateTitleHasAssessment")
      : tExpert("gateTitleNoAssessment");
    // Body + bullets come from the one shared source so this gate stays
    // identical to the NoJourneyUpsell on /my/lessons (chip / title / CTA
    // remain expert-gate specific and state-aware).
    const upsell = await getNoJourneyUpsellCopy(tLoc);

    return (
      <>
        <PageHeader
          rootLabel={t("rootCrumb")}
          pageLabel={tExpert("pageTitle")}
          bellCount={shell.notificationCount}
        />
        <div className="mx-auto w-full max-w-[760px] px-5 py-6 pb-32 lg:pb-12">
          <NoJourneyUpsell
            chip={tExpert("gateChip")}
            title={title}
            body={upsell.body}
            ctaLabel={ctaLabel}
            ctaHref={ctaHref}
            bullets={upsell.bullets}
          />
        </div>
      </>
    );
  }

  // Stage-1 coaching add-on — the expert channel is gated on the add-on.
  // A journey subscriber WITHOUT coaching still reaches this page (they have
  // an assigned expert) but sees the locked overlay instead of the composer.
  const chatEnt = await getUserEntitlements(shell.userId).catch(() => null);
  const chatLocked = chatEnt ? !chatEnt.journeyCoaching : false;

  // Ensure the channel row exists (no-op when present). This is the
  // same step /my/journey performs before reading the thread.
  await ensureUserChannel(shell.userId);
  const messages = await getGeneralChannelThread(shell.userId, shell.userId);

  return (
    <>
      {/* B5 — clear the "expert" nav badge once the user lands here.
          Fires a server action on mount; renders nothing. */}
      <MarkSurfaceSeen surface="expert" />

      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tExpert("pageTitle")}
        subLine={isHe ? `המומחית · ${shell.expert.expertName}` : `Expert · ${shell.expert.expertName}`}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-5 py-6 pb-32 lg:pb-12">
        <ExpertChatHeader
          expertName={shell.expert.expertName!}
          expertInitial={shell.expert.expertInitial}
          subLine={tExpert("statusLine")}
          online={shell.expert.online ?? false}
        />

        {chatLocked ? (
          <CoachingLockedChat isHe={isHe} />
        ) : (
          <ExpertConversation
            initialMessages={messages}
            viewerUserId={shell.userId}
            isHe={isHe}
            composerPlaceholder={tExpert("composerPlaceholder")}
            emptyLabel={tExpert("emptyLabel")}
            todayLabel={tExpert("todayLabel")}
            sendLabel={tExpert("sendLabel")}
          />
        )}
      </div>
    </>
  );
}
