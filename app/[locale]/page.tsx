import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameRow, SiteSettingsRow } from "@/lib/types/database";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Dices,
  Flame,
  Heart,
  MessageCircleHeart,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { HeroClassicDark } from "@/components/marketing/HeroClassicDark";
import { HeroLightGradient } from "@/components/marketing/HeroLightGradient";
import { HomepageV2 } from "@/components/marketing/v2/HomepageV2";
import { pickGameThumbnail } from "@/lib/games-thumbnail";

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
  const t = await getTranslations({ locale, namespace: "metadata" });
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        en: `${base}/en`,
        he: `${base}/he`,
        "x-default": `${base}/en`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  noStore();

  // ── Authenticated users skip the marketing homepage and land on
  //    "My Mioshy" (/my) — the personal hub. The marketing home is
  //    a sales surface; once a user has signed in, returning them to
  //    it on every visit makes the product feel transactional rather
  //    than membership-driven. Logout flow redirects back to /${locale},
  //    which lands here again — but now as anonymous → marketing shows.
  //    Escape hatch: ?marketing=1 lets admins / QA preview the
  //    marketing page while signed in.
  if (searchParams?.marketing !== "1") {
    const supabaseAuth = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (user) redirect(`/${params.locale}/my`);
  }

  // ── Feature flag: HomepageV2 is now the DEFAULT.
  //    The legacy homepage stays accessible via ?old=1 for emergency rollback
  //    or for comparing before/after. Once V2 is fully validated in production
  //    (analytics + QA stable for ~2 weeks), the legacy code below can be
  //    deleted entirely.
  if (searchParams?.old !== "1") {
    return <HomepageV2 />;
  }

  const locale = params.locale;
  const t = await getTranslations("marketingHome");
  const supabase = await createServerSupabaseClient();

  const [
    { data: settings },
    { data: games },
    { data: betweenUsGames },
    { data: betweenUsSettings },
  ] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("games")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("experience_games")
      .select(
        "id, slug, title_he, title_en, short_desc_he, short_desc_en, cover_image_url, intimacy_level, communication_level, heat_level, is_new, is_popular, sort_weight",
      )
      .eq("is_active", true)
      .order("sort_weight", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("between_us_settings")
      .select("section_name_he, section_name_en, section_tagline_he, section_tagline_en")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const s = (settings ?? {
    id: 1,
    updated_at: new Date().toISOString(),
    home_hero_bg_type: "gradient",
    home_hero_bg_value: "default",
    expert_photo_url: null,
    social_proof_couples_count: 0,
    rating_value: 4.9,
    rating_count: 0,
  }) as SiteSettingsRow;

  const activeGames = (games ?? []) as GameRow[];
  const buGames =
    (betweenUsGames ?? []) as Array<{
      id: string;
      slug: string;
      title_he: string;
      title_en: string;
      short_desc_he: string;
      short_desc_en: string;
      cover_image_url: string | null;
      intimacy_level: number;
      communication_level: number;
      heat_level: number;
      is_new: boolean;
      is_popular: boolean;
    }>;

  const isHe = locale === "he";
  const base = siteUrl();

  // ── FAQ items collected from next-intl for Google's "People also ask"
  const FAQ_ITEM_COUNT = 6;
  const faqItems: Array<{ q: string; a: string }> = [];
  for (let i = 0; i < FAQ_ITEM_COUNT; i++) {
    try {
      const q = t(`faq.items.${i}.q`);
      const a = t(`faq.items.${i}.a`);
      if (q && a && !q.startsWith("marketingHome.")) faqItems.push({ q, a });
    } catch {
      break;
    }
  }

  const aggregateRating =
    s.rating_count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(s.rating_value ?? 4.9).toFixed(1),
          ratingCount: s.rating_count,
          bestRating: "5",
          worstRating: "1",
        }
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: "Mioshy",
        inLanguage: ["en", "he"],
        potentialAction: {
          "@type": "SearchAction",
          target: `${base}/${locale}/articles?query={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "Mioshy",
        url: base,
        logo: `${base}/mioshy-white.svg`,
        sameAs: [] as string[],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}/#app`,
        name: "Mioshy",
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        url: `${base}/${locale}`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        ...(aggregateRating ? { aggregateRating } : {}),
      },
      {
        "@type": "ItemList",
        "@id": `${base}/${locale}#game-catalogue`,
        name: isHe ? "משחקי זוגיות" : "Couples games",
        itemListElement: activeGames.slice(0, 30).map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/${locale}/games/${g.slug}`,
          name: isHe ? g.name_he : g.name_en,
        })),
      },
      ...(faqItems.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${base}/${locale}#faq`,
              mainEntity: faqItems.map((it) => ({
                "@type": "Question",
                name: it.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: it.a,
                },
              })),
            },
          ]
        : []),
    ],
  };

  const heroHeadline = isHe
    ? s.hero_headline_he || "יוצאים עם זוגיות לוהטת"
    : s.hero_headline_en || "Walk out with a relationship on fire";
  const heroSub = isHe
    ? s.hero_sub_he ||
      "מיאושי - פלטפורמה עולמית למשחקי זוגיות ואיתון אישי, שמדליקה מחדש את מה שהיה וגם את מה שעדיין לא גיליתם."
    : s.hero_sub_en ||
      "Mioshy - a world-class couples platform of games, questionnaires and personal coaching that relights the spark.";
  const ctaPrimaryText = isHe
    ? s.cta_primary_text_he || "מתחילים עכשיו"
    : s.cta_primary_text_en || "Start now";
  const ctaPrimaryHref = s.cta_primary_href || `/${locale}/journey`;
  const ctaSecondaryText = isHe
    ? s.cta_secondary_text_he || "איך זה עובד"
    : s.cta_secondary_text_en || "How it works";
  const ctaSecondaryHref = s.cta_secondary_href || `/${locale}/journey`;

  const heroTemplate = s.hero_template ?? "classic-dark";
  const socialProofLine =
    s.social_proof_couples_count > 0
      ? t("socialProof.joining", { count: s.social_proof_couples_count })
      : null;
  const sharedHeroProps = {
    isHe,
    headline: heroHeadline,
    sub: heroSub,
    trustBadge: t("hero.trustBadge"),
    ctaPrimary: { text: ctaPrimaryText, href: ctaPrimaryHref },
    ctaSecondary: { text: ctaSecondaryText, href: ctaSecondaryHref },
  };

  const buName = isHe
    ? betweenUsSettings?.section_name_he || "למבוגרים בלבד"
    : betweenUsSettings?.section_name_en ||
      betweenUsSettings?.section_name_he ||
      "Adults Only";
  const buTagline = isHe
    ? betweenUsSettings?.section_tagline_he ||
      "משחקי זוגיות עומק - חוויות משותפות שמשאירות חותם."
    : betweenUsSettings?.section_tagline_en ||
      betweenUsSettings?.section_tagline_he ||
      "Deep couples experiences that leave a mark.";

  return (
    <div
      className="min-h-[100dvh] bg-[#FFF9FB] text-slate-900"
      dir={isHe ? "rtl" : "ltr"}
    >
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* ─────────────── HERO (dark - the only dark section) ─────────────── */}
        {heroTemplate === "classic-dark" ? (
          <HeroClassicDark
            {...sharedHeroProps}
            sideImageUrl={s.hero_side_image_url ?? null}
          />
        ) : (
          <HeroLightGradient
            {...sharedHeroProps}
            rating={
              s.rating_count > 0
                ? {
                    value: Number(s.rating_value ?? 4.9),
                    count: s.rating_count,
                  }
                : null
            }
            coupleCount={s.social_proof_couples_count}
            socialProofLine={socialProofLine}
            privacyLabel={isHe ? "פרטי • מאובטח" : "Private · secure"}
          />
        )}

        {/* ─────────────── BRIDGE / VALUE STRIP (light aurora, warm) ─────────────── */}
        <AuroraSection accent="rose" compact>
          <div className="grid gap-4 sm:grid-cols-3">
            <AuroraValueCell
              accent="from-rose-500 via-pink-500 to-fuchsia-500"
              icon={<Dices className="h-5 w-5 text-white" />}
              title={isHe ? "משחקים מוכחים" : "Proven games"}
              body={
                isHe
                  ? "גלגל הזוגיות ונחשים וסולמות - שעות של צחוק, שיחה ופתיחות."
                  : "Wheel and Snakes - hours of laughter, conversation and openness."
              }
            />
            <AuroraValueCell
              accent="from-violet-500 via-indigo-500 to-sky-500"
              icon={<ClipboardList className="h-5 w-5 text-white" />}
              title={isHe ? "שאלון מלווה אישי" : "Personal questionnaire"}
              body={
                isHe
                  ? "אבחון זוגי שמוליד תובנות חודשיות ותוכנית אימון מותאמת."
                  : "A couple diagnostic that produces monthly insights and a tailored plan."
              }
            />
            <AuroraValueCell
              accent="from-fuchsia-500 via-rose-500 to-amber-500"
              icon={<Heart className="h-5 w-5 text-white" />}
              title={isHe ? "חדר המיטות" : "For the bedroom"}
              body={
                isHe
                  ? "חבילת למבוגרים בלבד - משחקי זוגיות עומק, בהתאמה לרמה ולקצב שלכם."
                  : "Adults Only - premium intimate games, paced to you."
              }
            />
          </div>
        </AuroraSection>

        {/* ─────────────── 1. GAMES ─────────────── */}
        <AuroraSection
          id="games"
          eyebrow={isHe ? "המשחקים שלנו" : "Our games"}
          title={t("games.title")}
          subtitle={t("games.subtitle")}
          accent="violet"
        >
          <div className="grid gap-6 md:grid-cols-2">
            {activeGames.slice(0, 2).map((g) => (
              <GameTile key={g.id} game={g} isHe={isHe} locale={locale} />
            ))}
            {activeGames.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-white/80 p-10 text-center text-slate-500 backdrop-blur">
                {isHe ? "משחקים יוצגו כאן בקרוב." : "Games will appear here soon."}
              </div>
            ) : null}
          </div>
          {activeGames.length > 2 ? (
            <div className="mt-10 text-center">
              <Link
                href="/games"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
              >
                {isHe ? "לכל המשחקים" : "See all games"}
                <ArrowRight
                  className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
                />
              </Link>
            </div>
          ) : null}
        </AuroraSection>

        {/* ─────────────── 2. QUESTIONNAIRE ─────────────── */}
        <AuroraSection
          id="questionnaire"
          eyebrow={isHe ? "אימון זוגי חודשי" : "Monthly couple coaching"}
          title={
            isHe
              ? "שאלון שלומד אתכם - ומביא תובנות כל חודש"
              : "A questionnaire that learns you - and delivers monthly insights"
          }
          subtitle={
            isHe
              ? "עונים פעם אחת, ומקבלים ליווי מותאם אישית כל חודש - תשוקה, אהבה, מיניות, איפוק, הערכת זמן הסקס, שפת האהבה ועוד."
              : "Answer once and receive monthly guidance tailored to you - passion, love, intimacy, restraint, cherishing your time together, love languages, and more."
          }
          accent="rose"
        >
          <div className="grid items-stretch gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              {[
                {
                  accent: "from-rose-500 to-pink-500",
                  icon: <Heart className="h-4 w-4 text-white" />,
                  he: "אבחון זוגי - איפה אנחנו ואיפה כדאי לשים פוקוס.",
                  en: "A couple diagnostic - where we are, where to focus.",
                },
                {
                  accent: "from-amber-500 to-orange-500",
                  icon: <Flame className="h-4 w-4 text-white" />,
                  he: "תוכנית חודשית: טיפ אחד מעשי שיש לו אפקט.",
                  en: "A monthly plan: one practical action that actually works.",
                },
                {
                  accent: "from-sky-500 to-indigo-500",
                  icon: <MessageCircleHeart className="h-4 w-4 text-white" />,
                  he: "שיחות מונחות - להעמיק במקום לדעוך.",
                  en: "Guided conversations - deepen, don't drift.",
                },
                {
                  accent: "from-fuchsia-500 to-violet-500",
                  icon: <Sparkles className="h-4 w-4 text-white" />,
                  he: "תרגולי תשוקה, אהבה, מיניות ואיפוק - קצב שמכבד אתכם.",
                  en: "Practices for passion, love, intimacy and restraint - at your pace.",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={0.04 * i}>
                  <div className="group relative flex items-start gap-3 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-slate-300/80">
                    <span
                      className={`mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} shadow-md shadow-fuchsia-500/15 ring-1 ring-white/60`}
                    >
                      {item.icon}
                    </span>
                    <p className="pt-1 text-sm leading-relaxed text-slate-700">
                      {isHe ? item.he : item.en}
                    </p>
                  </div>
                </Reveal>
              ))}
              <div className="pt-4">
                <Link
                  href="/journey"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 hover:shadow-xl hover:shadow-fuchsia-500/40"
                >
                  {isHe ? "להתחיל את השאלון" : "Start the questionnaire"}
                  <ArrowRight
                    className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
                  />
                </Link>
              </div>
            </div>

            <div className="relative h-full">
              <span
                aria-hidden
                className="absolute -inset-[2px] rounded-[28px] bg-[linear-gradient(135deg,rgba(236,72,153,0.55),rgba(168,85,247,0.55)_50%,rgba(56,189,248,0.50))]"
              />
              <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] bg-white p-8 shadow-2xl shadow-violet-500/15">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -end-10 -top-10 h-56 w-56 rounded-full bg-rose-200/70 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -start-10 bottom-0 h-56 w-56 rounded-full bg-violet-200/70 blur-3xl"
                />
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-xl shadow-fuchsia-500/30 ring-1 ring-white/60">
                  <ClipboardList className="h-7 w-7 text-white" />
                  <span
                    aria-hidden
                    className="absolute inset-x-2 top-1.5 h-1/3 rounded-xl bg-white/30 blur-[2px]"
                  />
                </span>
                <p className="relative mt-6 font-heading text-2xl font-bold leading-snug text-slate-900">
                  {isHe
                    ? "חודש אחרי חודש - אתם יודעים על עצמכם יותר ממה שידעתם אי פעם."
                    : "Month after month - you learn each other better than ever."}
                </p>
                <p className="relative mt-4 text-sm text-slate-600">
                  {isHe
                    ? "לא עוד עצות כלליות. השאלון מתאים את עצמו למה שקורה אצלכם עכשיו, ואנחנו בונים איתכם מסע."
                    : "No generic advice. The questionnaire adapts to what's going on with you now - and we build the journey together."}
                </p>

                <dl className="relative mt-6 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-5 text-center">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {isHe ? "שאלות" : "Questions"}
                    </dt>
                    <dd className="mt-1 font-heading text-xl font-bold text-slate-900">
                      15
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {isHe ? "צירים" : "Axes"}
                    </dt>
                    <dd className="mt-1 font-heading text-xl font-bold text-slate-900">
                      7
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {isHe ? "דקות" : "Minutes"}
                    </dt>
                    <dd className="mt-1 font-heading text-xl font-bold text-slate-900">
                      ~5
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </AuroraSection>

        {/* ─────────────── 3. ADULTS ONLY - LIGHT, WARM AURORA ─────────────── */}
        <AuroraSection id="between-us" accent="heat">
          <div className="text-center">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                {isHe ? "חדש - חדר המיטות" : "New - bedroom line"}
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mx-auto mt-4 max-w-3xl font-heading text-balance text-3xl font-bold text-slate-900 sm:text-5xl">
                {buName}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-slate-700">
                {buTagline}
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {buGames.length > 0 ? (
              buGames.map((g) => <BuCard key={g.id} game={g} isHe={isHe} />)
            ) : (
              <div className="col-span-full rounded-3xl border border-rose-200/70 bg-white/80 p-10 text-center text-slate-500 backdrop-blur">
                {isHe
                  ? "חבילת המשחקים הראשונה שלנו כבר בדרך. חזרו בקרוב."
                  : "Our first drops are coming soon."}
              </div>
            )}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/adults"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 hover:shadow-xl hover:shadow-fuchsia-500/40"
            >
              {isHe ? "לכל משחקי למבוגרים בלבד" : "Explore all Adults Only games"}
              <ArrowRight
                className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
              />
            </Link>
          </div>
        </AuroraSection>

        {/* ─────────────── 4. TESTIMONIALS ─────────────── */}
        <AuroraSection
          id="testimonials"
          eyebrow={isHe ? "ממליצים עלינו" : "Couples on Mioshy"}
          title={
            isHe
              ? "הסיפור האמיתי: מה זוגות אומרים"
              : "The real story - what couples say"
          }
          accent="violet"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => {
              let quote = "";
              try {
                quote = t(`socialProof.quotes.${i}`);
              } catch {
                quote = "";
              }
              if (!quote || quote.startsWith("marketingHome.")) return null;
              return (
                <Reveal key={i} delay={0.05 * i}>
                  <figure className="group relative flex h-full flex-col rounded-3xl p-[1.5px] transition hover:-translate-y-0.5">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,rgba(236,72,153,0.55),rgba(168,85,247,0.45)_50%,rgba(56,189,248,0.45))] opacity-80 transition group-hover:opacity-100"
                    />
                    <div className="relative flex h-full flex-col rounded-[22px] bg-white/95 p-7 shadow-[0_10px_40px_-20px_rgba(124,58,237,0.35)] backdrop-blur transition group-hover:shadow-[0_20px_60px_-20px_rgba(217,70,239,0.35)]">
                      <Quote
                        className={`h-6 w-6 text-fuchsia-500 ${
                          isHe ? "rotate-180" : ""
                        }`}
                      />
                      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                        &ldquo;{quote}&rdquo;
                      </blockquote>
                      <Stars value={5} size="xs" className="mt-5" />
                    </div>
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </AuroraSection>

        {/* ─────────────── 5. EXPERT - LIGHT, CINEMATIC FRAME ─────────────── */}
        <AuroraSection id="expert" accent="amber">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            {/* Portrait inside a gradient frame - dramatic on light */}
            <div className="relative mx-auto w-full max-w-sm">
              <span
                aria-hidden
                className="absolute -inset-[3px] rounded-[28px] bg-[linear-gradient(135deg,rgba(236,72,153,0.70),rgba(168,85,247,0.65)_45%,rgba(253,186,116,0.60))] blur-[2px] opacity-95"
              />
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/70">
                {s.expert_photo_url ? (
                  <Image
                    src={s.expert_photo_url}
                    alt={t("expert.name")}
                    fill
                    sizes="(min-width: 1024px) 28rem, 80vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-rose-100 via-fuchsia-50 to-violet-100 text-rose-400">
                    <Heart className="h-20 w-20" />
                  </div>
                )}
              </div>
              {/* Floating stat badge */}
              <span className="absolute -bottom-3 start-4 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/95 px-4 py-2 text-xs font-semibold text-rose-700 shadow-lg backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {isHe ? "15+ שנות זוגיות" : "15+ years of practice"}
              </span>
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700 shadow-sm backdrop-blur">
                <Star className="h-3.5 w-3.5" />
                {isHe ? "המומחה שלנו" : "Our expert"}
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold text-slate-900 sm:text-5xl">
                {t("expert.name")}
              </h2>
              <p className="mt-2 text-lg text-slate-700">
                {t("expert.titleLine")}
              </p>
              <div className="mt-6 space-y-3 text-sm leading-relaxed text-slate-700">
                <p>{t("expert.bio")}</p>
                <p className="text-slate-600">{t("expert.credibility")}</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/journey"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
                >
                  {isHe ? "להתחיל מסע מלווה" : "Begin your guided journey"}
                  <ArrowRight
                    className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
                  />
                </Link>
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
                >
                  {isHe ? "קריאה לעומק" : "Read deeper"}
                  <BookOpen className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </AuroraSection>

        {/* ─────────────── 6. ARTICLES ─────────────── */}
        <AuroraSection
          id="articles"
          eyebrow={isHe ? "מאמרים" : "Articles"}
          title={t("articles.title")}
          accent="rose"
        >
          <ArticlesStrip locale={locale} isHe={isHe} />
          <div className="mt-10 text-center">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <BookOpen className="h-4 w-4" />
              {isHe ? "לכל המאמרים" : "All articles"}
            </Link>
          </div>
        </AuroraSection>

        {/* ─────────────── 7. FAQ ─────────────── */}
        <AuroraSection
          id="faq"
          eyebrow={t("faq.title")}
          title={isHe ? "שאלות שאנחנו שומעים הכי הרבה" : "Frequently asked"}
          accent="violet"
        >
          <div className="mx-auto grid max-w-4xl gap-3">
            {faqItems.map((it, i) => (
              <details
                key={i}
                className="group relative rounded-2xl p-[1.5px] transition"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(236,72,153,0.30),rgba(168,85,247,0.25)_50%,rgba(56,189,248,0.25))] opacity-0 transition group-open:opacity-100"
                />
                <div className="relative rounded-[14px] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur transition group-open:shadow-md group-open:ring-fuchsia-200/80">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-slate-900">
                    {it.q}
                    <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-open:rotate-45 group-open:bg-gradient-to-br group-open:from-fuchsia-500 group-open:to-violet-500 group-open:text-white">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {it.a}
                  </p>
                </div>
              </details>
            ))}
            {faqItems.length === 0 ? (
              <p className="text-center text-slate-500">
                {isHe ? "אין תוכן להצגה." : "Nothing to show yet."}
              </p>
            ) : null}
          </div>
        </AuroraSection>

        {/* ─────────────── 8. FINAL CTA - THE ONE HE LOVES ─────────────── */}
        <section className="relative isolate overflow-hidden py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(180deg,#FFF9FB 0%,#FCE7F3 35%,#EDE9FE 68%,#FEF3C7 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: "60vw",
              height: "60vw",
              left: "10%",
              top: "30%",
              background: "rgba(244,114,182,0.55)",
              filter: "blur(110px)",
              opacity: 0.5,
              transform: "translate(-50%,-50%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: "55vw",
              height: "55vw",
              left: "80%",
              top: "55%",
              background: "rgba(167,139,250,0.50)",
              filter: "blur(110px)",
              opacity: 0.5,
              transform: "translate(-50%,-50%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: "40vw",
              height: "40vw",
              left: "55%",
              top: "12%",
              background: "rgba(253,186,116,0.35)",
              filter: "blur(110px)",
              opacity: 0.42,
              transform: "translate(-50%,-50%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 opacity-[0.045] mix-blend-multiply"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.6) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent"
          />

          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/50 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-fuchsia-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {isHe ? "מוכנים להתחיל?" : "Ready to begin?"}
            </span>
            <h2 className="mt-5 font-heading text-3xl font-bold text-slate-900 sm:text-5xl lg:text-6xl">
              {isHe
                ? "יוצאים מכאן - עם זוגיות לוהטת"
                : "Walk out with a relationship on fire"}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-700">
              {isHe
                ? "הצטרפו לעשרות אלפי זוגות שכבר מוצאים אצלנו את מה שחיפשו."
                : "Join tens of thousands of couples who already find what they were looking for."}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/journey"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-9 text-sm font-semibold text-white shadow-xl shadow-fuchsia-500/35 transition hover:brightness-110 hover:shadow-2xl hover:shadow-fuchsia-500/50"
              >
                {isHe ? "מתחילים עכשיו" : "Start now"}
                <ArrowRight
                  className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
                />
              </Link>
              <Link
                href="/adults"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-slate-300/80 bg-white/90 px-8 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
              >
                {isHe ? "משחקי חדר המיטות" : "Bedroom games"}
                <Heart className="h-4 w-4 text-rose-500" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// The entire page (after the dark hero) runs on a single primitive:
