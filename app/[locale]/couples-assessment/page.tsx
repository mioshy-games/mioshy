/**
 * /couples-assessment — marketing landing for the free couples assessment.
 * Built from docs/assessment-intro-mockup-v12.html with the site design system:
 * copy via cms_texts (page "couples-assessment", seeded by migration 154) with
 * a bilingual inline fallback in <CassessContent>. The FAQ is the shared
 * homepage component, rendered server-side and slotted into the client content.
 */
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { FAQ } from "@/components/marketing/v2/FAQ";
import { MetaViewContent } from "@/components/analytics/MetaViewContent";
import { CassessContent } from "@/components/marketing/couples-assessment/CassessContent";
import { getShortQuestionCount } from "@/lib/journey/questions-db";
import { buildAlternates, buildOgLocale } from "@/lib/seo/alternates";
import type { Locale } from "@/lib/journey/types";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale !== "en";
  const title = isHe
    ? "אבחון זוגיות אונליין · חינם, כ-3 דקות | מיאושי"
    : "Online couples assessment · free | Mioshy";
  const description = isHe
    ? "אבחון זוגיות אונליין קצר, כ-3 דקות, ותקבלו תמונת מצב אישית על הזוגיות שלכם. בלי כרטיס אשראי."
    : "A short online couples assessment, about 3 minutes, for a personal picture of your relationship. No credit card.";
  return {
    title,
    description,
    // Previously emitted no canonical and no hreflang at all, so the page
    // was not indexed. Add both via the shared helper (x-default -> /he).
    alternates: buildAlternates(
      (isHe ? "he" : "en") as "he" | "en",
      "/couples-assessment",
    ),
    openGraph: {
      ...buildOgLocale((isHe ? "he" : "en") as "he" | "en"),
      type: "website",
      url: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/+$/, "")}/${isHe ? "he" : "en"}/couples-assessment`,
      siteName: "Mioshy",
      title,
      description,
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image.jpg"],
    },
  };
}

export default async function CouplesAssessmentPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const cmsRows = await loadCmsTextsForPage("couples-assessment");
  // Task 12 — live short-assessment question count injected into the entry copy
  // ("{N} שאלות · כ-2 דקות") so the promise tracks the DB, never a hardcoded number.
  const shortCount = await getShortQuestionCount();

  // Shared homepage FAQ — wrapped in .home-v2 so its design tokens resolve.
  const faqSlot = (
    <div className="home-v2">
      <FAQ
        cmsKeyPrefix="couplesAssessment.faq"
        numbers={[1, 2, 3, 4, 5]}
        anchorId="faq"
        cmsPage="couples-assessment"
        vars={{ N: shortCount }}
      />
    </div>
  );

  return (
    <CmsTextProvider rows={cmsRows}>
      <MetaViewContent
        contentIds={["couples-assessment"]}
        contentName="couples-assessment"
        contentCategory="journey"
      />
      <CassessContent locale={locale as Locale} faqSlot={faqSlot} shortCount={shortCount} />
    </CmsTextProvider>
  );
}
