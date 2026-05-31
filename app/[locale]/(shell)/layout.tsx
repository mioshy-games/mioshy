/**
 * Post-login application shell layout.
 *
 * Wraps every authenticated route inside the `(shell)` route group with
 * the new design: sticky right sidebar (desktop) + sticky bottom tabs
 * (mobile). Marketing pages, /auth, and game-in-play routes stay
 * OUTSIDE this group and render with their existing chrome.
 *
 * Today the (shell) group is empty — Step 3+ of the post-login redesign
 * will migrate /my/today, /my/lessons, etc. into here. This file exists
 * so the layout is ready to wrap them the moment they land, AND so a
 * smoke-test page (see ./_dev-preview/) can verify the chrome renders
 * end-to-end during the rollout.
 *
 * Auth gate: getShellData() returns null when the user isn't logged in.
 * We redirect to /auth in that case so a deep-link into any shell route
 * lands on signup instead of an empty shell with placeholder identity.
 *
 * Added 2026-05-29.
 * Visual spec: post-login-mockup-v12.html.
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AppShell, buildNavItems } from "@/components/shell";
import type { NavKey, ShellChrome } from "@/components/shell";
import { getShellData } from "@/lib/shell/getShellData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);

  const isHe = locale === "he";

  // Resolve identity / expert / badges. Null = redirect to auth.
  const data = await getShellData({ locale: isHe ? "he" : "en" });
  if (!data) {
    redirect(`/${locale}/auth`);
  }

  // CMS-backed string lookups. Migration 098 backfilled the 69 keys
  // into cms_texts (page='app-shell'), so admins can edit nav labels +
  // empty-states live from /admin/content without a deploy. Falls back
  // to messages/{he,en}.json when the DB has no row.
  const tLocale = isHe ? "he" : "en";
  const t = await getCmsTranslations({
    locale: tLocale,
    namespace: "appShell",
    page: "app-shell",
  });
  const tNav = await getCmsTranslations({
    locale: tLocale,
    namespace: "appShell.nav",
    page: "app-shell",
  });
  const tGroup = await getCmsTranslations({
    locale: tLocale,
    namespace: "appShell.group",
    page: "app-shell",
  });

  // The translation function in next-intl v3 isn't generic over the
  // string-literal key, so a tiny wrapper keeps the call sites typed.
  const labels: Record<NavKey, string> = {
    // 2026-05-31 — `today` dropped; Lessons is the post-login landing.
    lessons:  tNav("lessons"),
    expert:   tNav("expert"),
    games:    tNav("games"),
    adults:   tNav("adults"),
    share:    tNav("share"),
    settings: tNav("settings"),
  };

  const chrome: ShellChrome = {
    rootCrumbLabel: t("rootCrumb"),
    logoutLabel:    t("logout"),
    groupHeadings: {
      journey: tGroup("journey"),
      games:   tGroup("games"),
      account: tGroup("account"),
    },
  };

  const navItems = buildNavItems({
    labels,
    badges: data.badges,
    dots:   data.dots,
  });

  // Override ExpertMini's askLabel with the CMS-controlled string so it
  // stays in sync if Itzik edits the copy later.
  const expert = data.expert
    ? { ...data.expert, askLabel: t("askExpert") }
    : null;

  return (
    <>
      <AppShell
        navItems={navItems}
        couple={data.couple}
        expert={expert}
        chrome={chrome}
        moreLabel={t("moreTab")}
      >
        {children}
      </AppShell>
      {/* 2026-05-31 — mount Sonner Toaster for the shell. Without this,
          `toast.error(...)` calls in shell client components (chat send,
          mark-seen errors, etc.) were silent — explaining "the button
          does nothing" reports. Marketing layouts mount their own. */}
      <Toaster position={isHe ? "top-left" : "top-right"} richColors closeButton />
    </>
  );
}
