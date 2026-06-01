/**
 * /my/settings — profile + subscription. Logout is intentionally NOT
 * here (per Itzik directive 2026-05-29) — it lives in the sidebar so
 * the user always has it one click away.
 *
 *   <PageHeader>
 *   Section: פרופיל              (3 rows)
 *   Section: מנוי וחיוב          (2 rows)
 *
 * Each row links to an existing page (or external billing surface).
 * We don't build new sub-pages in this step — the sidebar nav already
 * exposes everything the user needs at the top level.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Bell, CreditCard, FileText, Shield, User } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsRow } from "@/components/shell/settings/SettingsRow";

import { getShellData } from "@/lib/shell/getShellData";
import { getSettingsData } from "@/lib/shell/settings/getSettingsData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function SettingsPage({
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
  const tSet = await getCmsTranslations({ locale: tLoc, namespace: "appShell.settings", page: "app-shell" });

  const data = await getSettingsData({
    userId: shell.userId,
    locale: isHe ? "he" : "en",
  });

  // Build the "personal details" sub-line — concatenate non-empty
  // identifiers separated by a middot. Falls back to a fixed label.
  const profileSubtitle = (() => {
    const parts: string[] = [];
    if (data.profile.fullName) parts.push(data.profile.fullName);
    if (data.profile.email) parts.push(data.profile.email);
    if (data.profile.phone) parts.push(data.profile.phone);
    if (parts.length === 0) return tSet("personalDetailsDefault");
    return parts.join(" · ");
  })();

  return (
    <>
      <PageHeader
        rootLabel={t("rootCrumb")}
        pageLabel={tSet("pageTitle")}
        subLine={isHe ? "החשבון" : "Account"}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4 px-5 py-6">

        {/* Profile section */}
        <section className="flex flex-col gap-2.5">
          <h3
            className="m-0 pt-1 text-[18px] font-extrabold tracking-tight"
            style={{ color: "var(--shell-text-1)" }}
          >
            {tSet("profileTitle")}
          </h3>
          <div className="flex flex-col gap-2">
            <SettingsRow
              Icon={User}
              title={tSet("personalDetailsTitle")}
              subtitle={profileSubtitle}
              href="/account"
              isHe={isHe}
            />
            <SettingsRow
              Icon={Bell}
              title={tSet("notificationsTitle")}
              subtitle={tSet("notificationsSub")}
              href="/account"
              isHe={isHe}
            />
            <SettingsRow
              Icon={Shield}
              title={tSet("securityTitle")}
              subtitle={tSet("securitySub")}
              href="/account"
              isHe={isHe}
            />
          </div>
        </section>

        {/* Subscription section */}
        <section className="flex flex-col gap-2.5">
          <h3
            className="m-0 pt-1 text-[18px] font-extrabold tracking-tight"
            style={{ color: "var(--shell-text-1)" }}
          >
            {tSet("subscriptionTitle")}
          </h3>
          <div className="flex flex-col gap-2">
            {/* 2026-06-01 — both rows used to link to `/billing`, which
                doesn't exist as a top-level user page (the existing
                billing flows live at /billing/success + /billing/error
                only). The real billing surface is `/account`, which
                already lists every subscription + invoice link the
                user can act on. Pointing both rows there closes the
                404 without spinning up a new page. */}
            <SettingsRow
              Icon={CreditCard}
              title={tSet("subscriptionRowTitle")}
              subtitle={
                data.subscription?.subtitle ?? tSet("subscriptionEmpty")
              }
              href="/account"
              badgeLabel={data.subscription?.statusLabel ?? null}
              badgeTone={data.subscription?.statusTone ?? "neutral"}
              isHe={isHe}
            />
            <SettingsRow
              Icon={FileText}
              title={tSet("invoicesTitle")}
              subtitle={tSet("invoicesSub")}
              href="/account#invoices"
              isHe={isHe}
            />
          </div>
        </section>

      </div>
    </>
  );
}
