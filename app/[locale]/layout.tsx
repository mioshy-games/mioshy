import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Chrome } from "@/components/Chrome";
import { getRequestUser } from "@/lib/auth/getRequestUser";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getUnreadCountForUser } from "@/lib/journey-content/notifications-read";
import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  // Determine auth + entitlements once per request so the header can:
  //   1. Show "My Mioshy" instead of "Sign in" for signed-in visitors.
  //   2. Surface ONLY the products the user actually owns (per spec §11).
  //
  // For anonymous visitors entitlements are null and the header falls back
  // to the marketing pillar links (/games, /journey, /adults).
  let isAuthed = false;
  let entitlements: {
    games: boolean;
    journey: boolean;
    adults: boolean;
  } | null = null;
  // v3 slice 10 - fetch the unread notifications count once per
  // request so the header bell badge renders without a flash of zero.
  let unreadNotifications = 0;
  // PostHog identity — pseudonymous user id only, no PII (see PostHogIdentify).
  let userId: string | null = null;
  try {
    // 2026-05-31 — getRequestUser shares this read with every downstream
    // helper in the same render (getUserEntitlements, getShellData, etc.)
    // so we collapse the 4-5 sequential Auth round-trips that the shell
    // used to pay on every navigation.
    const { user } = await getRequestUser();
    isAuthed = !!user;
    userId = user?.id ?? null;
    if (isAuthed && user) {
      const [ent, unread] = await Promise.all([
        getUserEntitlements(),
        getUnreadCountForUser(user.id).catch(() => 0),
      ]);
      if (ent) {
        entitlements = {
          games: ent.games,
          journey: ent.journey,
          adults: ent.adults,
        };
      }
      unreadNotifications = unread;
    }
  } catch {
    isAuthed = false;
    entitlements = null;
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <PostHogIdentify userId={userId} />
      <Chrome
        isAuthed={isAuthed}
        entitlements={entitlements}
        unreadNotifications={unreadNotifications}
        locale={locale}
      >
        {children}
      </Chrome>
    </NextIntlClientProvider>
  );
}
