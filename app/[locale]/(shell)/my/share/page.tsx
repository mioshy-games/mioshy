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
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";

import { getShellData } from "@/lib/shell/getShellData";
import { getShareData } from "@/lib/shell/share/getShareData";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

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

  // ─── Role split (same signal as /my) ─────────────────────────────────
  // A purchaser has a couple (lazily created on first entitlement) and a
  // pair_code to SHARE → ShareHero. A registered non-purchaser has no
  // couple yet and should ENTER the code they received → code-entry card.
  const ctx = await getCurrentCoupleContext();
  const hasCouple = !!ctx?.couple_id;

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tS("pageTitle")}
        subLine={isHe ? "החשבון" : "Account"}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[660px] flex-col gap-4 px-5 py-6">
        {hasCouple ? (
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
        ) : (
          <section
            className="relative overflow-hidden rounded-[18px] border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(236,72,153,0.16) 0%, var(--shell-card) 100%)",
              borderColor: "var(--shell-wine-edge)",
            }}
          >
            <h2
              className="m-0 mb-2.5 text-[24px] font-extrabold tracking-tight"
              style={{ color: "var(--shell-text-1)" }}
            >
              {isHe ? "הזן את קוד ההזמנה שקיבלת" : "Enter the invite code you received"}
            </h2>
            <p
              className="m-0 mb-5 max-w-[500px] text-[20px] leading-[1.55]"
              style={{ color: "var(--shell-text-1)" }}
            >
              {isHe
                ? "הזינו את הקוד שבן/בת הזוג שיתפו איתכם כדי להתחבר ולפתוח את הגישה המשותפת."
                : "Enter the code your partner shared with you to connect and unlock your shared access."}
            </p>
            <RedeemCodeButton
              isHe={isHe}
              variant="primary"
              label={isHe ? "הזן את קוד ההזמנה שקיבלת" : "Enter the invite code you received"}
              redirectTo="/journey/assessment"
            />
          </section>
        )}
      </div>
    </>
  );
}
