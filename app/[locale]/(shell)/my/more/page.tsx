/**
 * /my/more — mobile overflow page for the bottom-tab nav.
 *
 * The MobileTabs bar shows 4 primary tabs + an "עוד" tab that opens
 * THIS page. We show the 3 overflow items as the same SettingsRow
 * components used on /my/settings — consistent visual language.
 *
 * Desktop: route still works but lives at the bottom of the sidebar
 * order, so a direct hit on /he/my/more just renders the same list
 * (a redundancy users won't typically reach via the sidebar).
 *
 * Added 2026-05-29 (Step 5 fix — review pass).
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Heart, Settings, Users } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsRow } from "@/components/shell/settings/SettingsRow";

import { getShellData } from "@/lib/shell/getShellData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export default async function MorePage({
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
  const tNav = await getCmsTranslations({ locale: tLoc, namespace: "appShell.nav", page: "app-shell" });

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={isHe ? "עוד" : "More"}
        subLine={null}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2 px-5 py-6">
        <SettingsRow
          Icon={Heart}
          title={tNav("adults")}
          subtitle={isHe ? "משחקים אינטימיים בטעם טוב" : "Tasteful intimate games"}
          href="/mioshy-sex"
          isHe={isHe}
        />
        <SettingsRow
          Icon={Users}
          title={tNav("share")}
          subtitle={isHe ? "הזמינו את בן/בת הזוג למסע" : "Invite your partner"}
          href="/my/share"
          badgeLabel={shell.dots.share ? (isHe ? "חדש" : "New") : null}
          badgeTone="active"
          isHe={isHe}
        />
        <SettingsRow
          Icon={Settings}
          title={tNav("settings")}
          subtitle={isHe ? "פרופיל, התראות, מנוי" : "Profile, notifications, subscription"}
          href="/my/settings"
          isHe={isHe}
        />
      </div>
    </>
  );
}
