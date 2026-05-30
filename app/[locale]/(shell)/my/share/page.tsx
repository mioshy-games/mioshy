/**
 * /my/share — invite the partner.
 *
 *   <PageHeader>
 *   <ShareHero>   ghost-pair avatar + code + copy + 4 channels (or
 *                 "you're paired" celebration when alreadyPaired)
 *
 * Reuses the same pair_code + couple_members infrastructure as the
 * existing widget on /my; the UI is rebuilt for the shell.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { ShareHero } from "@/components/shell/share/ShareHero";

import { getShellData } from "@/lib/shell/getShellData";
import { getShareData } from "@/lib/shell/share/getShareData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export default async function SharePage({
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
  const tS = await getCmsTranslations({ locale: tLoc, namespace: "appShell.share", page: "app-shell" });

  const data = await getShareData({
    userId: shell.userId,
    locale: isHe ? "he" : "en",
  });

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tS("pageTitle")}
        subLine={isHe ? "החשבון" : "Account"}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[660px] flex-col gap-4 px-5 py-6">
        <ShareHero
          ownerInitial={shell.couple.ownerInitial}
          partnerInitial={shell.couple.partnerInitial ?? null}
          alreadyPaired={data.alreadyPaired}
          partnerName={data.partnerName}
          pairCode={data.pairCode}
          shareUrl={data.shareUrl}
          shareMessage={data.shareMessage}
          isHe={isHe}
          title={tS("title")}
          body={tS("body")}
          copyLabel={tS("copyLabel")}
          copiedLabel={tS("copiedLabel")}
          whatsappLabel={tS("whatsappLabel")}
          smsLabel={tS("smsLabel")}
          emailLabel={tS("emailLabel")}
          qrLabel={tS("qrLabel")}
          pairedTitle={tS("pairedTitle")}
          pairedBody={tS("pairedBody")}
          qrCaption={tS("qrCaption")}
          closeLabel={tS("closeLabel")}
          emailSubjectLabel={tS("emailSubjectLabel")}
        />
      </div>
    </>
  );
}
