/**
 * /[locale]/marathon (G2)
 *
 * Free 7-day couples marathon — lead-capture landing. Thin server wrapper that
 * loads the page's CMS rows, mounts CmsTextProvider (so marathon.* copy is
 * admin-editable; falls back to messages/*.json otherwise), and renders the
 * client <MarathonForm/>. Force-dynamic: it's a lead-capture surface, no caching.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { MarathonForm } from "@/components/marathon/MarathonForm";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";
import { buildAlternates } from "@/lib/seo/alternates";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Metadata {
  const isHe = params.locale === "he";
  return {
    title: isHe ? "מרתון זוגי 7 ימים — חינם · Mioshy" : "A 7-day couples marathon — Free · Mioshy",
    description: isHe
      ? "7 ערבים, כלי אימון זוגי קטן בכל פעם, בוואטסאפ. חינם לגמרי, בלי התחייבות."
      : "7 evenings, one small couples exercise each time, on WhatsApp. Completely free, no commitment.",
    // The marathon programme hasn't launched yet, so keep it out of the index
    // for now (Itzik 2026-07-05). When it launches we open it to organic:
    // flip index->true, add it to app/sitemap.ts, and link it from nav/footer.
    robots: { index: false, follow: true },
    alternates: buildAlternates(isHe ? "he" : "en", "/marathon"),
  };
}

export default async function MarathonPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const cmsRows = await loadCmsTextsForPage("marathon");
  // ONE approved consent wording for every lead-capture point on the site
  // (same source as the signup screen) — see MarathonForm's header.
  const consent = await getOtpConsentCopy(locale === "en" ? "en" : "he");

  return (
    <CmsTextProvider rows={cmsRows}>
      <main
        dir={locale === "he" ? "rtl" : "ltr"}
        className="min-h-screen px-4 py-8 sm:py-12"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #1e0b2e 0%, #0b0712 60%)",
        }}
      >
        <div className="mx-auto w-full max-w-[560px]">
          <MarathonForm consent={consent} />
        </div>
      </main>
    </CmsTextProvider>
  );
}
