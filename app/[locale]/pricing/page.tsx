import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PricingCheckout } from "@/components/pricing/PricingCheckout";

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
  const base = siteUrl();
  const t = await getTranslations({ locale, namespace: "pricing" });
  const title = `Mioshy — ${t("title")}`;
  const description = t("subtitle");

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/pricing`,
      languages: {
        en: `${base}/en/pricing`,
        he: `${base}/he/pricing`,
        "x-default": `${base}/en/pricing`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/pricing`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

/**
 * /pricing — single-plan pricing surface for Mioshy Journey.
 * ──────────────────────────────────────────────────────────
 * Per Itzik 2026-05-06, the previous 3-tier grid (weekly/monthly/annual,
 * 9/37/369 ₪) was misleading — there is one Journey subscription:
 * 57 ₪/week, all included. The CTA goes through the Cardcom checkout
 * via /api/billing/checkout/create. Country detection is server-trusted
 * (Vercel geo headers), so the user doesn't have to pick a country here.
 *
 * The redesign also fixes the prior contrast issue (gray text on dark
 * purple). Background is cream with deep ink type — same palette as
 * the homepage so the user feels like they're still on Mioshy.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === "he";
  const dir = isHe ? "rtl" : "ltr";

  // Single plan: Journey weekly. 57 ₪ HE / $17 EN. Server still
  // computes the trusted price + tax; this is just for the marketing
  // surface. Anything below is for display only — the source of truth
  // for billing lives in /api/billing/checkout/create.
  const planLabel = isHe ? "ליווי שבועי — הכל כלול" : "Weekly journey — all included";
  const priceAmount = isHe ? "57" : "17";
  const priceCurrency = isHe ? "₪" : "$";
  const pricePeriod = isHe ? "/ שבוע" : "/ week";
  const cancelNote = isHe
    ? "ביטול בכל שלב, ללא חוזה."
    : "Cancel anytime, no contract.";

  // Inclusions — what's literally inside the subscription. Phrased in
  // the user's voice, not feature-bulletspeak.
  const inclusions = isHe
    ? [
        "אבחון אישי של 10 דקות עם מומחה זוגי",
        "תוכנית עבודה אישית — מתחדשת חודש בחודשו",
        "גישה מלאה לכל המשחקים בפלטפורמה (כולל הסקס של מיאושי)",
        "מענה ישיר מהמומחים בצ׳אט פנימי",
        "משימות שבועיות שעובדות על מה שחשוב לכם",
        "שני בני הזוג בפנים — מחיר אחד",
      ]
    : [
        "10-minute personal assessment with a couples expert",
        "Personal work plan — refreshed every month",
        "Full access to every game on the platform (including Mioshy's Sex)",
        "Direct chat with our experts",
        "Weekly tasks that work on what matters to you",
        "Both partners in — one price",
      ];

  return (
    <main
      dir={dir}
      lang={locale}
      className="relative min-h-[100dvh] overflow-hidden bg-[#FAF6F7] text-[#170E14]"
    >
      {/* Soft accent washes — sit behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 12% -8%, rgba(184,60,77,0.08), transparent 60%)," +
            "radial-gradient(900px 480px at 95% 90%, rgba(61,31,61,0.08), transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:pt-24">
        {/* Eyebrow */}
        <div className="mb-5 inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#170E14]">
          <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
          {isHe ? "ההצטרפות" : "Joining"}
        </div>

        {/* Headline — design language: bold + wine em + light tail. */}
        <h1
          className="text-[42px] font-bold leading-[1.05] tracking-[-0.01em] sm:text-[60px]"
          style={{ fontFamily: "'Frank Ruhl Libre', 'Noto Serif Hebrew', serif" }}
        >
          {isHe ? (
            <>
              <span>ליווי </span>
              <em
                className="not-italic font-semibold"
                style={{ color: "#B83C4D" }}
              >
                אישי
              </em>{" "}
              <span className="font-light text-[#4A3A45]">לזוגות שמתכוונים לעבוד.</span>
            </>
          ) : (
            <>
              <em
                className="not-italic font-semibold"
                style={{ color: "#B83C4D" }}
              >
                Personal
              </em>{" "}
              coaching{" "}
              <span className="font-light text-[#4A3A45]">for couples who mean it.</span>
            </>
          )}
        </h1>

        {/* Lede */}
        <p className="mt-6 max-w-xl text-[20px] leading-[1.55] text-[#4A3A45]">
          {isHe
            ? "מנוי שבועי אחד, כל הכלים בפנים. אין חבילות, אין שדרוגים — רק עבודה אמיתית עם מומחה ממיאושי שמכיר אתכם."
            : "One weekly subscription, every tool inside. No tiers, no upsells — just real work with a Mioshy expert who knows you."}
        </p>

        {/* The single pricing card. */}
        <section
          aria-label={planLabel}
          className="relative mt-12 overflow-hidden rounded-[28px] border border-[#EAE0E3] bg-white p-8 shadow-[0_24px_60px_-30px_rgba(74,23,33,0.25)] sm:p-10"
        >
          {/* Wine accent strip — top inside the card */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[6px]"
            style={{
              background:
                "linear-gradient(90deg, #B83C4D 0%, #8B2638 50%, #3D1F3D 100%)",
            }}
          />

          {/* Plan name */}
          <div className="mb-2 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#7A6A75]">
            {planLabel}
          </div>

          {/* Price block */}
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="text-[88px] font-bold leading-[1] tracking-[-0.02em] text-[#170E14]"
              style={{ fontFamily: "'Frank Ruhl Libre', serif" }}
            >
              {priceAmount}
              <span className="text-[44px]" style={{ color: "#B83C4D" }}>
                {priceCurrency}
              </span>
            </span>
            <span className="text-[18px] font-medium text-[#7A6A75]">
              {pricePeriod}
            </span>
          </div>

          <p className="mt-2 text-[14px] text-[#7A6A75]">{cancelNote}</p>

          {/* Inclusions list */}
          <ul className="mt-8 space-y-3">
            {inclusions.map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[10px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-[#B83C4D]"
                />
                <span className="text-[18px] leading-[1.55] text-[#170E14]">
                  {line}
                </span>
              </li>
            ))}
          </ul>

          {/* Checkout button — wired to Cardcom via /api/billing/checkout/create */}
          <PricingCheckout
            isHe={isHe}
            product="journey"
            plan="weekly"
            ctaLabel={isHe ? "להצטרפות" : "Join now"}
            tax_note_he="התשלום מאובטח באמצעות Cardcom. מע״מ ייווסף אם רלוונטי."
            tax_note_en="Payment secured via Cardcom. VAT added if applicable."
          />
        </section>

        {/* Trust line below */}
        <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-[#7A6A75]">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-[#B83C4D]" />
            {isHe ? "ביטול בכל שלב" : "Cancel anytime"}
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-[#3D1F3D]" />
            {isHe ? "תשלום מאובטח (Cardcom)" : "Secure payment (Cardcom)"}
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-[#1E0F1E]" />
            {isHe ? "פרטיות מלאה" : "Full privacy"}
          </li>
        </ul>
      </div>
    </main>
  );
}
