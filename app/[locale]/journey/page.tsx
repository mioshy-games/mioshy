/**
 * /[locale]/journey - MARKETING PAGE.
 *
 * Pre-purchase pillar landing page for "Journey" - the structured
 * content-delivery product line. Sits parallel to /games and /adults.
 *
 * VISUAL DIRECTION (V2):
 *   - Hero stays dark (deep indigo-violet voyage palette + emerald/amber
 *     accents) so the journey identity reads at first glance.
 *   - Below the hero we switch to the V2 wine-palette language shared
 *     with /games and the homepage: cream sections, warm-cream cards,
 *     a dark editorial card "break" mid-page, magazine chapter numbers
 *     for the 3-step flow, and an auth-banner-style stat strip with a
 *     gradient mask that fades into the section bg on left/right.
 *   - The page reads as: dark identity → cream story → dark editorial
 *     punch → cream closer → quiet FAQ.
 *
 * Routing matrix (see docs/journey-content-system-design.md §9):
 *   - unauthenticated              → marketing + "Take the assessment" CTA
 *   - authed, in-progress journey  → marketing + "Resume assessment" chip
 *   - authed, active assignments   → "Open your journey" banner above the
 *                                    hero, primary CTA points at
 *                                    /journey/timeline (no assignment ever
 *                                    gets lost behind a second funnel step).
 *
 * `hasActiveAssignments` comes from getOwnerJourneyStatus() and honors the
 * couple-preferred-owner rule - so a paired user sees the couple's
 * journey, not their private pre-pairing one.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import Image from "next/image";
import { notFound } from "next/navigation";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { unstable_noStore as noStore } from "next/cache";
import {
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";
import { Link } from "@/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { JourneyCheckoutButton } from "@/components/journey/JourneyCheckoutButton";
// `JourneyHubDiagProbe` import removed 2026-05-19 along with the
// orbs field. Probe file kept on disk for future debugging.
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
// FAQ uses the same scoped CSS as the homepage v2 FAQ - wrapper class .home-v2
import "@/components/marketing/v2/styles.css";

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
  // CMS-backed translator: cms_texts row wins; messages/<locale>.json
  // is the fallback. Drop-in for `getTranslations({...})`.
  const t = await getCmsTranslations({
    locale: locale === "he" ? "he" : "en",
    namespace: "journeyHub",
    page: "journey",
  });
  const title = t("metaTitle");
  const description = t("metaDescription");
  // og:image:alt — localized; safe fallback to title if missing.
  let ogImageAlt = title;
  try { ogImageAlt = t("ogImageAlt"); } catch { /* fallback to title */ }
  const canonical = `${base}/${locale}/journey`;
  return {
    title,
    description,
    keywords: t("metaKeywords")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/journey`,
        he: `${base}/he/journey`,
        "x-default": `${base}/en/journey`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "Mioshy",
      locale: locale === "he" ? "he_IL" : "en_US",
      alternateLocale: locale === "he" ? ["en_US"] : ["he_IL"],
      images: [
        { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: ogImageAlt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        { url: "/twitter-image.jpg", width: 1200, height: 630, alt: ogImageAlt },
      ],
    },
  };
}

export default async function JourneyMarketingPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const isHe = locale === "he";
  // CMS-backed translator (see lib/cms/getCmsTranslations.ts).
  // Retained for raw-string slots — metadata, JSON-LD breadcrumbs, alt
  // attributes — where HTML can't render anyway. JSX-child consumers
  // below render via <CmsText> instead so they pick up the is_rich
  // flag from each CMS row and render <em>/<strong> styled per the
  // .cms-rich class in globals.css.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "journeyHub",
    page: "journey",
  });
  // CMS rows for this page → handed to <CmsTextProvider> so every
  // nested <CmsText> can look up its row by key and apply the
  // is_rich/typography overrides set in the admin editor.
  const cmsRows = await loadCmsTextsForPage("journey");

  // ── State-aware CTA wiring ──────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasInProgressAssessment = false;
  let hasActiveAssignments = false;
  let hasJourneyEntitlement = false;
  if (user) {
    const ctx = await getCurrentCoupleContext();
    const status = await getOwnerJourneyStatus({
      userId: user.id,
      coupleId: ctx?.couple_id ?? null,
    });
    hasActiveAssignments = status.hasActiveAssignments;
    hasInProgressAssessment =
      !hasActiveAssignments && status.hasInProgressAssessment;
    const entitlements = await getUserEntitlements(user.id).catch(() => null);
    hasJourneyEntitlement = !!entitlements?.journey;
  }

  // ─── Locked view for logged-in members without a Journey subscription ──
  // Per Itzik 2026-05-02: anyone signed in but without an active Journey
  // entitlement gets a single dedicated "this is locked, here's why you
  // want it" page instead of the marketing wall. Anonymous visitors keep
  // seeing the full marketing page below - they're not yet members and
  // need the broader pitch.
  if (user && !hasJourneyEntitlement) {
    return (
      <CmsTextProvider rows={cmsRows}>
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative isolate min-h-[100dvh] overflow-hidden text-white"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#0E0810_0%,#1A0B14_55%,#1E0F1E_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(1100px 640px at 14% 0%, rgba(252,202,101,0.45), transparent 62%), " +
              "radial-gradient(900px 520px at 88% 12%, rgba(217,70,239,0.32), transparent 48%), " +
              "radial-gradient(700px 460px at 50% 40%, rgba(139,38,56,0.22), transparent 65%)",
          }}
        />
        <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-16 sm:pt-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
            <CmsText cmsKey="journeyHub.locked.badge" />
          </div>
          {/* Locked-state H1 — applies the Mioshy design language: bold
              anchor + wine-color em + light tail. Per Itzik 2026-05-06.
              3 CMS slices so admin can edit each phrase independently. */}
          <h1 className="mt-5 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            <CmsText cmsKey="journeyHub.locked.h1Lead" />
            {" "}
            <CmsText
              cmsKey="journeyHub.locked.h1Highlight"
              as="em"
              className="not-italic font-semibold text-rose-300"
            />
            {" "}
            <CmsText
              cmsKey="journeyHub.locked.h1Tail"
              className="font-light text-white/80"
            />
          </h1>
          {/* Lede — bumped to text-[20px] (was text-lg ≈ 18px) so the
              promise reads first, prompts second. */}
          <CmsText
            cmsKey="journeyHub.locked.lede"
            as="p"
            className="mt-6 text-[20px] leading-[1.55] text-white/85"
          />
          <CmsText
            cmsKey="journeyHub.locked.subLede"
            as="p"
            className="mt-3 text-[18px] leading-[1.55] text-white/70"
          />

          {/* Primary CTA bumped to h-14/text-base + bigger shadow per
              Itzik 2026-05-06 — this is the only meaningful action on a
              locked screen, so it can't be the same size as the secondary. */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {/* W1.1 — clicks the real Cardcom checkout instead of /pricing.
                The previous Link bounced through a marketing page with no
                clear path to payment; users hit a dead end. */}
            <JourneyCheckoutButton
              isHe={isHe}
              label={t("locked.ctaJoin")}
              variant="white"
              source="journey_landing_locked"
              // Per Itzik 2026-05-27 — post-purchase always lands on /my
              // (the hub), not /my/journey, so the user sees the
              // PartnerShareCard immediately and can invite their
              // partner before opening the workspace.
              returnPath={`/${isHe ? "he" : "en"}/my`}
            />
            <Link
              href="/my"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 text-[16px] font-medium text-white backdrop-blur hover:bg-white/20 transition"
            >
              <CmsText cmsKey="journeyHub.locked.backLink" />
            </Link>
          </div>

          <ul className="mt-12 grid gap-3 text-left sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 backdrop-blur"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <CmsText cmsKey={`journeyHub.trust.${i}`} as="span" />
              </li>
            ))}
          </ul>
        </main>
      </div>
      </CmsTextProvider>
    );
  }

  // SEO JSON-LD
  const base = siteUrl();
  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    q: t(`faq.items.${i}.q`),
    a: t(`faq.items.${i}.a`),
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("breadcrumbHome"),
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: t("breadcrumbJourney"),
            item: `${base}/${locale}/journey`,
          },
        ],
      },
      {
        "@type": "WebPage",
        name: t("metaTitle"),
        description: t("metaDescription"),
        url: `${base}/${locale}/journey`,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: { "@type": "Answer", text: it.a },
        })),
      },
    ],
  };

  // ── Section data ────────────────────────────────────────────────────────
  // V2 wine-palette unified card design - same icon-tile chrome across all 4,
  // only icon and stat differ. No more rainbow.
  // whyMeta — icon + colour are presentation, the stat label comes from
  // CMS via journeyHub.why.stats.<i>.label (rendered through <CmsText>
  // at the consumer site so admins can edit per item).
  // 2026-05-21 — the "מותאם לכם" (Compass / stats[0]) card was removed
  // at Itzik's request; remaining 3 cards center on desktop and stretch
  // slightly wider in their grid track. CMS rows for index 0 stay in
  // cms_texts (journeyHub.why.{stats,items}.0.*) untouched so the card
  // can be re-introduced by restoring this array entry and switching
  // the loop back to [0,1,2,3]. The loop below intentionally iterates
  // cms indices [1,2,3] while indexing `whyMeta` 0..2 — that keeps the
  // admin's existing rows stable instead of renumbering them.
  // 2026-06-09 — the per-card icon tiles (Clock / BookOpen /
  // HeartHandshake) were removed from the "why" cards per Itzik, so the
  // whyMeta presentation array is no longer needed.

  // `insideMeta` removed 2026-05-21 alongside the INSIDE section
  // (id="inside"). If the section is brought back, restore from
  // git: `git show HEAD~1 -- app/[locale]/journey/page.tsx | grep
  // -A 6 insideMeta`. The lucide imports (Target / MessageCircle /
  // Video) may now be unused — Next/TS will warn.

  // When the viewer already has an active journey, the assessment funnel
  // is a detour - send them straight to the timeline from every CTA.
  const primaryHref = hasActiveAssignments
    ? "/journey/timeline"
    : "/journey/assessment";
  const secondaryHref = "#how";
  const primaryLabel = hasActiveAssignments
    ? t("openJourney")
    : hasInProgressAssessment
      ? t("ctaResume")
      : t("ctaPrimary");

  return (
    <CmsTextProvider rows={cmsRows}>
    <div
      className="relative min-h-[100dvh] overflow-hidden text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* Hero backdrop - kept dark voyage palette as the journey identity */}
      {/* Base dark gradient — switched 2026-05-19 from indigo-voyage
          to wine-charcoal so the page sits in the Mioshy brand family
          (wine #FCCA65 + magenta + violet), not in the cool emerald
          voyage that didn't fit the brand identity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[110vh] bg-[linear-gradient(180deg,#0E0810_0%,#1A0B14_55%,#1E0F1E_100%)]"
      />
      {/* Wine aurora wash. Opacities bumped from 0.22/0.16/0.10 → 0.45/0.32/0.22
          per Itzik 2026-05-19 — the original gradient was too faint to read
          as "atmospheric" against the dark base. */}
      {/* Wine + magenta + violet aurora wash.
          2026-05-19 round 6 — third tone added per Itzik. The first
          two stops (wine + magenta) sit in the upper corners; the new
          third stop is violet anchored in the lower-centre and
          overlaps both upper stops in the mid-band — wine → magenta
          → violet blend across the page instead of three separate
          washes. Opacities bumped 0.45/0.32/0.22 → 0.55/0.45/0.40 so
          the gradient reads as present and the overlap zone is rich. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] animate-aurora-drift"
        data-testid="journey-aurora"
        style={{
          background:
            "radial-gradient(1100px 640px at 14% 0%, rgba(252,202,101,0.55), transparent 62%), " +
            "radial-gradient(900px 520px at 88% 12%, rgba(217,70,239,0.45), transparent 60%), " +
            "radial-gradient(900px 560px at 50% 65%, rgba(168,85,247,0.40), transparent 60%)",
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <main className="relative">
        {/* ════════════════════════════════════════════════════════════
            1. HERO - dark voyage palette (kept)
        ════════════════════════════════════════════════════════════ */}
        <section className="relative">
          {/* Breadcrumb integrated into the hero — see games/page.tsx
              for the rationale. Same treatment for visual consistency. */}
          <nav
            aria-label="breadcrumb"
            className="relative z-20 mx-auto hidden max-w-6xl items-center gap-2 px-4 pt-4 text-[13px] text-white/45 sm:flex"
          >
            <Link href="/" className="transition hover:text-white/75">
              <CmsText cmsKey="journeyHub.breadcrumbHome" />
            </Link>
            <span aria-hidden className="text-white/30">/</span>
            <CmsText
              cmsKey="journeyHub.breadcrumbJourney"
              as="span"
              className="text-white/65"
            />
          </nav>

          {/* Animated background - converging emerald ↔ amber blobs, floating
              orb, and 12 small drifting circles. Mirrors the homepage hero
              animation system but in the journey voyage palette.
              Lifted from -z-10 to z-0 so the layer paints above the aurora
              wash and the orbs/blobs read clearly. Content above sets its
              own positive z-index. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          >
            {/* Converging pair - emerald (left) ↔ amber (right) */}
            <div className="journey-blob journey-blob-1" />
            <div className="journey-blob journey-blob-2" />

            {/* Soft floating circle */}
            <div className="journey-floating-circle" />

            {/* Floating orbs removed 2026-05-19 per Itzik — they
                didn't fit the page after sizing experiments. CSS rule
                `.journey-orbs-field` + keyframes left in disk (inert)
                for possible later reuse. */}
          </div>
          {/* `JourneyHubDiagProbe` removed 2026-05-19 — orbs are gone,
              the probe is no longer useful. File kept on disk. */}

          {/* 2026-05-21 — hero top/bottom padding tightened so the
              block doesn't feel oversized. Mobile: pt-10→pt-6,
              pb-12→pb-6. Desktop: sm:pt-12→sm:pt-8, sm:pb-32→sm:pb-16.
              Inner spacing (mt-* on headline, lede, CTAs) untouched. */}
          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-6 pt-6 text-center sm:pb-16 sm:pt-8">
            {/* `journeyHub.badge` pill removed 2026-05-20 per Itzik
                ("ליווי עם מיאושי · Personalised coaching"). The CMS
                row stays in cms_texts in case the badge is brought
                back; only the JSX render is gone. The Sparkles icon
                import may now be unused — Next/ts will warn if so. */}

            {/* Preheader — calls out the personal-coaching value
                proposition above the headline. Per Itzik 2026-05-07. */}
            <CmsText
              cmsKey="journeyHub.preheader"
              as="p"
              className="mt-5 text-[15px] font-medium uppercase tracking-[0.18em] text-fuchsia-200/80"
            />

            {/* Headline — H1 + italic light-weight subtitle so the
                two-word lockup ("ליווי עם מיאושי" + "מותאם אישית")
                reads as one branded statement. */}
            <h1
              className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl"
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                fontWeight: 600,
              }}
            >
              <CmsText
                cmsKey="journeyHub.h1"
                as="span"
                className="bg-gradient-to-br from-white via-rose-100 to-fuchsia-200 bg-clip-text text-transparent"
              />
              <CmsText
                cmsKey="journeyHub.h1Sub"
                as="span"
                className="mt-2 block text-[0.7em] font-light text-rose-100/75"
                style={{ fontStyle: "italic" }}
              />
            </h1>

            {/* Hero photograph — replaced the gradient placeholder
                2026-05-18 per Itzik. The container keeps the same
                rounded-3xl frame; `object-cover` lets the image fill
                the strip without distortion across viewports.
                2026-05-28 — exposed on mobile per Itzik (was
                hidden sm:block). Mobile gets a shorter 140px strip
                so the image doesn't dominate the hero on small
                screens, desktop sm:h-[180px] is unchanged. */}
            <div className="mx-auto mt-8 max-w-3xl">
              <div
                aria-hidden
                className="relative h-[140px] overflow-hidden rounded-3xl border border-rose-300/25 sm:h-[180px]"
              >
                <Image
                  src="/images/Journey-couple.webp"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority={false}
                />
              </div>
            </div>

            <CmsText
              cmsKey="journeyHub.lede"
              as="p"
              className="mx-auto mt-8 max-w-2xl text-pretty text-[20px] leading-[1.65] text-white/80 sm:text-[20px]"
            />

            {hasActiveAssignments ? (
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-4 py-1.5 text-xs font-medium text-rose-100 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <CmsText cmsKey="journeyHub.activeAssignmentsBanner" />
              </div>
            ) : hasInProgressAssessment ? (
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/35 bg-fuchsia-400/10 px-4 py-1.5 text-xs font-medium text-fuchsia-100 backdrop-blur-md">
                <Clock className="h-3.5 w-3.5" />
                <CmsText cmsKey="journeyHub.resumeHint" />
              </div>
            ) : null}

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="group relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-full px-9 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#F43F5E_0%,#EC4899_45%,#A855F7_100%)] bg-[length:220%_100%] mio-journey-gradient-shift"
                />
                <span className="relative z-10 inline-flex items-center">
                  {primaryLabel}
                  <ArrowRight
                    className={`ms-2 h-5 w-5 transition group-hover:translate-x-1 ${
                      isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                    }`}
                  />
                </span>
              </Link>
              <a
                href={secondaryHref}
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 text-base font-semibold text-white/85 backdrop-blur-md transition hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                <CmsText cmsKey="journeyHub.ctaSecondary" />
              </a>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/70">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      ["bg-rose-300", "bg-fuchsia-300", "bg-violet-300", "bg-pink-300"][i]
                    }`}
                  />
                  <CmsText cmsKey={`journeyHub.trust.${i}`} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            LIGHT WRAPPER - V2 cream language for everything below
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-white text-slate-900">

          {/* ════════════════════════════════════════════════════════════
              2. WHY - light cream, 4 unified cards w/ stat chips
          ════════════════════════════════════════════════════════════ */}
          <section
            id="why"
            className="relative bg-white px-4 pb-[30px] pt-[75px]"
          >
            <div className="mx-auto max-w-6xl">
              {/* 2026-06-09 — widened max-w-3xl (768px) → 820px per Itzik
                  so the "למי זה מתאים" headline has more room per line. */}
              <div className="mx-auto max-w-[890px] text-center">
                <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#FCCA65] shadow-[0_0_0_3px_rgba(252,202,101,0.18)]" />
                  <CmsText cmsKey="journeyHub.why.badge" />
                </span>
                <CmsText
                  cmsKey="journeyHub.why.title"
                  as="h2"
                  className="mt-5 section-h2 font-bold tracking-[-0.02em] text-[#170E14]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* 3-up grid (was 4-up). Centered with mx-auto + max-w-5xl
                  so the cards stretch slightly wider than they did at
                  4-up but don't fill the whole 6xl section width — keeps
                  visual balance with the section heading above. */}
              {/* 2026-06-09 — widened max-w-5xl → 1158px per Itzik so each
                  of the 3 columns is ~370px (was ~325px), fitting more
                  words per line. 3×370 + 2×24(gap) = 1158. */}
              <div className="mx-auto mt-7 grid max-w-[1158px] gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((cmsIndex) => {
                  return (
                    <div
                      key={cmsIndex}
                      className="group relative flex flex-col gap-3 p-5 sm:p-7"
                    >
                      {/* 2026-06-09 — card chrome (bg/border/shadow/accent
                          line), the icon tile, and the category label pill
                          (journeyHub.why.stats.*.label) were all removed
                          per Itzik. Cards are now just heading + body, flat
                          on the section bg. The stats.*.label CMS rows stay
                          on disk. */}
                      <CmsText
                        cmsKey={`journeyHub.why.items.${cmsIndex}.h`}
                        as="h3"
                        className="text-[26px] leading-[1.1] tracking-[-0.01em] text-[#170E14]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontWeight: 600,
                        }}
                      />
                      <CmsText
                        cmsKey={`journeyHub.why.items.${cmsIndex}.p`}
                        as="p"
                        className="text-[20px] leading-[1.5] text-[#170E14] sm:flex-1"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Social-proof pull-quote block (eyebrow "המסלול שלכם",
                  the serif sentence, trial qualifier, kicker hairlines,
                  and the gradient assessment CTA) removed 2026-05-21
                  per Itzik — the section already has its own heading
                  and "Why" cards, and the pull-quote ended up feeling
                  like noise after the line1Emphasis / line2Before /
                  line2Emphasis fragments were stripped one by one. The
                  CMS rows journeyHub.pullQuote.{eyebrow,line1After,
                  trial,kicker} stay in cms_texts so the whole block
                  can be rebuilt by restoring this JSX from git. */}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              3. HOW IT WORKS - magazine chapter cards (3 stages)
          ════════════════════════════════════════════════════════════ */}
          <section
            id="how"
            className="relative overflow-hidden bg-white px-4 pb-6 pt-[35px] lg:pb-7"
          >
            {/* Soft accent glow at top */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(900px 500px at 50% -10%, rgba(252,202,101,0.07), transparent 48%)",
              }}
            />

            <div className="relative mx-auto max-w-6xl">
              {/* 2026-06-09 — widened max-w-2xl (672px) → 750px per Itzik
                  so the "איך תוכנית הליווי..." headline has more room. */}
              <div className="mx-auto max-w-[750px] text-center">
                <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#FCCA65] shadow-[0_0_0_3px_rgba(252,202,101,0.18)]" />
                  <CmsText cmsKey="journeyHub.how.badge" />
                </span>
                <CmsText
                  cmsKey="journeyHub.how.title"
                  as="h2"
                  className="mt-7 section-h2 tracking-[-0.02em] text-[#170E14]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* 2026-06-09 — width matched to the "why" grid (1158px →
                  ~370px columns) per Itzik so both sections line up. */}
              <div className="mx-auto mt-8 grid max-w-[1158px] gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <article
                    key={i}
                    className="group relative flex h-full flex-col p-9 sm:p-10"
                  >
                    {/* 2026-06-09 — card bg/border/shadow + hover blob
                        removed per Itzik; flat cards, and the step number
                        + line now carry the CTA button gradient. */}
                    {/* Chapter number + gradient line */}
                    <div className="relative flex items-baseline gap-4">
                      <span
                        className="bg-[linear-gradient(110deg,#F43F5E_0%,#EC4899_45%,#A855F7_100%)] bg-clip-text text-[72px] leading-none text-transparent sm:text-[80px]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontWeight: 600,
                        }}
                      >
                        0{i + 1}
                      </span>
                      {/* 2026-06-09 — gradient line removed; the step tag
                          (האבחון / הניתוח / המסלול) now sits beside the
                          number, in its place. Per Itzik. */}
                      <CmsText
                        cmsKey={`journeyHub.how.steps.${i}.tag`}
                        as="span"
                        className="flex-1 text-[15px] uppercase tracking-[0.22em] text-black/70"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontStyle: "italic",
                          fontWeight: 500,
                        }}
                      />
                    </div>

                    {/* Title */}
                    <CmsText
                      cmsKey={`journeyHub.how.steps.${i}.title`}
                      as="h3"
                      className="relative mt-3 text-[26px] leading-[1.1] tracking-[-0.01em] text-[#170E14]"
                      style={{
                        fontFamily: "'Frank Ruhl Libre', serif",
                        fontWeight: 600,
                      }}
                    />

                    {/* Body */}
                    <CmsText
                      cmsKey={`journeyHub.how.steps.${i}.body`}
                      as="p"
                      className="relative mt-5 text-[20px] leading-[1.5] text-[#170E14]"
                    />
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              4. INSIDE — REMOVED 2026-05-21 per Itzik.
              The dark-wine editorial card with the 4 roman-numeral
              cards ("What's inside the journey") was cut from the
              live page. CMS rows (journeyHub.inside.badge / .title /
              .cards.{0-3}.{h,p}) and the `insideMeta` array remain
              on disk so the section can be re-instated by uncommenting
              the JSX block in git history, no re-translation needed.
          ════════════════════════════════════════════════════════════ */}

          {/* ════════════════════════════════════════════════════════════
              5. CTA BLOCK - light cream manifesto closer
          ════════════════════════════════════════════════════════════ */}
          {/* 2026-06-09 — bg colour removed, and bottom padding trimmed
              ~30% (pb-20/24 → pb-14/16) per Itzik to tighten the gap to
              the next section. */}
          <section className="relative px-4 pt-[85px] pb-14 lg:pb-16">
            <div className="relative mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                <span className="h-[7px] w-[7px] rounded-sm bg-[#FCCA65] shadow-[0_0_0_3px_rgba(252,202,101,0.18)]" />
                <CmsText cmsKey="journeyHub.ctaBlock.badge" />
              </span>
              <CmsText
                cmsKey="journeyHub.ctaBlock.title"
                as="h2"
                className="mt-6 section-h2 tracking-[-0.02em] text-[#170E14]"
                style={{
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontWeight: 600,
                }}
              />
              <CmsText
                cmsKey="journeyHub.ctaBlock.sub"
                as="p"
                className="mx-auto mt-5 max-w-xl text-[19px] leading-[1.65] text-[#4A3A45]"
              />

              <Link
                href={primaryHref}
                className="group relative mt-8 inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-full px-10 text-[16px] font-semibold text-white shadow-xl shadow-fuchsia-500/25 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
                />
                <span className="relative z-10 inline-flex items-center">
                  {hasActiveAssignments
                    ? t("openJourney")
                    : hasInProgressAssessment
                      ? t("ctaResume")
                      : t("ctaBlock.primary")}
                  <ArrowRight
                    className={`ms-2 h-5 w-5 transition group-hover:translate-x-1 ${
                      isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                    }`}
                  />
                </span>
              </Link>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              6. FAQ - same design language as the homepage FAQ.
              Two-column grid: sticky side panel (eyebrow / title / blurb /
              CTA) on one side, accordion list on the other.
              Styles are scoped under `.home-v2` (see styles.css).
          ════════════════════════════════════════════════════════════ */}
          <div className="home-v2" dir={isHe ? "rtl" : "ltr"}>
            <section className="faq" id="faq">
              <div className="container">
                <div className="faq-grid">
                  <div className="faq-side">
                    <CmsText
                      cmsKey="journeyHub.faqSide.eyebrow"
                      as="div"
                      className="eyebrow"
                    />
                    <h2>
                      <CmsText cmsKey="journeyHub.faqSide.titleLine1" />
                      <br />
                      <CmsText cmsKey="journeyHub.faqSide.titleLine2" />
                    </h2>
                    <CmsText cmsKey="journeyHub.faqSide.blurb" as="p" />
                    <Link href="/contact" className="btn btn-ghost">
                      <CmsText cmsKey="journeyHub.faqSide.contactCta" />
                      {" "}
                      <span className="arrow">{isHe ? "←" : "→"}</span>
                    </Link>
                  </div>

                  <div className="faq-list">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <details
                        className="faq-item"
                        key={i}
                        open={i === 0}
                      >
                        <summary>
                          <CmsText cmsKey={`journeyHub.faq.items.${i}.q`} />{" "}
                          <span className="faq-icon">+</span>
                        </summary>
                        <div className="faq-answer">
                          <CmsText
                            cmsKey={`journeyHub.faq.items.${i}.a`}
                            as="p"
                          />
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        {/* ── end light wrapper ── */}
      </main>

      {/* Local keyframes - server component can't use <style jsx>. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-journey-gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50%      { background-position: 100% 50%; }
            }
            .mio-journey-gradient-shift { animation: mio-journey-gradient-shift 7s ease-in-out infinite; }

            /* mio-cta-shift removed 2026-05-06 - CTAs now use a static
               gradient. */

            @keyframes mio-journey-float {
              0%, 100% { transform: translate3d(0, 0, 0); }
              50%      { transform: translate3d(12px, -18px, 0); }
            }
            .mio-journey-float       { animation: mio-journey-float 9s ease-in-out infinite; }
            .mio-journey-float-delay { animation: mio-journey-float 10s ease-in-out infinite; animation-delay: -3s; }
            .mio-journey-float-slow  { animation: mio-journey-float 14s ease-in-out infinite; animation-delay: -5s; }

            /* ── Journey hero animated background - voyage palette ──────
               Goal: feel atmospheric, not announced. Ambient drift, not
               a moving billboard. */

            /* Large drifting blobs - soft, slow, atmospheric.
               Perf 2026-05-19 — filter: blur(110px) removed. The
               radial-gradient stops below were softened (mid stop at
               35%) so the visual edge stays as soft as before, but
               the GPU no longer runs the blur shader every frame
               while the blob translates. Same pattern just rolled out
               on /games (Itzik confirmed it felt great there). */
            .journey-blob {
              position: absolute;
              border-radius: 50%;
              opacity: 0.42;
              will-change: transform;
            }
            /* Wine palette repaint 2026-05-19 — was emerald (16,185,129)
               and amber (251,191,36). Now rose (244,63,94) and magenta
               (217,70,239) to match the Mioshy brand identity. Opacity
               also bumped from 0.42 (parent rule) → 0.55 below to make
               the wash actually read on a dark wine-charcoal base. */
            .journey-blob-1 {
              width: 620px; height: 620px;
              top: -160px;
              inset-inline-start: -120px;
              background: radial-gradient(circle, rgba(244,63,94,0.75) 0%, rgba(244,63,94,0.34) 35%, rgba(244,63,94,0) 75%);
              opacity: 0.55;
              animation: journey-blob-1-converge 56s ease-in-out infinite;
            }
            .journey-blob-2 {
              width: 560px; height: 560px;
              bottom: -140px;
              inset-inline-end: -100px;
              background: radial-gradient(circle, rgba(217,70,239,0.65) 0%, rgba(217,70,239,0.3) 35%, rgba(217,70,239,0) 75%);
              opacity: 0.55;
              animation: journey-blob-2-converge 56s ease-in-out infinite;
            }

            /* Slow, small drift - converge gently, never crowd the headline */
            @keyframes journey-blob-1-converge {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50%      { transform: translate(140px, 100px) scale(1.06); }
            }
            @keyframes journey-blob-2-converge {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50%      { transform: translate(-140px, -100px) scale(1.06); }
            }

            /* Soft floating circle — wine palette 2026-05-19, was sky
               (56,189,248), now violet (168,85,247). Perf 2026-05-19 —
               filter: blur(40px) removed; gradient softened with mid
               stop at 40% to keep the same feathered look. */
            .journey-floating-circle {
              position: absolute;
              width: 200px; height: 200px;
              left: 58%; top: 32%;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0.2) 40%, rgba(168,85,247,0) 75%);
              opacity: 0.55;
              animation: journey-floating-circle-move 32s ease-in-out infinite;
              pointer-events: none;
            }
            @keyframes journey-floating-circle-move {
              0%, 100% { transform: translate(0, 0) scale(1); }
              25%      { transform: translate(-30px, 40px) scale(1.05); }
              50%      { transform: translate(40px, 60px) scale(0.97); }
              75%      { transform: translate(60px, -30px) scale(1.07); }
            }

            /* PERFORMANCE REBUILD 2026-05-19 — single-layer orbs field.
               Was 12 individual .journey-orbit-N spans, each with its
               own CSS animation translating + fading independently.
               Net cost on a 60Hz monitor: ~720 style recalc operations
               per second. Profiling showed this section dominated the
               hero frame budget.

               New shape: ONE element. Background-image is a stack of
               12 radial-gradient dots — same wine/rose/fuchsia/violet
               palette, same opacities, similar sizes/positions
               (recomputed as percentages so they sit where the
               original spans did). Single transform animation drifts
               the whole composition slowly — runs on the compositor
               thread, zero repaint. Brightness preserved.

               Trade-off: dots now move together as a constellation
               instead of independently. Reads more elegant in
               practice and is roughly 12x cheaper.

               IMPORTANT: this CSS lives inside a JS template literal
               (the <style dangerouslySetInnerHTML __html: backtick
               block). Do NOT use backticks inside comments here —
               they terminate the outer JS template and break the
               build (learned 2026-05-19). */
            .journey-orbs-field {
              position: absolute;
              inset: 0;
              pointer-events: none;
              /* 2026-05-19 round 2 — sizes doubled per Itzik, opacity
                 dropped to 0.65 for subtle transparency (was 0.9). */
              /* 2026-05-19 round 5 — opacity 0.35 → 0.3 (more
                 transparency). Gradient changed from 2-stop "color →
                 transparent at 35%" (blurry) to 3-stop "solid core to
                 40% → transparent at 80%" (defined dot, almost no
                 perceptible blur). The first stop ends at 40% of the
                 radius so the dot reads as a clean disk; the 80%
                 transparent stop gives the dot a tiny soft halo that
                 just blends it into the page instead of cutting hard. */
              opacity: 0.3;
              background-image:
                radial-gradient(circle 18px at 12% 22%, rgba(244, 63, 94, 0.95) 0%, rgba(244, 63, 94, 0.95) 40%, transparent 80%),
                radial-gradient(circle 14px at 24% 68%, rgba(217, 70, 239, 0.95) 0%, rgba(217, 70, 239, 0.95) 40%, transparent 80%),
                radial-gradient(circle 22px at 38% 18%, rgba(184, 60, 77, 0.9)  0%, rgba(184, 60, 77, 0.9)  40%, transparent 80%),
                radial-gradient(circle 13px at 48% 74%, rgba(168, 85, 247, 0.95) 0%, rgba(168, 85, 247, 0.95) 40%, transparent 80%),
                radial-gradient(circle 17px at 62% 30%, rgba(236, 72, 153, 0.95) 0%, rgba(236, 72, 153, 0.95) 40%, transparent 80%),
                radial-gradient(circle 17px at 74% 66%, rgba(139, 92, 246, 0.95) 0%, rgba(139, 92, 246, 0.95) 40%, transparent 80%),
                radial-gradient(circle 21px at 86% 24%, rgba(244, 63, 94, 0.9)  0%, rgba(244, 63, 94, 0.9)  40%, transparent 80%),
                radial-gradient(circle 14px at 18% 46%, rgba(217, 70, 239, 0.9)  0%, rgba(217, 70, 239, 0.9)  40%, transparent 80%),
                radial-gradient(circle 18px at 54% 54%, rgba(168, 85, 247, 0.95) 0%, rgba(168, 85, 247, 0.95) 40%, transparent 80%),
                radial-gradient(circle 17px at 80% 48%, rgba(236, 72, 153, 0.95) 0%, rgba(236, 72, 153, 0.95) 40%, transparent 80%),
                radial-gradient(circle 13px at 30% 38%, rgba(184, 60, 77, 0.9)  0%, rgba(184, 60, 77, 0.9)  40%, transparent 80%),
                radial-gradient(circle 18px at 68% 8%,  rgba(139, 92, 246, 0.95) 0%, rgba(139, 92, 246, 0.95) 40%, transparent 80%);
              background-size: 100% 100%;
              background-repeat: no-repeat;
              animation: journey-orbs-drift 22s ease-in-out infinite;
              will-change: transform;
            }
            /* Group drift (~3-3.5% of viewport each axis). All 12 dots
               move in unison — registers as a single floating layer. */
            @keyframes journey-orbs-drift {
              0%, 100% { transform: translate3d(0, 0, 0); }
              33%      { transform: translate3d(3%, -2.5%, 0); }
              66%      { transform: translate3d(-2.5%, 3%, 0); }
            }
            @media (prefers-reduced-motion: reduce) {
              .journey-orbs-field { animation: none; }
            }
          `,
        }}
      />
    </div>
    </CmsTextProvider>
  );
}
