import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import { Link } from "@/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameRow } from "@/lib/types/database";
import { ArrowRight, Gamepad2, HeartHandshake, Sparkles, Shield } from "lucide-react";

/**
 * /games — the games category landing page.
 *
 * This is a dedicated SEO hub designed to rank for the head term "couples
 * games" / "משחקי זוגיות" and related queries. It's a proper long-form
 * page: H1 + descriptive lede, "why Mioshy" value props, a visible
 * catalogue of every active game, breadcrumb + ItemList JSON-LD, full
 * hreflang linkage. Having this landing page also gives us a strong
 * internal-linking target from the homepage and footer.
 */

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
  const t = await getTranslations({ locale, namespace: "gamesHub" });
  const title = `Mioshy — ${t("title")}`;
  const description = t("subtitle");
  const canonical = `${base}/${locale}/games`;
  return {
    title,
    description,
    keywords:
      locale === "he"
        ? [
            "משחקי זוגיות",
            "אמת או חובה",
            "משחקים לזוגות",
            "שאלות לזוגות",
            "סולמות ונחשים",
            "משחק זוגי בדפדפן",
          ]
        : [
            "couples games",
            "truth or dare for couples",
            "relationship games",
            "date night games",
            "couples questions",
            "snakes and ladders couples",
          ],
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/games`,
        he: `${base}/he/games`,
        "x-default": `${base}/en/games`,
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

export default async function GamesHubPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const locale = params.locale;
  const isHe = locale === "he";
  const t = await getTranslations({ locale, namespace: "gamesHub" });

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const games = (data ?? []) as GameRow[];

  const base = siteUrl();
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
            name: t("breadcrumbGames"),
            item: `${base}/${locale}/games`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: t("title"),
        description: t("subtitle"),
        url: `${base}/${locale}/games`,
      },
      {
        "@type": "ItemList",
        itemListElement: games.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/${locale}/games/${g.slug}`,
          name: isHe ? g.name_he : g.name_en,
        })),
      },
    ],
  };

  const whyItems = [0, 1, 2, 3].map((i) => ({
    h: t(`whyItems.${i}.h`),
    p: t(`whyItems.${i}.p`),
  }));
  const whyIcons = [Gamepad2, HeartHandshake, Sparkles, Shield];

  return (
    <div
      className="min-h-[100dvh] bg-[var(--mio-bg)] text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative">
        {/* Hero */}
        <section className="relative isolate overflow-hidden px-4 pb-14 pt-16 sm:pb-20 sm:pt-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_25%_20%,#3b0764,transparent_60%),radial-gradient(700px_circle_at_75%_30%,rgba(251,113,133,0.18),transparent_55%),linear-gradient(180deg,#0d0a14,rgba(13,10,20,0.9),#0d0a14)]"
          />
          <div className="mx-auto max-w-5xl text-center">
            <nav
              aria-label="breadcrumb"
              className="mb-8 flex items-center justify-center gap-2 text-xs text-white/60"
            >
              <Link
                href="/"
                className="transition hover:text-white/90"
              >
                {t("breadcrumbHome")}
              </Link>
              <span aria-hidden>/</span>
              <span className="text-white/80">{t("breadcrumbGames")}</span>
            </nav>

            <h1 className="font-heading text-balance text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                {t("h1")}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-relaxed text-white/80 sm:text-xl">
              {t("lede")}
            </p>
          </div>
        </section>

        {/* Why us */}
        <section className="px-4 pb-14 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">
              {t("whyTitle")}
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {whyItems.map((it, i) => {
                const Icon = whyIcons[i];
                return (
                  <div
                    key={i}
                    className="rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] p-5 backdrop-blur-md"
                  >
                    <Icon className="h-7 w-7 text-[var(--mio-purple)]" />
                    <h3 className="mt-4 text-lg font-bold">{it.h}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {it.p}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Catalogue */}
        <section id="catalogue" className="px-4 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              {t("catalogueTitle")}
            </h2>

            {games.length === 0 ? (
              <p className="mt-6 text-white/70">—</p>
            ) : (
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((g) => {
                  const name = isHe ? g.name_he : g.name_en;
                  const desc = isHe ? g.description_he : g.description_en;
                  return (
                    <li
                      key={g.id}
                      className="group overflow-hidden rounded-3xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md transition hover:border-purple-400/40"
                    >
                      <Link
                        href={`/games/${g.slug}`}
                        className="flex h-full flex-col"
                      >
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/30">
                          {g.thumbnail_url ? (
                            <Image
                              src={g.thumbnail_url}
                              alt={name}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              className="object-cover transition duration-500 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-purple-900/40 to-pink-900/40">
                              <Gamepad2 className="h-12 w-12 text-white/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="font-heading text-xl font-bold">
                            {name}
                          </h3>
                          {desc ? (
                            <p className="mt-2 text-sm leading-relaxed text-white/75 line-clamp-3">
                              {desc}
                            </p>
                          ) : null}
                          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--mio-purple)] transition group-hover:text-white">
                            {t("ctaPrimary")}
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-3xl rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-8 text-center backdrop-blur-md">
            <h2 className="font-heading text-3xl font-bold">{t("ctaTitle")}</h2>
            <p className="mt-3 text-white/80">{t("ctaSub")}</p>
            <a
              href="#catalogue"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-8 py-3 text-base font-semibold text-white transition hover:brightness-110"
            >
              {t("ctaPrimary")}
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
