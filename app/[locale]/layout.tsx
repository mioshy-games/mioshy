import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LocaleAttributes } from "@/components/LocaleAttributes";
import { Chrome } from "@/components/Chrome";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  // Determine auth once per request so the header can show "My Mioshy"
  // to signed-in visitors (C2b, E3).
  let isAuthed = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = !!user;
  } catch {
    isAuthed = false;
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleAttributes />
      <Chrome isAuthed={isAuthed}>{children}</Chrome>
    </NextIntlClientProvider>
  );
}
