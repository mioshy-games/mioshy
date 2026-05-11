import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleRow } from "@/lib/types/database";
import { pickLocalized } from "@/lib/articles";
import { Link } from "@/navigation";
import { Reveal } from "@/components/marketing/Reveal";
import { ArticleCover } from "@/components/articles/ArticleCover";
import type { Metadata } from "next";

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
  const t = await getTranslations({ locale, namespace: "articlesPage" });
  const title = `Mioshy - ${t("title")}`;
  const description = t("subtitle");

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/articles`,
      languages: {
        en: `${base}/en/articles`,
        he: `${base}/he/articles`,
        "x-default": `${base}/en/articles`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/articles`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  if (locale === "he") {
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Localise the article author display. See [slug]/page.tsx for the
 *  canonical implementation. Per Itzik 2026-05-07: HE → "יצחק ברלב". */
function localiseAuthor(author: string | null, locale: string): string {
  if (!author) return "Mioshy";
  if (locale === "he" && /itzik\s+berlav/i.test(author)) {
    return "יצחק ברלב";
  }
  return author;
}

export default async function ArticlesListPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const { locale } = params;
  const t = await getTranslations("articlesPage");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("articles")
    .select(
      "id, slug, title_he, title_en, excerpt_he, excerpt_en, cover_image_url, emoji, author, published_at, created_at",
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const articles = (data ?? []) as Pick<
    ArticleRow,
    | "id"
    | "slug"
    | "title_he"
    | "title_en"
    | "excerpt_he"
    | "excerpt_en"
    | "cover_image_url"
    | "emoji"
    | "author"
    | "published_at"
    | "created_at"
  >[];

  return (
    <div className="min-h-[100dvh] bg-[var(--mio-bg)] text-white">
      <section className="bg-[var(--mio-surface-a)] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <h1 className="font-heading text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                {t("title")}
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mt-4 max-w-2xl text-pretty text-lg text-white/75 sm:text-xl">
              {t("subtitle")}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-[var(--mio-surface-b)] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          {articles.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a, idx) => {
                const title = pickLocalized({
                  locale,
                  he: a.title_he,
                  en: a.title_en,
                }).value;
                const excerpt = pickLocalized({
                  locale,
                  he: a.excerpt_he,
                  en: a.excerpt_en,
                }).value;
                const date = formatDate(a.published_at ?? a.created_at, locale);
                const authorDisplay = localiseAuthor(a.author, locale);
                return (
                  <Reveal key={a.id} delay={idx * 0.04}>
                    <article className="group overflow-hidden rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md transition hover:border-purple-400/30 hover:shadow-[0_0_0_1px_rgba(232,121,249,0.18)]">
                      <div className="relative">
                        <ArticleCover
                          coverImageUrl={a.cover_image_url}
                          emoji={a.emoji}
                          title={title}
                          className="aspect-[16/10] w-full"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>

                      <div className="p-6">
                        <h2 className="font-heading text-2xl font-bold text-white">
                          {title || t("untitled")}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">
                          {excerpt}
                        </p>
                        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-white/55">
                          <span className="truncate">{authorDisplay}</span>
                          <span className="shrink-0">{date}</span>
                        </div>
                        <div className="mt-5">
                          <Link
                            href={`/articles/${a.slug}`}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--mio-rose)] underline-offset-4 hover:underline"
                          >
                            {t("readMore")} <span aria-hidden>→</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-10 text-center text-white/70">
              {t("empty")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

