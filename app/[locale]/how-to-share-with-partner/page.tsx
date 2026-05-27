/**
 * /[locale]/how-to-share-with-partner
 *
 * Marketing-style explainer that walks an already-subscribed user
 * through the partner-pairing flow. Linked from the
 * <PartnerShareCard> "איך זה עובד?" link inside /my.
 *
 * Why a dedicated page (not a modal): partners often skim the
 * subscriber's screen and ask "what's this code?" — having a real URL
 * to send them is easier than asking them to come look at /my. The
 * page also doubles as a support-doc target ("here's how it works")
 * we can link from emails and customer service replies.
 *
 * SEO posture — `robots: noindex, follow`. This is an authenticated-
 * adjacent explainer; we don't want it competing with the homepage in
 * search but we do want crawlers to follow links out of it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Send,
  UserPlus,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { CmsText } from "@/components/cms/CmsText";

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
  const locale = params.locale === "en" ? "en" : "he";
  const t = await getCmsTranslations({
    locale,
    namespace: "shareGuide",
    page: "my", // re-use the my-page CMS namespace
  });
  const base = siteUrl();
  const canonical = `${base}/${locale}/how-to-share-with-partner`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: true },
    alternates: {
      canonical,
      languages: {
        he: `${base}/he/how-to-share-with-partner`,
        en: `${base}/en/how-to-share-with-partner`,
        "x-default": `${base}/he/how-to-share-with-partner`,
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

const STEPS = [
  {
    key: "getCode",
    Icon: KeyRound,
    accent: "from-fuchsia-500 to-rose-500",
    accentShadow: "shadow-[0_10px_28px_-10px_rgba(232,72,153,0.7)]",
  },
  {
    key: "send",
    Icon: Send,
    accent: "from-emerald-500 to-green-500",
    accentShadow: "shadow-[0_10px_28px_-10px_rgba(16,185,129,0.7)]",
  },
  {
    key: "signup",
    Icon: UserPlus,
    accent: "from-violet-500 to-fuchsia-500",
    accentShadow: "shadow-[0_10px_28px_-10px_rgba(167,139,250,0.7)]",
  },
  {
    key: "confirm",
    Icon: CheckCircle2,
    accent: "from-amber-500 to-rose-500",
    accentShadow: "shadow-[0_10px_28px_-10px_rgba(244,114,182,0.7)]",
  },
] as const;

export default async function HowToShareWithPartnerPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div dir={isHe ? "rtl" : "ltr"} className="relative text-white">
      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-10 sm:pt-16">
        {/* ─── Back to /my ─── */}
        <div className="mb-6">
          <Link
            href={`/${locale}/my`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <Arrow className="h-4 w-4" />
            <CmsText cmsKey="shareGuide.backToHub" />
          </Link>
        </div>

        {/* ─── Hero ─── */}
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-fuchsia-100">
            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
            <CmsText cmsKey="shareGuide.eyebrow" />
          </div>
          <h1
            className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl"
            data-cms-key="shareGuide.heading"
          >
            <CmsText cmsKey="shareGuide.heading" as="span" />
          </h1>
          <CmsText
            cmsKey="shareGuide.lede"
            as="p"
            className="mt-4 max-w-2xl text-[18px] leading-[1.6] text-white/80"
          />
        </header>

        {/* ─── Steps ─── */}
        <section className="mt-12 space-y-5">
          {STEPS.map((step, idx) => {
            const Icon = step.Icon;
            return (
              <article
                key={step.key}
                className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:flex-row sm:items-start sm:gap-6"
              >
                {/* halo behind the icon */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -top-12 end-[-3rem] h-44 w-44 rounded-full bg-gradient-to-br ${step.accent} opacity-15 blur-3xl`}
                />

                {/* numbered icon plate */}
                <div className="relative flex shrink-0 items-center gap-3 sm:flex-col sm:items-center">
                  <span
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} text-white ${step.accentShadow}`}
                    aria-hidden
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="font-mono text-[28px] font-bold text-white/30 sm:text-[36px]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="relative min-w-0 flex-1">
                  <h2
                    className="font-heading text-[24px] font-bold leading-snug text-white sm:text-[26px]"
                    data-cms-key={`shareGuide.steps.${step.key}.title`}
                  >
                    <CmsText cmsKey={`shareGuide.steps.${step.key}.title`} as="span" />
                  </h2>
                  <CmsText
                    cmsKey={`shareGuide.steps.${step.key}.body`}
                    as="p"
                    className="mt-3 text-[17px] leading-[1.6] text-white/75"
                  />
                </div>
              </article>
            );
          })}
        </section>

        {/* ─── FAQ row ─── */}
        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h3 className="text-[16px] font-semibold text-white">
              <CmsText cmsKey="shareGuide.faq.q1" />
            </h3>
            <CmsText
              cmsKey="shareGuide.faq.a1"
              as="p"
              className="mt-2 text-[15px] leading-[1.55] text-white/70"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h3 className="text-[16px] font-semibold text-white">
              <CmsText cmsKey="shareGuide.faq.q2" />
            </h3>
            <CmsText
              cmsKey="shareGuide.faq.a2"
              as="p"
              className="mt-2 text-[15px] leading-[1.55] text-white/70"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h3 className="text-[16px] font-semibold text-white">
              <CmsText cmsKey="shareGuide.faq.q3" />
            </h3>
            <CmsText
              cmsKey="shareGuide.faq.a3"
              as="p"
              className="mt-2 text-[15px] leading-[1.55] text-white/70"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h3 className="text-[16px] font-semibold text-white">
              <CmsText cmsKey="shareGuide.faq.q4" />
            </h3>
            <CmsText
              cmsKey="shareGuide.faq.a4"
              as="p"
              className="mt-2 text-[15px] leading-[1.55] text-white/70"
            />
          </div>
        </section>

        {/* ─── CTA back to /my ─── */}
        <section className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/15 via-white/5 to-rose-500/15 p-6 text-center backdrop-blur sm:p-8">
          <CmsText
            cmsKey="shareGuide.ctaTitle"
            as="p"
            className="text-[20px] font-semibold text-white"
          />
          <CmsText
            cmsKey="shareGuide.ctaBody"
            as="p"
            className="max-w-xl text-[16px] leading-[1.55] text-white/75"
          />
          <Link
            href={`/${locale}/my`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-6 text-[16px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(232,72,153,0.8)] transition hover:brightness-110"
          >
            <CmsText cmsKey="shareGuide.ctaButton" />
            <Arrow className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
