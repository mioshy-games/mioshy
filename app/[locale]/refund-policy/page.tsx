/**
 * /[locale]/refund-policy - Refund Policy.
 *
 * Short, clear elaboration of the no-refund stance from the Terms,
 * with the cancellation flow + Israeli consumer-law disclaimer.
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
  const t = await getTranslations({ locale, namespace: "legal.refund" });
  const base = siteUrl();
  const canonical = `${base}/${locale}/refund-policy`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        he: `${base}/he/refund-policy`,
        en: `${base}/en/refund-policy`,
        "x-default": `${base}/en/refund-policy`,
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
  "policy",
  "why",
  "cancel",
  "billingErrors",
  "consumer",
] as const;

export default async function RefundPolicyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.refund" });
  const tRoot = await getTranslations({ locale, namespace: "legal" });

  const sections: LegalSection[] = SECTION_KEYS.map((key) => {
    // Read the whole section object once — avoids next-intl logging
    // MISSING_MESSAGE for sections that legitimately don't carry a
    // `list`. The previous try/catch caught the throw but next-intl's
    // onError logged before it.
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
