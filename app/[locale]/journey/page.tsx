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
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { unstable_noStore as noStore } from "next/cache";
import {
  ArrowRight,
  Compass,
  HeartHandshake,
  Sparkles,
  Clock,
  BookOpen,
  MessageCircle,
  Target,
  Video,
} from "lucide-react";
import { Link } from "@/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { JourneyCheckoutButton } from "@/components/journey/JourneyCheckoutButton";
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
  const t = await getTranslations({ locale, namespace: "journeyHub" });
  const title = t("metaTitle");
  const description = t("metaDescription");
  const canonical = `${base}/${locale}/journey`;
  return {
    title,
    description,
    keywords:
      locale === "he"
        ? [
            "מסע זוגי",
            "אבחון זוגי",
            "ייעוץ זוגי",
            "תרגולים לזוגות",
            "מסלול זוגי אישי",
          ]
        : [
            "couples journey",
            "couples assessment",
            "relationship diagnostic",
            "couples program",
            "relationship exercises",
            "personalized couples roadmap",
          ],
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
  const t = await getTranslations({ locale, namespace: "journeyHub" });

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
    const lockedTrust = [0, 1, 2, 3].map((i) => t(`trust.${i}`));
    return (
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative isolate min-h-[100dvh] overflow-hidden text-white"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#070b18_0%,#0a1126_40%,#0c1530_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] animate-aurora-drift"
          style={{
            background:
              "radial-gradient(1100px 640px at 14% 0%, rgba(16,185,129,0.22), transparent 62%), " +
              "radial-gradient(900px 520px at 88% 12%, rgba(251,191,36,0.16), transparent 60%), " +
              "radial-gradient(700px 460px at 50% 40%, rgba(56,189,248,0.10), transparent 65%)",
          }}
        />
        <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-16 sm:pt-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {isHe ? "ליווי עם מיאושי" : "Journey with Mioshy"}
          </div>
          {/* Locked-state H1 — applies the Mioshy design language: bold
              anchor + wine-color em + light tail. Per Itzik 2026-05-06. */}
          <h1 className="mt-5 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {isHe ? (
              <>
                המסע <em className="not-italic font-semibold text-emerald-300">נעול</em>{" "}
                <span className="font-light text-white/80">— בינתיים.</span>
              </>
            ) : (
              <>
                The journey is <em className="not-italic font-semibold text-emerald-300">locked</em>{" "}
                <span className="font-light text-white/80">— for now.</span>
              </>
            )}
          </h1>
          {/* Lede — bumped to text-[20px] (was text-lg ≈ 18px) so the
              promise reads first, prompts second. */}
          <p className="mt-6 text-[20px] leading-[1.55] text-white/85">
            {isHe
              ? "מגיע לכם ליווי שנבנה במיוחד עבורכם — תרגולים, אבחון, שיחות, ומשימות חודשיות מהמומחים שלנו. הכל כלול במנוי שבועי אחד."
              : "You deserve coaching built around you — practices, assessment, conversations, and monthly tasks from our experts. All included in one weekly subscription."}
          </p>
          <p className="mt-3 text-[18px] leading-[1.55] text-white/70">
            {isHe
              ? "אנחנו לא רוצים שתפספסו את זה."
              : "We don't want you to miss this."}
          </p>

          {/* Primary CTA bumped to h-14/text-base + bigger shadow per
              Itzik 2026-05-06 — this is the only meaningful action on a
              locked screen, so it can't be the same size as the secondary. */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {/* W1.1 — clicks the real Cardcom checkout instead of /pricing.
                The previous Link bounced through a marketing page with no
                clear path to payment; users hit a dead end. */}
            <JourneyCheckoutButton
              isHe={isHe}
              label={isHe ? "להצטרפות עכשיו" : "Join now"}
              variant="white"
              source="journey_landing_locked"
              returnPath={`/${isHe ? "he" : "en"}/my/journey`}
            />
            <Link
              href="/my"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 text-[16px] font-medium text-white backdrop-blur hover:bg-white/20 transition"
            >
              {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
            </Link>
          </div>

          <ul className="mt-12 grid gap-3 text-left sm:grid-cols-2">
            {lockedTrust.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 backdrop-blur"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </main>
      </div>
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
  const whyItems = [0, 1, 2, 3].map((i) => ({
    h: t(`why.items.${i}.h`),
    p: t(`why.items.${i}.p`),
  }));
  // V2 wine-palette unified card design - same icon-tile chrome across all 4,
  // only icon and stat differ. No more rainbow.
  const whyMeta = [
    {
      Icon: Compass,
      iconBg: "bg-[#B83C4D]",
      stat: isHe ? "אישי לכם" : "Personal",
    },
    {
      Icon: Clock,
      iconBg: "bg-[#8B2638]",
      stat: isHe ? "5 דקות" : "5 minutes",
    },
    {
      Icon: BookOpen,
      iconBg: "bg-[#4A1721]",
      stat: isHe ? "מבוסס מחקר" : "Research-based",
    },
    {
      Icon: HeartHandshake,
      iconBg: "bg-[#3D1F3D]",
      stat: isHe ? "לזוג" : "For couples",
    },
  ];

  const steps = [0, 1, 2].map((i) => ({
    title: t(`how.steps.${i}.title`),
    body: t(`how.steps.${i}.body`),
    tag: isHe
      ? ["האבחון", "הניתוח", "המסלול"][i]
      : ["The diagnostic", "The analysis", "The path"][i],
  }));

  const insideCards = [0, 1, 2, 3].map((i) => ({
    h: t(`inside.cards.${i}.h`),
    p: t(`inside.cards.${i}.p`),
  }));
  const insideMeta = [
    { Icon: Target, numeral: "I" },
    { Icon: MessageCircle, numeral: "II" },
    { Icon: Sparkles, numeral: "III" },
    { Icon: Video, numeral: "IV" },
  ];

  const trust = [0, 1, 2, 3].map((i) => t(`trust.${i}`));

  // When the viewer already has an active journey, the assessment funnel
  // is a detour - send them straight to the timeline from every CTA.
  const primaryHref = hasActiveAssignments
    ? "/journey/timeline"
    : "/journey/assessment";
  const secondaryHref = "#how";
  const primaryLabel = hasActiveAssignments
    ? isHe
      ? "פתיחת המסלול שלכם"
      : "Open your journey"
    : hasInProgressAssessment
      ? t("ctaResume")
      : t("ctaPrimary");

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* Hero backdrop - kept dark voyage palette as the journey identity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[110vh] bg-[linear-gradient(180deg,#070b18_0%,#0a1126_40%,#0c1530_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] animate-aurora-drift"
        style={{
          background:
            "radial-gradient(1100px 640px at 14% 0%, rgba(16,185,129,0.22), transparent 62%), " +
            "radial-gradient(900px 520px at 88% 12%, rgba(251,191,36,0.16), transparent 60%), " +
            "radial-gradient(700px 460px at 50% 40%, rgba(56,189,248,0.10), transparent 65%)",
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
              {t("breadcrumbHome")}
            </Link>
            <span aria-hidden className="text-white/30">/</span>
            <span className="text-white/65">{t("breadcrumbJourney")}</span>
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

            {/* 6 drifting dots (was 12). Performance: orbit count halved
                per Itzik 2026-05-06 — the journey hero was running 12
                animated dots on top of 2 blobs + an aurora-drift layer. */}
            <span className="journey-orbit journey-orbit-1" />
            <span className="journey-orbit journey-orbit-2" />
            <span className="journey-orbit journey-orbit-3" />
            <span className="journey-orbit journey-orbit-4" />
            <span className="journey-orbit journey-orbit-5" />
            <span className="journey-orbit journey-orbit-6" />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-12 pt-10 text-center sm:pb-32 sm:pt-16">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100">
              <Sparkles className="h-3 w-3" />
              {t("badge")}
            </span>

            {/* Preheader — calls out the personal-coaching value
                proposition above the headline. Per Itzik 2026-05-07. */}
            <p className="mt-5 text-[15px] font-medium uppercase tracking-[0.18em] text-amber-200/80">
              {t("preheader")}
            </p>

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
              <span className="bg-gradient-to-br from-white via-emerald-100 to-amber-200 bg-clip-text text-transparent">
                {t("h1")}
              </span>
              <span
                className="mt-2 block text-[0.7em] font-light text-emerald-100/75"
                style={{ fontStyle: "italic" }}
              >
                {t("h1Sub")}
              </span>
            </h1>

            {/* Visual placeholder — per Itzik 2026-05-07 the journey
                hero needed something to look at, not just text. This
                is a calm gradient panel with a soft outline; a real
                photograph or illustration can swap in later by
                replacing the inner content. */}
            <div className="mx-auto mt-8 hidden max-w-3xl sm:block">
              <div
                aria-hidden
                className="relative h-[180px] overflow-hidden rounded-3xl border border-emerald-300/20"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(56,189,248,0.10) 50%, rgba(251,191,36,0.14) 100%)",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-emerald-100/40">
                    <Sparkles className="h-7 w-7" />
                    <span className="text-[12px] uppercase tracking-[0.3em]">
                      {isHe ? "תמונה תתווסף בקרוב" : "Image coming soon"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-pretty text-[19px] leading-[1.65] text-white/80 sm:text-[20px]">
              {t("lede")}
            </p>

            {hasActiveAssignments ? (
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-100 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {isHe
                  ? "המסלול שלכם פעיל - המשיכו מאיפה שעצרתם"
                  : "Your journey is active - pick up where you left off"}
              </div>
            ) : hasInProgressAssessment ? (
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-1.5 text-xs font-medium text-amber-100 backdrop-blur-md">
                <Clock className="h-3.5 w-3.5" />
                {t("resumeHint")}
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
                {t("ctaSecondary")}
              </a>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/70">
              {trust.map((label, i) => (
                <li key={i} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      ["bg-emerald-300", "bg-teal-300", "bg-amber-300", "bg-indigo-300"][i]
                    }`}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
            LIGHT WRAPPER - V2 cream language for everything below
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-[#FAF6F7] text-slate-900">

          {/* ════════════════════════════════════════════════════════════
              2. WHY - light cream, 4 unified cards w/ stat chips
          ════════════════════════════════════════════════════════════ */}
          <section
            id="why"
            className="relative bg-[#FAF6F7] px-4 pb-[30px] pt-[75px]"
          >
            <div className="mx-auto max-w-6xl">
              <div className="mx-auto max-w-3xl text-center">
                <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {t("why.badge")}
                </span>
                <h2
                  className="mt-5 text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-4xl lg:text-5xl"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 600,
                  }}
                >
                  {t("why.title")}
                </h2>
              </div>

              <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {whyItems.map((it, i) => {
                  const { Icon, iconBg, stat } = whyMeta[i]!;
                  return (
                    <div
                      key={i}
                      className="group relative grid grid-cols-[56px_1fr] gap-x-4 gap-y-2 overflow-hidden rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-md sm:flex sm:flex-col sm:gap-x-0 sm:gap-y-0 sm:p-7"
                    >
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-[3px] origin-right scale-x-0 rounded-t-3xl bg-[#B83C4D] transition-transform duration-400 group-hover:scale-x-100"
                      />
                      <div
                        className={`row-span-3 self-start inline-flex h-14 w-14 items-center justify-center rounded-2xl sm:row-auto ${iconBg} text-white shadow-md`}
                      >
                        <Icon className="h-7 w-7" />
                      </div>
                      <span className="inline-block self-start justify-self-start rounded-full border border-[#EAE0E3] bg-[#FBE9EC] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8B2638] sm:mt-4 sm:justify-self-auto">
                        {stat}
                      </span>
                      <h3 className="font-heading text-2xl font-bold leading-snug text-[#170E14] sm:mt-4 sm:text-xl">
                        {it.h}
                      </h3>
                      <p className="text-[18px] leading-[1.6] text-[#4A3A45] sm:mt-2 sm:flex-1">
                        {it.p}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Social proof - editorial pull-quote, mirroring /games.
                  Two italic-accent phrases inside a flowing serif sentence,
                  black-italic trial qualifier, kicker line, and a CTA that
                  delivers on the kicker's promise. */}
              <div className="mx-auto mt-16 max-w-3xl text-center">
                <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {isHe ? "המסלול שלכם" : "Your path"}
                </span>

                <p
                  className="mt-7 text-[30px] leading-[1.35] text-[#170E14] sm:text-[30px] lg:text-[34px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 500,
                  }}
                >
                  {isHe ? (
                    <>
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        5 דקות
                      </em>{" "}
                      מפרידות אתכם
                      <br />
                      ממסלול אישי{" "}
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        שנכתב בדיוק לכם
                      </em>
                      .
                    </>
                  ) : (
                    <>
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        Five minutes
                      </em>{" "}
                      stand between you
                      <br />
                      and a path written{" "}
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        just for you
                      </em>
                      .
                    </>
                  )}
                </p>

                {/* Trial qualifier - black italic, smaller weight */}
                <p
                  className="mt-4 text-[22px] leading-[1.4] text-[#170E14] sm:text-[24px] lg:text-[28px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontStyle: "italic",
                    fontWeight: 500,
                  }}
                >
                  {isHe
                    ? "התחילו חינם - בלי כרטיס אשראי."
                    : "Start free - no credit card required."}
                </p>

                {/* Italic kicker, flanked by hairlines */}
                <div className="mt-10 flex items-center justify-center gap-4">
                  <span aria-hidden className="h-px w-16 bg-[#B83C4D]/40" />
                  <p
                    className="text-[14px] uppercase tracking-[0.22em] text-[#8B2638]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    {isHe
                      ? "האבחון פתוח לכולם"
                      : "the assessment is open"}
                  </p>
                  <span aria-hidden className="h-px w-16 bg-[#B83C4D]/40" />
                </div>

                {/* CTA - delivers on the kicker's promise */}
                <div className="mt-7">
                  <Link
                    href={primaryHref}
                    className="group relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-full px-9 text-[16px] font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
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
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              3. HOW IT WORKS - magazine chapter cards (3 stages)
          ════════════════════════════════════════════════════════════ */}
          <section
            id="how"
            className="relative overflow-hidden bg-[#FAF6F7] px-4 pb-20 pt-[35px] lg:pb-24"
          >
            {/* Soft accent glow at top */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(900px 500px at 50% -10%, rgba(184,60,77,0.07), transparent 60%)",
              }}
            />

            <div className="relative mx-auto max-w-6xl">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {t("how.badge")}
                </span>
                <h2
                  className="mt-7 text-[40px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-5xl lg:text-[56px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 600,
                  }}
                >
                  {t("how.title")}
                </h2>
              </div>

              <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-7">
                {steps.map((s, i) => (
                  <article
                    key={i}
                    className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#EAE0E3] bg-[#FBF5F2] p-9 shadow-sm transition duration-500 hover:-translate-y-2 hover:border-transparent hover:shadow-[0_28px_56px_-20px_rgba(74,23,33,0.22)] sm:p-10"
                  >
                    {/* hover gradient accent */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#B83C4D]/0 via-[#B83C4D]/0 to-[#B83C4D]/0 opacity-0 blur-3xl transition duration-700 group-hover:from-[#B83C4D]/20 group-hover:via-[#8B2638]/15 group-hover:opacity-100"
                    />

                    {/* Chapter number + animated line */}
                    <div className="relative flex items-baseline gap-4">
                      <span
                        className="text-[72px] leading-none text-[#B83C4D]/25 transition-colors duration-500 group-hover:text-[#B83C4D]/50 sm:text-[80px]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontWeight: 600,
                        }}
                      >
                        0{i + 1}
                      </span>
                      <span className="h-px flex-1 bg-[#EAE0E3] transition-colors duration-500 group-hover:bg-[#B83C4D]/40" />
                    </div>

                    {/* Italic tag */}
                    <p
                      className="relative mt-6 text-[14px] uppercase tracking-[0.22em] text-[#B83C4D]"
                      style={{
                        fontFamily: "'Frank Ruhl Libre', serif",
                        fontStyle: "italic",
                        fontWeight: 500,
                      }}
                    >
                      {s.tag}
                    </p>

                    {/* Title */}
                    <h3
                      className="relative mt-3 text-[28px] leading-[1.1] tracking-[-0.01em] text-[#170E14] sm:text-[32px]"
                      style={{
                        fontFamily: "'Frank Ruhl Libre', serif",
                        fontWeight: 600,
                      }}
                    >
                      {s.title}
                    </h3>

                    {/* Body */}
                    <p className="relative mt-5 text-[18px] leading-[1.7] text-[#4A3A45]">
                      {s.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              4. INSIDE - dark wine editorial card (full break from cream)
          ════════════════════════════════════════════════════════════ */}
          <section
            id="inside"
            className="relative mx-4 my-6 overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,#0E0810_0%,#1A0B14_55%,#1E0F1E_100%)] px-4 pt-14 pb-[60px] sm:mx-8 lg:mx-12 lg:pt-20"
          >
            {/* Aurora glows */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0 opacity-70"
              style={{
                background:
                  "radial-gradient(900px 500px at 18% 20%, rgba(196,68,86,0.18), transparent 60%), " +
                  "radial-gradient(800px 480px at 82% 80%, rgba(139,38,56,0.14), transparent 60%)",
              }}
            />
            {/* Hairline frame */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-[#B83C4D]/30 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-[#B83C4D]/30 to-transparent"
            />

            <div className="relative mx-auto max-w-6xl">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#E9C4CA]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.25)]" />
                  {t("inside.badge")}
                </span>
                <h2
                  className="mt-7 text-[40px] leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl lg:text-[58px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 600,
                  }}
                >
                  {t("inside.title")}
                </h2>
              </div>

              {/* 4-card editorial grid with hairline dividers + per-card icon */}
              <div className="mt-10 grid gap-y-6 md:grid-cols-2 md:gap-x-10 md:gap-y-14 md:mt-14 lg:grid-cols-4 lg:gap-x-8 lg:mt-16">
                {insideCards.map((c, i) => {
                  const { numeral } = insideMeta[i]!;
                  return (
                    <div
                      key={i}
                      className={`group relative h-full grid grid-cols-[3rem_1fr] items-start gap-x-4 md:block ${
                        i > 0 ? "lg:border-s lg:ps-8" : ""
                      }`}
                      style={
                        i > 0
                          ? { borderColor: "rgba(255,255,255,0.08)" }
                          : undefined
                      }
                    >
                      <span
                        className="row-span-3 md:row-auto text-center md:text-start text-[32px] leading-none tracking-[0.1em] text-[#B83C4D] transition-colors duration-300 group-hover:text-[#E9C4CA]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontStyle: "italic",
                          fontWeight: 500,
                        }}
                      >
                        {numeral}
                      </span>

                      <h3 className="text-[24px] font-bold leading-tight text-white md:mt-5">
                        {c.h}
                      </h3>

                      <div className="mt-3 h-[2px] w-12 bg-[#B83C4D] transition-all duration-500 ease-out group-hover:w-24 md:mt-4" />

                      <p className="mt-3 text-[18px] leading-[1.65] text-white/70 md:mt-5">
                        {c.p}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              5. CTA BLOCK - light cream manifesto closer
          ════════════════════════════════════════════════════════════ */}
          <section className="relative bg-[#FAF6F7] px-4 pt-[85px] pb-20 lg:pb-24">
            <div className="relative mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                {t("ctaBlock.badge")}
              </span>
              <h2
                className="mt-6 text-[40px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-5xl lg:text-[56px]"
                style={{
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontWeight: 600,
                }}
              >
                {t("ctaBlock.title")}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[19px] leading-[1.65] text-[#4A3A45]">
                {t("ctaBlock.sub")}
              </p>

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
                    ? isHe
                      ? "פתיחת המסלול שלכם"
                      : "Open your journey"
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
                    <div className="eyebrow">
                      {isHe ? "שאלות שזוגות שואלים" : "Questions couples ask"}
                    </div>
                    <h2>
                      {isHe ? (
                        <>
                          יש לכם שאלות על המסע?
                          <br />
                          יש לנו תשובות.
                        </>
                      ) : (
                        <>
                          Have questions about the journey?
                          <br />
                          We have answers.
                        </>
                      )}
                    </h2>
                    <p>
                      {isHe
                        ? "אספנו את השאלות שזוגות שואלים אותנו על האבחון, על המסלול ועל מה קורה אחרי. עדיין לא מצאתם תשובה?"
                        : "We've gathered the most common questions about the assessment, the path, and what happens after. Didn't find your answer?"}
                    </p>
                    <Link href="/contact" className="btn btn-ghost">
                      {isHe ? "דברו איתנו" : "Talk to us"}{" "}
                      <span className="arrow">{isHe ? "←" : "→"}</span>
                    </Link>
                  </div>

                  <div className="faq-list">
                    {faqItems.map((it, i) => (
                      <details
                        className="faq-item"
                        key={i}
                        open={i === 0}
                      >
                        <summary>
                          {it.q} <span className="faq-icon">+</span>
                        </summary>
                        <div className="faq-answer">
                          <p>{it.a}</p>
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

            /* Large drifting blobs - soft, slow, atmospheric. */
            .journey-blob {
              position: absolute;
              border-radius: 50%;
              filter: blur(110px);
              opacity: 0.42;
              will-change: transform;
            }
            .journey-blob-1 {
              width: 620px; height: 620px;
              top: -160px;
              inset-inline-start: -120px;
              background: radial-gradient(circle, rgba(16,185,129,0.7) 0%, rgba(16,185,129,0) 70%);
              animation: journey-blob-1-converge 56s ease-in-out infinite;
            }
            .journey-blob-2 {
              width: 560px; height: 560px;
              bottom: -140px;
              inset-inline-end: -100px;
              background: radial-gradient(circle, rgba(251,191,36,0.6) 0%, rgba(251,191,36,0) 70%);
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

            /* Soft floating circle */
            .journey-floating-circle {
              position: absolute;
              width: 200px; height: 200px;
              left: 58%; top: 32%;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(56,189,248,0) 65%);
              filter: blur(40px);
              opacity: 0.45;
              animation: journey-floating-circle-move 32s ease-in-out infinite;
              pointer-events: none;
            }
            @keyframes journey-floating-circle-move {
              0%, 100% { transform: translate(0, 0) scale(1); }
              25%      { transform: translate(-30px, 40px) scale(1.05); }
              50%      { transform: translate(40px, 60px) scale(0.97); }
              75%      { transform: translate(60px, -30px) scale(1.07); }
            }

            /* 12 small drifting orbit dots - journey palette.
               Single smooth fade gradient (no mid-stop ring) so they feather
               into the bg instead of looking outlined. Glow halo softened
               so the dots blend rather than announce themselves. */
            .journey-orbit {
              position: absolute;
              border-radius: 50%;
              pointer-events: none;
              opacity: 0.45;
              will-change: transform, opacity;
            }
            .journey-orbit-1  { width: 8px;  height: 8px;  left: 12%; top: 22%; background: radial-gradient(circle, rgba(16,185,129,0.85) 0%, rgba(16,185,129,0) 70%);  box-shadow: 0 0 10px rgba(16,185,129,0.25);  animation: journey-orbit-a 26s ease-in-out infinite; }
            .journey-orbit-2  { width: 6px;  height: 6px;  left: 24%; top: 68%; background: radial-gradient(circle, rgba(20,184,166,0.85) 0%, rgba(20,184,166,0) 70%);  box-shadow: 0 0 8px  rgba(20,184,166,0.22);  animation: journey-orbit-b 32s ease-in-out infinite; animation-delay: 1s; }
            .journey-orbit-3  { width: 10px; height: 10px; left: 38%; top: 18%; background: radial-gradient(circle, rgba(251,191,36,0.8)  0%, rgba(251,191,36,0)  70%);  box-shadow: 0 0 12px rgba(251,191,36,0.22);  animation: journey-orbit-c 30s ease-in-out infinite; animation-delay: 2s; }
            .journey-orbit-4  { width: 5px;  height: 5px;  left: 48%; top: 74%; background: radial-gradient(circle, rgba(56,189,248,0.85) 0%, rgba(56,189,248,0) 70%);  box-shadow: 0 0 8px  rgba(56,189,248,0.22);  animation: journey-orbit-d 36s ease-in-out infinite; animation-delay: 3s; }
            .journey-orbit-5  { width: 7px;  height: 7px;  left: 62%; top: 30%; background: radial-gradient(circle, rgba(16,185,129,0.8)  0%, rgba(16,185,129,0)  70%);  box-shadow: 0 0 10px rgba(16,185,129,0.22);  animation: journey-orbit-e 28s ease-in-out infinite; animation-delay: .8s; }
            .journey-orbit-6  { width: 7px;  height: 7px;  left: 74%; top: 66%; background: radial-gradient(circle, rgba(129,140,248,0.85) 0%, rgba(129,140,248,0) 70%);  box-shadow: 0 0 10px rgba(129,140,248,0.22);  animation: journey-orbit-a 34s ease-in-out infinite; animation-delay: 3.6s; }
            .journey-orbit-7  { width: 9px;  height: 9px;  left: 86%; top: 24%; background: radial-gradient(circle, rgba(251,191,36,0.85) 0%, rgba(251,191,36,0) 70%);  box-shadow: 0 0 12px rgba(251,191,36,0.22);  animation: journey-orbit-b 30s ease-in-out infinite; animation-delay: 4.2s; }
            .journey-orbit-8  { width: 6px;  height: 6px;  left: 18%; top: 46%; background: radial-gradient(circle, rgba(45,212,191,0.85) 0%, rgba(45,212,191,0) 70%);  box-shadow: 0 0 8px  rgba(45,212,191,0.22);  animation: journey-orbit-c 38s ease-in-out infinite; animation-delay: 1.6s; }
            .journey-orbit-9  { width: 8px;  height: 8px;  left: 54%; top: 54%; background: radial-gradient(circle, rgba(56,189,248,0.8)  0%, rgba(56,189,248,0)  70%);  box-shadow: 0 0 10px rgba(56,189,248,0.22);  animation: journey-orbit-d 32s ease-in-out infinite; animation-delay: 5s; }
            .journey-orbit-10 { width: 7px;  height: 7px;  left: 80%; top: 48%; background: radial-gradient(circle, rgba(34,211,238,0.85) 0%, rgba(34,211,238,0) 70%);  box-shadow: 0 0 10px rgba(34,211,238,0.22);  animation: journey-orbit-e 34s ease-in-out infinite; animation-delay: 2.4s; }
            .journey-orbit-11 { width: 5px;  height: 5px;  left: 30%; top: 38%; background: radial-gradient(circle, rgba(167,243,208,0.8)  0%, rgba(167,243,208,0)  70%);  box-shadow: 0 0 8px  rgba(167,243,208,0.2);   animation: journey-orbit-a 28s ease-in-out infinite; animation-delay: 4s; }
            .journey-orbit-12 { width: 8px;  height: 8px;  left: 68%; top: 8%;  background: radial-gradient(circle, rgba(253,224,71,0.8)   0%, rgba(253,224,71,0)   70%);  box-shadow: 0 0 10px rgba(253,224,71,0.22);   animation: journey-orbit-b 30s ease-in-out infinite; animation-delay: .5s; }

            /* Drift ranges halved from previous version - feels ambient,
               not propelled. Opacity softer so dots breathe in/out. */
            @keyframes journey-orbit-a { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(30px,-40px);  opacity: .65; } }
            @keyframes journey-orbit-b { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-40px,30px); opacity: .65; } }
            @keyframes journey-orbit-c { 0%,100% { transform: translate(0,0); opacity: .2; }  33% { transform: translate(40px,18px);  opacity: .55; } 66% { transform: translate(-25px,-30px); opacity: .7; } }
            @keyframes journey-orbit-d { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-30px,-45px); opacity: .65; } }
            @keyframes journey-orbit-e { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(45px,35px);  opacity: .65; } }
          `,
        }}
      />
    </div>
  );
}
