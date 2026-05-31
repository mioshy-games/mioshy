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

import { getShellData } from "@/lib/shell/getShellData";
import {
  ensureUserChannel,
  getGeneralChannelThread,
} from "@/lib/journey-content/messages";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

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

  // No expert → no chat surface. Send them home (they'll see the empty
  // state for "no journey yet"). Avoids a confusing "blank chat".
  if (!shell.expert) {
    redirect(`/${locale}/my/lessons`);
  }

  const tLoc = isHe ? "he" : "en";
  const t = await getCmsTranslations({ locale: tLoc, namespace: "appShell", page: "app-shell" });
  const tExpert = await getCmsTranslations({ locale: tLoc, namespace: "appShell.expert", page: "app-shell" });

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

        <ExpertConversation
          initialMessages={messages}
          viewerUserId={shell.userId}
          isHe={isHe}
          composerPlaceholder={tExpert("composerPlaceholder")}
          emptyLabel={tExpert("emptyLabel")}
          todayLabel={tExpert("todayLabel")}
          sendLabel={tExpert("sendLabel")}
        />
      </div>
    </>
  );
}
