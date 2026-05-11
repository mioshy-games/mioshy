/**
 * /[locale]/privacy - Privacy Policy.
 *
 * Server component; reads content from `legal.privacy` namespace.
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LegalPageShell, type LegalSection } from "@/components/legal/LegalPageShell";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const base = siteUrl();
  const canonical = `${base}/${locale}/privacy`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        he: `${base}/he/privacy`,
        en: `${base}/en/privacy`,
        "x-default": `${base}/en/privacy`,
      },
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: t("metaTitle"),
      description: t("metaDescription"),
      siteName: "Mioshy",
    },
  };
}

const SECTION_KEYS = [
  "dataCollected",
  "cookies",
  "thirdParties",
  "rights",
  "retention",
  "children",
  "contact",
] as const;

export default async function PrivacyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const tRoot = await getTranslations({ locale, namespace: "legal" });

  const sections: LegalSection[] = SECTION_KEYS.map((key) => {
    // Read the whole section object once — avoids next-intl logging
    // MISSING_MESSAGE for sections that legitimately don't carry a
    // `list` (e.g. cookies, retention). The previous try/catch caught
    // the throw but next-intl's onError logged before the throw.
    const section = t.raw(`sections.${key}`) as {
      heading: string;
      body:    string | string[];
      list?:   string[];
    };
    return {
      heading: section.heading,
      body:    section.body,
      list:    Array.isArray(section.list) ? section.list : undefined,
    };
  });

  const intro = t.raw("intro") as string[];

  return (
    <LegalPageShell
      locale={locale as "he" | "en"}
      title={t("title")}
      lastUpdatedLabel={tRoot("lastUpdatedLabel")}
      lastUpdated={t("lastUpdated")}
      intro={intro}
      sections={sections}
    />
  );
}
