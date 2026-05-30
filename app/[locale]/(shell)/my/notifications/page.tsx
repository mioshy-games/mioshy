/**
 * /my/notifications — the user's notification inbox.
 *
 *   <PageHeader>            sticky top bar (the bell icon points here)
 *   <NotificationsList>     list with mark-all + per-row mark-on-click
 *
 * Reuses the existing notifications-read + journey-notifications action
 * pair so the public-site bell dropdown and this full page share one
 * source of truth for read state.
 *
 * Added 2026-05-29 (Step B6 of the post-login redesign).
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { NotificationsList } from "@/components/shell/notifications/NotificationsList";

import { getShellData } from "@/lib/shell/getShellData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { getNotificationsForUser } from "@/lib/journey-content/notifications-read";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
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
  const t = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell",
    page: "app-shell",
  });
  const tN = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell.notifications",
    page: "app-shell",
  });

  // Pull a generous slice — the dropdown shows 20, the full page can
  // afford 50. We don't paginate yet; once a user accumulates >50
  // notifications a "load more" button can come in a follow-up.
  const rows = await getNotificationsForUser(shell.userId, { limit: 50 });

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tN("pageTitle")}
        subLine={null}
        bellCount={0 /* we're on the bell page; suppress the badge */}
      />

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-5 py-6">
        <NotificationsList
          initial={rows}
          isHe={isHe}
          labels={{
            markAllLabel:    tN("markAllLabel"),
            markingLabel:    tN("markingLabel"),
            emptyTitle:      tN("emptyTitle"),
            emptyBody:       tN("emptyBody"),
            nothingLeftLabel: tN("nothingLeftLabel"),
          }}
        />
      </div>
    </>
  );
}
