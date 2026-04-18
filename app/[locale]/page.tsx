import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameRow, SiteSettingsRow } from "@/lib/types/database";
import { unstable_noStore as noStore } from "next/cache";
import { Reveal } from "@/components/marketing/Reveal";
import { Section } from "@/components/marketing/Section";
import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Flame,
  Heart,
  HelpingHand,
  Sparkles,
  Star,
  Users,
  Wand2,
} from "lucide-react";

function WarmDivider() {
  return (
    <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-purple-500/15 to-transparent" />
  );
}

function GlowOrb({
  className,
  color = "purple",
}: {
  className?: string;
  color?: "purple" | "rose" | "mixed";
}) {
  const bg =
    color === "purple"
      ? "bg-purple-600/20"
      : color === "rose"
        ? "bg-rose-500/15"
        : "bg-fuchsia-500/15";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[120px] ${bg} ${className ?? ""}`}
    />
  );
}

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
}: {
  params: { locale: string };
}) {
  noStore();
  const locale = params.locale;
  const t = await getTranslations("marketingHome");
  const supabase = await createServerSupabaseClient();

  const [{ data: settings }, { data: games }] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("games")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
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

  const isHe = locale === "he";
  const heroBgStyle =
    s.home_hero_bg_type === "image" && s.home_hero_bg_value
      ? ({
          backgroundImage: `linear-gradient(rgba(13,10,20,.70), rgba(13,10,20,.90)), url(${s.home_hero_bg_value})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } as const)
      : undefined;

  const base = siteUrl();

  // ── FAQ items collected from next-intl so Google can pick them up for
  //    the "People also ask" / FAQ-rich-result entitlement.
  const faqItems: Array<{ q: string; a: string }> = [];
  for (let i = 0; i < 10; i++) {
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

  return (
    <div className="min-h-[100dvh] bg-[var(--mio-bg)] text-white">
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* ──────────────────── 1. HERO ──────────────────── */}
        <section
          className="noise-overlay relative isolate min-h-[100dvh] overflow-hidden"
          style={heroBgStyle}
        >
          {/* Warm gradient background */}
          {s.home_hero_bg_type !== "image" ? (
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_25%_20%,#3b0764,transparent_60%),radial-gradient(700px_circle_at_75%_30%,rgba(251,113,133,0.18),transparent_55%),radial-gradient(1200px_circle_at_50%_80%,#1a0a2e,transparent_70%),linear-gradient(180deg,#0d0a14,rgba(13,10,20,0.85),#0d0a14)]" />
          ) : null}

          {/* Decorative orbs */}
          <GlowOrb className="left-[-10%] top-[10%] h-[500px] w-[500px]" color="purple" />
          <GlowOrb className="right-[-5%] top-[20%] h-[400px] w-[400px]" color="rose" />
          <GlowOrb className="bottom-[5%] left-[30%] h-[350px] w-[350px]" color="mixed" />

          <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-6xl flex-col justify-center px-4 pb-12 pt-10 sm:pb-16 sm:pt-16 lg:flex-row lg:items-center lg:gap-12">
            {/* Left: copy */}
            <div className="relative z-10 max-w-2xl lg:flex-1">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-[var(--mio-card)] px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-md">
                  <Star className="h-4 w-4 text-[var(--mio-rose)]" />
                  <span>{t("hero.trustBadge")}</span>
                </div>
              </Reveal>

              <Reveal delay={0.04}>
                <h1 className="mt-8 font-heading text-balance text-5xl font-bold leading-[1.08] tracking-tight sm:text-7xl lg:text-8xl">
                  <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    {isHe ? t("hero.headlineHe") : t("hero.headlineEn")}
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={0.07}>
                <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/80 sm:text-xl">
                  {isHe ? t("hero.subHe") : t("hero.subEn")}
                </p>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/games/truth-or-dare"
                    className="cta-glow inline-flex min-h-[56px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-8 py-4 text-base font-semibold text-white transition hover:brightness-110 sm:min-w-[240px]"
                  >
                    {t("hero.ctaPrimary")}
                    <ArrowRight className="ms-2 h-5 w-5" />
                  </Link>
                  <a
                    href="#games"
                    className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-purple-400/50 hover:bg-purple-500/20 sm:min-w-[220px]"
                  >
                    {t("hero.ctaSecondary")}
                    <ChevronDown className="ms-2 h-5 w-5 opacity-80" />
                  </a>
                </div>
              </Reveal>

              <Reveal delay={0.12}>
                <div className="mt-10 flex flex-wrap gap-2 text-sm text-white/70">
                  <span className="rounded-full border border-purple-500/20 bg-[var(--mio-card)] px-4 py-2 backdrop-blur-md">
                    {t("hero.tagline")}
                  </span>
                  <span className="rounded-full border border-purple-500/20 bg-[var(--mio-card)] px-4 py-2 backdrop-blur-md">
                    {t("hero.founded")}
                  </span>
                </div>
              </Reveal>
            </div>

            {/* Right: wheel placeholder */}
            <Reveal delay={0.15} className="relative z-10 mt-12 lg:mt-0 lg:flex-1">
              <div className="mx-auto flex max-w-md items-center justify-center lg:max-w-none">
                <div className="relative">
                  {/* Glow behind the wheel */}
                  <div
                    aria-hidden
                    className="absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.20)_0%,rgba(251,113,133,0.10)_50%,transparent_80%)] blur-3xl"
                  />
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-full border-2 border-dashed border-purple-400/30 bg-[var(--mio-card)] backdrop-blur-md sm:h-[360px] sm:w-[360px] lg:h-[420px] lg:w-[420px]">
                    <div className="text-center">
                      <Sparkles className="mx-auto h-10 w-10 text-[var(--mio-purple)]" />
                      <p className="mt-3 text-sm font-semibold text-white/60">
                        Wheel preview
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        420 &times; 420px
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <WarmDivider />

        {/* ──────────────────── 2. SOCIAL PROOF BAR ──────────────────── */}
        <section className="bg-[var(--mio-surface-b)] py-10">
          <div className="mx-auto max-w-6xl px-4">
            <div className="rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] p-5 backdrop-blur-md sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <Reveal>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-[var(--mio-purple)]" />
                    <p className="text-lg font-semibold text-white">
                      {t("socialProof.joining", {
                        count: s.social_proof_couples_count,
                      })}
                    </p>
                  </div>
                </Reveal>
                <Reveal delay={0.04}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[var(--mio-rose)]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm text-white/70">
                      {t("socialProof.rating", {
                        value: s.rating_value,
                        count: s.rating_count,
                      })}
                    </p>
                  </div>
                </Reveal>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((idx) => (
                  <Reveal key={idx} delay={0.06 + idx * 0.04}>
                    <div className="rounded-2xl border border-purple-500/15 bg-purple-950/30 p-4">
                      <p className="text-sm leading-relaxed text-white/80">
                        &ldquo;{t(`socialProof.quotes.${idx}`)}&rdquo;
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <WarmDivider />

        {/* ──────────────────── 3. FOR WHO ──────────────────── */}
        <Section id="for-who" title={t("forWho.title")} variant="a">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Sparkles, key: "renew" },
              { icon: HelpingHand, key: "therapy" },
              { icon: Flame, key: "flirt" },
              { icon: Heart, key: "deepen" },
            ].map((item, idx) => (
              <Reveal key={item.key} delay={idx * 0.05}>
                <div className="rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md transition hover:border-purple-400/30 hover:bg-purple-500/10">
                  <item.icon className="h-6 w-6 text-[var(--mio-purple)]" />
                  <p className="mt-4 text-lg font-bold text-white">
                    {t(`forWho.cards.${item.key}`)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {t(`forWho.cards.${item.key}Desc`)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 4. GAMES ──────────────────── */}
        <Section
          id="games"
          title={t("games.title")}
          subtitle={t("games.subtitle")}
          variant="b"
        >
          <div className="relative">
            <GlowOrb className="left-[-15%] top-[20%] h-[400px] w-[400px]" color="purple" />
            <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeGames.map((g, idx) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
                return (
                  <Reveal key={g.id} delay={idx * 0.04}>
                    <div className="group overflow-hidden rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md transition hover:border-purple-400/30">
                      <div className="relative aspect-[16/10]">
                        {g.thumbnail_url ? (
                          <Image
                            src={g.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:opacity-100"
                            width={640}
                            height={400}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center border-b border-dashed border-purple-400/20 bg-purple-950/30">
                            <div className="text-center">
                              <Flame className="mx-auto h-8 w-8 text-purple-400/40" />
                              <p className="mt-2 text-xs text-white/40">
                                Game thumbnail
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <h3 className="font-heading text-2xl font-bold text-white">
                          {name}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/70">
                          {desc}
                        </p>
                        <div className="mt-5">
                          <Link
                            href={`/games/${g.slug}`}
                            className="cta-glow inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-6 py-3 text-base font-semibold text-white transition hover:brightness-110"
                          >
                            {t("games.playNow")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}

              <Reveal delay={activeGames.length * 0.04}>
                <div className="rounded-2xl border border-dashed border-purple-400/25 bg-purple-950/20 p-6 backdrop-blur-md">
                  <Wand2 className="h-6 w-6 text-[var(--mio-rose)]" />
                  <h3 className="mt-4 font-heading text-2xl font-bold text-white/90">
                    {t("games.comingSoonTitle")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">
                    {t("games.comingSoonDesc")}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 5. HOW IT WORKS ──────────────────── */}
        <Section id="how" title={t("how.title")} subtitle={t("how.subtitle")} variant="a">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, key: "step1", num: "01" },
              { icon: Sparkles, key: "step2", num: "02" },
              { icon: Flame, key: "step3", num: "03" },
            ].map((item, idx) => (
              <Reveal key={item.key} delay={idx * 0.05}>
                <div className="rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-6 backdrop-blur-md transition hover:border-purple-400/30 hover:bg-purple-500/10">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-xs font-bold text-white">
                      {item.num}
                    </span>
                    <item.icon className="h-5 w-5 text-[var(--mio-purple)]" />
                  </div>
                  <p className="text-lg font-bold text-white">
                    {t(`how.${item.key}.title`)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {t(`how.${item.key}.desc`)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 6. EXPERT ──────────────────── */}
        <Section id="expert" title={t("expert.title")} variant="b">
          <div className="relative">
            <GlowOrb className="right-[-10%] top-[-10%] h-[350px] w-[350px]" color="rose" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-center">
              <Reveal className="lg:col-span-5">
                <div className="overflow-hidden rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md">
                  {s.expert_photo_url ? (
                    <div className="relative aspect-[4/5]">
                      <Image
                        src={s.expert_photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        width={400}
                        height={500}
                        sizes="(min-width: 1024px) 40vw, 100vw"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center border-b border-dashed border-purple-400/20 bg-purple-950/30">
                      <div className="text-center">
                        <Users className="mx-auto h-10 w-10 text-purple-400/40" />
                        <p className="mt-3 text-sm font-semibold text-white/50">
                          Expert photo
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          400 &times; 500px
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>

              <div className="lg:col-span-7">
                <Reveal>
                  <h3 className="font-heading text-3xl font-bold text-white sm:text-4xl">
                    {t("expert.name")}
                  </h3>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className="mt-2 text-lg font-semibold">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {t("expert.titleLine")}
                    </span>
                  </p>
                </Reveal>
                <Reveal delay={0.08}>
                  <p className="mt-6 text-lg leading-relaxed text-white/75">
                    {t("expert.bio")}
                  </p>
                </Reveal>
                <Reveal delay={0.1}>
                  <div className="mt-8 rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-5 backdrop-blur-md">
                    <p className="text-base font-bold text-white">
                      {t("expert.credibility")}
                    </p>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 7. PRICING ──────────────────── */}
        <Section
          id="pricing"
          title={t("pricing.title")}
          subtitle={t("pricing.subtitle")}
          variant="a"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { key: "weekly", featured: false },
              { key: "monthly", featured: true },
              { key: "annual", featured: false },
            ].map((p, idx) => (
              <Reveal key={p.key} delay={idx * 0.05}>
                <div
                  className={`relative rounded-3xl p-6 backdrop-blur-md transition ${
                    p.featured
                      ? "border-2 border-transparent bg-[var(--mio-card)] shadow-[0_0_0_2px_transparent] [background-clip:padding-box] before:pointer-events-none before:absolute before:inset-[-2px] before:z-[-1] before:rounded-[inherit] before:bg-gradient-to-b before:from-fuchsia-500 before:to-pink-500 before:content-['']"
                      : "border border-purple-500/20 bg-[var(--mio-card)]"
                  }`}
                >
                  {p.featured ? (
                    <div className="absolute -top-3 start-6 inline-flex rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/25">
                      {t("pricing.popular")}
                    </div>
                  ) : null}
                  <h3 className="font-heading text-2xl font-bold text-white">
                    {t(`pricing.plans.${p.key}.name`)}
                  </h3>
                  <p className="mt-3 text-4xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {t(`pricing.plans.${p.key}.price`)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--mio-rose)]">
                    {t("pricing.cancelAnytime")}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-white/80">
                    {["f1", "f2", "f3"].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-[var(--mio-purple)]" />
                        <span>{t(`pricing.features.${f}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <button
                      className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-8 py-4 text-base font-bold text-white transition hover:brightness-110 ${
                        p.featured
                          ? "cta-glow bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500"
                          : "border border-purple-400/30 bg-purple-500/15 hover:border-purple-400/50 hover:bg-purple-500/25"
                      }`}
                    >
                      {t("pricing.cta")}
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 8. ARTICLES ──────────────────── */}
        <Section id="articles" title={t("articles.title")} variant="b">
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <Reveal key={idx} delay={idx * 0.05}>
                <div className="overflow-hidden rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md transition hover:border-purple-400/30">
                  {/* Placeholder image area */}
                  <div className="flex aspect-[16/10] items-center justify-center border-b border-dashed border-purple-400/20 bg-purple-950/30">
                    <div className="text-center">
                      <BookOpen className="mx-auto h-8 w-8 text-purple-400/40" />
                      <p className="mt-2 text-xs text-white/40">
                        Article image — 640 &times; 400px
                      </p>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-lg font-bold text-white">
                      {t(`articles.cards.${idx}.title`)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      {t(`articles.cards.${idx}.excerpt`)}
                    </p>
                    <div className="mt-5">
                      <Link
                        href="/articles"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--mio-rose)] underline-offset-4 hover:underline"
                      >
                        {t("articles.readMore")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <div className="mt-10 flex justify-center">
              <Link
                href="/articles"
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-purple-400/50 hover:bg-purple-500/20"
              >
                {t("articles.all")}
              </Link>
            </div>
          </Reveal>
        </Section>

        <WarmDivider />

        {/* ──────────────────── 9. FAQ ──────────────────── */}
        <Section id="faq" title={t("faq.title")} variant="a">
          <div className="mx-auto max-w-3xl space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Reveal key={idx} delay={idx * 0.04}>
                <details className="group rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-5 backdrop-blur-md">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-white">
                    <span>{t(`faq.items.${idx}.q`)}</span>
                    <ChevronDown className="h-5 w-5 text-[var(--mio-purple)] transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 text-base leading-relaxed text-white/75">
                    {t(`faq.items.${idx}.a`)}
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </Section>

        <WarmDivider />

      </main>
    </div>
  );
}