// AuroraSection. Every section is light and colourful - rose, violet,
// amber, or heat - so the rhythm comes from palette shift, not from
// tone flip. No dead white space, no boring panels.
// ────────────────────────────────────────────────────────────────

/**
 * AuroraSection - rich, colourful light section modelled on the final
 * CTA ("יוצאים מכאן") that Itzik loves. A multi-stop gradient base with
 * three oversized blurred colour orbs and subtle grain on top. The
 * `accent` prop just shifts which orbs dominate so consecutive sections
 * don't feel identical.
 */
function AuroraSection({
  id,
  eyebrow,
  title,
  subtitle,
  accent = "rose",
  compact = false,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Controls the dominant orb palette and base gradient. */
  accent?: "rose" | "violet" | "amber" | "heat";
  /** Bridge strips between content sections use compact=true for less vertical space. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const base =
    accent === "violet"
      ? "linear-gradient(180deg,#FDF4FF 0%,#EDE9FE 40%,#FCE7F3 72%,#FFF1F2 100%)"
      : accent === "amber"
        ? "linear-gradient(180deg,#FFFBEB 0%,#FCE7F3 45%,#EDE9FE 78%,#FAF5FF 100%)"
        : accent === "heat"
          ? "linear-gradient(180deg,#FFF1F2 0%,#FCE7F3 40%,#FAE8FF 72%,#FEF3C7 100%)"
          : "linear-gradient(180deg,#FFF9FB 0%,#FCE7F3 35%,#EDE9FE 68%,#FEF3C7 100%)";

  const orbs =
    accent === "violet"
      ? [
          { w: "55vw", h: "55vw", left: "15%", top: "25%", bg: "rgba(167,139,250,0.55)", op: 0.5 },
          { w: "58vw", h: "58vw", left: "85%", top: "60%", bg: "rgba(244,114,182,0.50)", op: 0.48 },
          { w: "38vw", h: "38vw", left: "50%", top: "110%", bg: "rgba(56,189,248,0.35)", op: 0.4 },
        ]
      : accent === "amber"
        ? [
            { w: "50vw", h: "50vw", left: "15%", top: "30%", bg: "rgba(253,186,116,0.48)", op: 0.48 },
            { w: "55vw", h: "55vw", left: "82%", top: "50%", bg: "rgba(244,114,182,0.48)", op: 0.5 },
            { w: "40vw", h: "40vw", left: "50%", top: "115%", bg: "rgba(167,139,250,0.45)", op: 0.48 },
          ]
        : accent === "heat"
          ? [
              { w: "60vw", h: "60vw", left: "12%", top: "28%", bg: "rgba(244,63,94,0.45)", op: 0.48 },
              { w: "55vw", h: "55vw", left: "85%", top: "58%", bg: "rgba(217,70,239,0.50)", op: 0.5 },
              { w: "42vw", h: "42vw", left: "55%", top: "10%", bg: "rgba(253,186,116,0.45)", op: 0.48 },
            ]
          : [
              { w: "60vw", h: "60vw", left: "12%", top: "28%", bg: "rgba(244,114,182,0.55)", op: 0.5 },
              { w: "55vw", h: "55vw", left: "82%", top: "58%", bg: "rgba(167,139,250,0.50)", op: 0.5 },
              { w: "40vw", h: "40vw", left: "55%", top: "12%", bg: "rgba(253,186,116,0.40)", op: 0.45 },
            ];

  return (
    <section
      id={id}
      className={`relative isolate overflow-hidden ${
        compact ? "py-10 sm:py-12" : "py-20 sm:py-24"
      }`}
    >
      {/* Base gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{ background: base }}
      />
      {/* Orbs */}
      {orbs.map((o, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: o.w,
            height: o.h,
            left: o.left,
            top: o.top,
            background: o.bg,
            filter: "blur(110px)",
            opacity: o.op,
            transform: "translate(-50%,-50%)",
          }}
        />
      ))}
      {/* Subtle grain so the wash never reads flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.045] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.65) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
      {/* Hair-thin gradient rail at top for section rhythm */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent"
      />

      <div className="relative mx-auto max-w-6xl px-4">
        {eyebrow || title || subtitle ? (
          <div className="mx-auto max-w-3xl text-center">
            {eyebrow ? (
              <Reveal>
                <span className="relative inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400"
                  />
                  {eyebrow}
                </span>
              </Reveal>
            ) : null}
            {title ? (
              <Reveal delay={0.02}>
                <h2 className="mt-4 font-heading text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  {title}
                </h2>
              </Reveal>
            ) : null}
            {subtitle ? (
              <Reveal delay={0.05}>
                <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-slate-700 sm:text-xl">
                  {subtitle}
                </p>
              </Reveal>
            ) : null}
          </div>
        ) : null}
        <div className={eyebrow || title || subtitle ? "mt-12" : ""}>
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * AuroraValueCell - pillar cell used on the bridge strip. Semi-transparent
 * white card over the aurora so the colourful backdrop reads through the
 * edges. Gradient icon chip anchors the card.
 */
function AuroraValueCell({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="group relative flex items-start gap-4 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-slate-300/80">
      <span
        className={`relative inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/50 transition group-hover:scale-[1.06]`}
      >
        {icon}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 top-1 h-1/3 rounded-lg bg-white/30 blur-[2px]"
        />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-700">{body}</p>
      </div>
    </div>
  );
}

function Stars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "xs" | "sm";
  className?: string;
}) {
  const px = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className={`inline-flex ${className ?? ""}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${px} ${
            i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * GameTile - premium card for a first-class games catalog entry on the
 * home page. Lives on a light aurora section: white body, gradient edge,
 * colourful placeholder cover so even empty states feel game-world.
 */
function GameTile({
  game,
  isHe,
  locale,
}: {
  game: GameRow;
  isHe: boolean;
  locale: string;
}) {
  const name = isHe ? game.name_he : game.name_en;
  const desc = isHe ? game.description_he : game.description_en;
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative block rounded-[28px] p-[1.5px] transition duration-300 hover:-translate-y-1"
    >
      {/* Gradient border */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-[28px] bg-[linear-gradient(135deg,rgba(236,72,153,0.45),rgba(168,85,247,0.45)_45%,rgba(56,189,248,0.40))] opacity-70 transition duration-300 group-hover:opacity-100"
      />
      {/* Colored glow that deepens on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[36px] bg-[radial-gradient(460px_circle_at_50%_50%,rgba(217,70,239,0.22),transparent_70%)] opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
      />

      <div className="relative overflow-hidden rounded-[26px] bg-white shadow-[0_10px_40px_-20px_rgba(124,58,237,0.30)]">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,#fdf2f8_0%,#fae8ff_35%,#ede9fe_75%,#e0f2fe_100%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(236,72,153,0.22) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(79,70,229,0.22) 0, transparent 40%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.15] mix-blend-multiply"
            style={{
              backgroundImage:
                "linear-gradient(rgba(30,41,59,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.5) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {(() => {
            const thumb =
              pickGameThumbnail(game, locale) ?? game.og_image_url ?? null;
            return thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={name}
                className="relative h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                loading="lazy"
              />
            ) : (
              <div className="relative flex h-full items-center justify-center">
                <span
                  className="inline-grid h-20 w-20 place-items-center rounded-2xl bg-white/85 text-fuchsia-500 shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/90 transition duration-500 group-hover:rotate-[-6deg] group-hover:scale-110"
                >
                  <Dices className="h-10 w-10" />
                </span>
              </div>
            );
          })()}

          {/* Bottom soft gradient for legibility */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/60 to-transparent"
          />

          {/* Floating chip */}
          <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm ring-1 ring-violet-200/70 backdrop-blur">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
            />
            {isHe ? "משחק זוגי" : "Couples game"}
          </span>
        </div>

        {/* Body */}
        <div className="p-6">
          <h3 className="font-heading text-2xl font-bold text-slate-900">
            {name}
          </h3>
          {desc ? (
            <p className="mt-2 line-clamp-2 text-sm text-slate-700">{desc}</p>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition group-hover:shadow-lg group-hover:shadow-fuchsia-500/40">
              {isHe ? "למשחק" : "Play"}
              <ArrowRight
                className={`h-4 w-4 transition group-hover:translate-x-0.5 ${
                  isHe ? "rotate-180 group-hover:-translate-x-0.5" : ""
                }`}
              />
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              /{locale}/games/{game.slug}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * BuCard - adults-only tile on the light aurora section. Keeps sensuous
 * warm palette: rose/fuchsia gradient cover, white body, soft shadow.
 */
function BuCard({
  game,
  isHe,
}: {
  game: {
    id: string;
    slug: string;
    title_he: string;
    title_en: string;
    short_desc_he: string;
    short_desc_en: string;
    cover_image_url: string | null;
    intimacy_level: number;
    communication_level: number;
    heat_level: number;
    is_new: boolean;
    is_popular: boolean;
  };
  isHe: boolean;
}) {
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const desc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;
  return (
    <Link
      href={`/adults/${game.slug}`}
      className="group relative block rounded-3xl p-[1.5px] transition hover:-translate-y-0.5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,rgba(244,63,94,0.55),rgba(217,70,239,0.50)_50%,rgba(253,186,116,0.45))] opacity-80 transition group-hover:opacity-100"
      />
      <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_10px_40px_-20px_rgba(244,63,94,0.35)] transition group-hover:shadow-[0_20px_60px_-20px_rgba(217,70,239,0.45)]">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-rose-200 via-fuchsia-100 to-amber-100">
          {game.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.cover_image_url}
              alt={title}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-rose-400">
              <Heart className="h-12 w-12" />
            </div>
          )}
          <div className="absolute top-3 end-3 flex flex-col gap-1">
            {game.is_new ? (
              <span className="rounded-full bg-emerald-500/95 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                {isHe ? "חדש" : "New"}
              </span>
            ) : null}
            {game.is_popular ? (
              <span className="rounded-full bg-amber-500/95 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                {isHe ? "פופולרי" : "Popular"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-heading text-xl font-bold text-slate-900">
            {title}
          </h3>
          {desc ? (
            <p className="mt-2 line-clamp-2 text-sm text-slate-700">{desc}</p>
          ) : null}
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3 text-rose-500" />
              {game.intimacy_level}/5
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircleHeart className="h-3 w-3 text-sky-500" />
              {game.communication_level}/5
            </span>
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3 text-orange-500" />
              {game.heat_level}/5
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

async function ArticlesStrip({
  isHe,
}: {
  // `locale` is part of the parent's contract but not used in this view yet.
  locale: string;
  isHe: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: articles } = await supabase
    .from("articles")
    .select(
      "slug, title_he, title_en, excerpt_he, excerpt_en, cover_image_url, published_at",
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  if (!articles || articles.length === 0) {
    return (
      <p className="text-center text-slate-600">
        {isHe ? "מאמרים יופיעו כאן בקרוב." : "Articles coming soon."}
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {articles.map((a) => {
        const title = isHe
          ? (a.title_he ?? a.title_en ?? "")
          : (a.title_en ?? a.title_he ?? "");
        const excerpt = isHe
          ? (a.excerpt_he ?? a.excerpt_en ?? "")
          : (a.excerpt_en ?? a.excerpt_he ?? "");
        return (
          <Link
            key={a.slug}
            href={`/articles/${a.slug}`}
            className="group relative block overflow-hidden rounded-3xl bg-white/95 shadow-[0_10px_40px_-20px_rgba(124,58,237,0.30)] ring-1 ring-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-20px_rgba(217,70,239,0.40)] hover:ring-slate-300/80"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 opacity-80"
            />
            <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-rose-100 via-fuchsia-50 to-violet-100">
              {a.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.cover_image_url}
                  alt={title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="inline-grid h-16 w-16 place-items-center rounded-2xl bg-white/90 text-fuchsia-500 shadow-md shadow-fuchsia-500/15 ring-1 ring-white/90">
                    <BookOpen className="h-8 w-8" />
                  </span>
                </div>
              )}
            </div>
            <div className="p-5">
              <h3 className="font-heading text-lg font-bold text-slate-900 line-clamp-2">
                {title}
              </h3>
              {excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm text-slate-700">
                  {excerpt}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
