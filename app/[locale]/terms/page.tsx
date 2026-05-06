/**
 * /[locale]/terms - Terms of Service.
 *
 * Server component; reads the entire content from the `legal.terms`
 * namespace via `t.raw()` so the marketing/legal team can edit copy
 * directly in `messages/{he,en}.json` without touching React.
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
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const base = siteUrl();
  const canonical = `${base}/${locale}/terms`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        he: `${base}/he/terms`,
        en: `${base}/en/terms`,
        "x-default": `${base}/en/terms`,
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
  "acceptance",
  "service",
  "account",
  "payment",
  "cancellation",
  "liability",
  "ip",
  "prohibited",
  "changes",
  "governing",
  "consumer",
  "contact",
] as const;

export default async function TermsPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const tRoot = await getTranslations({ locale, namespace: "legal" });

  const sections: LegalSection[] = SECTION_KEYS.map((key) => {
    const heading = t(`sections.${key}.heading`);
    const body = t.raw(`sections.${key}.body`) as string | string[];
    let list: string[] | undefined;
    try {
      const raw = t.raw(`sections.${key}.list`);
      if (Array.isArray(raw)) list = raw as string[];
    } catch {
      list = undefined;
    }
    return { heading, body, list };
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
      footer={<CompanyDetails locale={locale as "he" | "en"} />}
    />
  );
}

async function CompanyDetails({ locale }: { locale: "he" | "en" }) {
  const t = await getTranslations({ locale, namespace: "legal.company" });
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        {t("label")}
      </p>
      <p className="text-white/80">{t("legalName")}</p>
      <p>{t("regNumber")}</p>
      <p>{t("address")}</p>
      <p>
        <a
          href={`mailto:${t("email")}`}
          className="text-white/80 underline underline-offset-4 transition hover:text-white"
        >
          {t("email")}
        </a>
      </p>
      <p className="pt-2 text-xs text-white/45">{t("footnote")}</p>
    </div>
  );
}
