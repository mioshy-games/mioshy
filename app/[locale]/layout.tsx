import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Chrome } from "@/components/Chrome";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getUnreadCountForUser } from "@/lib/journey-content/notifications-read";

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
  // v3 slice 10 — fetch the unread notifications count once per
  // request so the header bell badge renders without a flash of zero.
  let unreadNotifications = 0;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = !!user;
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
