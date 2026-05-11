import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleRow } from "@/lib/types/database";
import { pickLocalized } from "@/lib/articles";
import { Link } from "@/navigation";
import { Reveal } from "@/components/marketing/Reveal";
import { ArticleCover } from "@/components/articles/ArticleCover";
import { ArticleContent } from "@/components/articles/ArticleContent";
import Image from "next/image";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const { locale, slug } = params;
  const base = siteUrl();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("articles")
    .select(
      "slug, title_he, title_en, excerpt_he, excerpt_en, meta_title_he, meta_title_en, meta_description_he, meta_description_en, canonical_url, og_image_url, cover_image_url, is_published",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) return {};

  const a = data as Pick<
    ArticleRow,
    | "slug"
    | "title_he"
    | "title_en"
    | "excerpt_he"
    | "excerpt_en"
    | "meta_title_he"
    | "meta_title_en"
    | "meta_description_he"
    | "meta_description_en"
    | "canonical_url"
    | "og_image_url"
    | "cover_image_url"
    | "is_published"
  >;

  const titlePick = pickLocalized({
    locale,
    he: a.meta_title_he ?? a.title_he,
    en: a.meta_title_en ?? a.title_en,
  });
  const descPick = pickLocalized({
    locale,
    he: a.meta_description_he ?? a.excerpt_he,
    en: a.meta_description_en ?? a.excerpt_en,
  });

  const canonical =
    a.canonical_url || `${base}/${locale}/articles/${a.slug}`;
  const ogImage = a.og_image_url || a.cover_image_url || undefined;

  return {
    title: titlePick.value || undefined,
    description: descPick.value || undefined,
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/articles/${a.slug}`,
        he: `${base}/he/articles/${a.slug}`,
        "x-default": `${base}/en/articles/${a.slug}`,
      },
    },
    openGraph: {
      type: "article",
      title: titlePick.value || undefined,
      description: descPick.value || undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      url: canonical,
    },
  };
}

// ─── Gradient seeds (same logic as ArticleCover) ────────────────────────────
const GRADIENTS: [string, string][] = [
  ["#7c3aed", "#db2777"],
  ["#be185d", "#f97316"],
  ["#1d4ed8", "#7c3aed"],
  ["#065f46", "#0891b2"],
  ["#92400e", "#dc2626"],
  ["#1e3a5f", "#7c3aed"],
];
function getGradient(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function ArticleDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  noStore();
  const { locale, slug } = params;
  const t = await getTranslations("articlePage");
  const isRtl = locale === "he";

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("articles")
    .select(
      "id, slug, title_he, title_en, excerpt_he, excerpt_en, content_he, content_en, cover_image_url, emoji, author, published_at, created_at, tags, reading_time_minutes",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) notFound();

  const a = data as Pick<
    ArticleRow,
    | "id"
    | "slug"
    | "title_he"
    | "title_en"
    | "excerpt_he"
    | "excerpt_en"
    | "content_he"
    | "content_en"
    | "cover_image_url"
    | "emoji"
    | "author"
    | "published_at"
    | "created_at"
    | "tags"
    | "reading_time_minutes"
  >;

  const titlePick = pickLocalized({ locale, he: a.title_he, en: a.title_en });
  const excerptPick = pickLocalized({ locale, he: a.excerpt_he, en: a.excerpt_en });
  const contentPick = pickLocalized({ locale, he: a.content_he, en: a.content_en });
  const date = formatDate(a.published_at ?? a.created_at);

  const [from, to] = getGradient(a.emoji ?? a.slug ?? "article");

  // ── Structured data (Article + BreadcrumbList) ─────────────────────────
  const base = siteUrl();
  const articleUrl = `${base}/${locale}/articles/${a.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${articleUrl}#article`,
        headline: titlePick.value || "",
        description: excerptPick.value || "",
        inLanguage: locale === "he" ? "he-IL" : "en-US",
        datePublished: a.published_at ?? a.created_at ?? undefined,
        dateModified: a.published_at ?? a.created_at ?? undefined,
        author: {
          "@type": "Person",
          name: a.author || "Mioshy",
        },
        image: a.cover_image_url ? [a.cover_image_url] : undefined,
        publisher: {
          "@type": "Organization",
          "@id": `${base}/#organization`,
          name: "Mioshy",
          logo: {
            "@type": "ImageObject",
            url: `${base}/icon.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": articleUrl,
        },
        keywords:
          Array.isArray(a.tags) && a.tags.length > 0 ? a.tags.join(", ") : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: locale === "he" ? "דף הבית" : "Home",
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: locale === "he" ? "מאמרים" : "Articles",
            item: `${base}/${locale}/articles`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: titlePick.value || "",
            item: articleUrl,
          },
        ],
      },
    ],
  };

  // Related articles
  const { data: relatedRaw } = await supabase
    .from("articles")
    .select(
      "id, slug, title_he, title_en, cover_image_url, emoji, published_at, created_at",
    )
    .eq("is_published", true)
    .neq("id", a.id)
    .order("published_at", { ascending: false })
    .limit(3);

  const related = (relatedRaw ?? []) as Array<
    Pick<
      ArticleRow,
      | "id"
      | "slug"
      | "title_he"
      | "title_en"
      | "cover_image_url"
      | "emoji"
      | "published_at"
      | "created_at"
    >
  >;

  return (
    <div
      className="min-h-[100dvh]"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* ── HERO (dark, branded) ──────────────────────────────────────────── */}
      <div className="relative bg-[var(--mio-surface-a)]">
        {a.cover_image_url ? (
          <Image
            src={a.cover_image_url}
            alt=""
            width={1280}
            height={480}
            className="h-[260px] w-full object-cover sm:h-[380px] lg:h-[440px]"
            sizes="100vw"
            priority
          />
        ) : (
          <div
            className="h-[260px] w-full sm:h-[380px] lg:h-[440px] flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
          >
            <span style={{ fontSize: "clamp(5rem, 12vw, 9rem)", lineHeight: 1 }} aria-hidden>
              {a.emoji ?? "💬"}
            </span>
          </div>
        )}
        {/* gradient overlay → fades into the white body below */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-transparent" />
      </div>

      {/* ── ARTICLE BODY (light) ─────────────────────────────────────────── */}
      <div className="bg-white">

        {/* Meta strip */}
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-2">

          {/* Back link */}
          <Reveal>
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
            >
              <span aria-hidden>{isRtl ? "→" : "←"}</span>
              {t("back")}
            </Link>
          </Reveal>

          {/* Title */}
          <Reveal delay={0.04}>
            <h1 className="mt-5 font-heading text-balance text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl leading-tight">
              {titlePick.value || t("untitled")}
            </h1>
          </Reveal>

          {/* Excerpt */}
          {excerptPick.value && (
            <Reveal delay={0.06}>
              <p className="mt-4 text-lg text-gray-500 leading-relaxed">
                {excerptPick.value}
              </p>
            </Reveal>
          )}

          {/* Author · Date · Reading time · Tags */}
          <Reveal delay={0.07}>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 pb-6">
              <span className="text-sm font-medium text-gray-700">{a.author}</span>
              <span className="text-gray-300" aria-hidden>•</span>
              <span className="text-sm text-gray-500">{date}</span>
              {a.reading_time_minutes && (
                <>
                  <span className="text-gray-300" aria-hidden>•</span>
                  <span className="text-sm text-gray-500">
                    {a.reading_time_minutes} {isRtl ? "דק׳ קריאה" : "min read"}
                  </span>
                </>
              )}
              {Array.isArray(a.tags) && a.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 ms-auto">
                  {a.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-rose-50 px-3 py-0.5 text-xs font-medium text-rose-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>

        {/* Fallback language notice */}
        {contentPick.isFallback && (
          <Reveal delay={0.08}>
            <div className="mx-auto max-w-3xl px-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {t("fallbackNotice", {
                  language:
                    contentPick.usedLocale === "he"
                      ? t("langHebrew")
                      : t("langEnglish"),
                })}
              </div>
            </div>
          </Reveal>
        )}

        {/* ── PROSE CONTENT ── */}
        <Reveal delay={0.1}>
          <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
            <ArticleContent content={contentPick.value ?? ""} isRtl={isRtl} />
          </div>
        </Reveal>
      </div>

      {/* ── CTA STRIP ────────────────────────────────────────────────────── */}
      <div
        className="py-12 px-4 text-center text-white"
        style={{ background: `linear-gradient(135deg, #7c3aed 0%, #db2777 100%)` }}
      >
        <p className="text-xl font-bold mb-3">
          {isRtl ? "מוכנים לשחק?" : "Ready to play?"}
        </p>
        <p className="text-white/80 mb-6 text-sm">
          {isRtl
            ? "כל המשחקים שנזכרו במאמר - חינמיים, ללא הורדה"
            : "All games mentioned in this article - free, no download"}
        </p>
        <Link
          href="/games"
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-rose-600 shadow-lg hover:bg-rose-50 transition-colors"
        >
          {isRtl ? "שחקו עכשיו ←" : "Play Now →"}
        </Link>
      </div>

      {/* ── RELATED ARTICLES ─────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="bg-[var(--mio-surface-b)] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  {t("related")}
                </span>
              </h2>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {related.map((r, idx) => {
                const rt = pickLocalized({ locale, he: r.title_he, en: r.title_en }).value;
                return (
                  <Reveal key={r.id} delay={0.04 + idx * 0.04}>
                    <Link href={`/articles/${r.slug}`} className="group block">
                      <article className="overflow-hidden rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] backdrop-blur-md transition hover:border-purple-400/40 hover:shadow-[0_0_0_1px_rgba(232,121,249,0.2)]">
                        <ArticleCover
                          coverImageUrl={r.cover_image_url}
                          emoji={r.emoji}
                          title={rt}
                          className="aspect-[16/10] w-full"
                        />
                        <div className="p-5">
                          <p className="font-heading text-lg font-bold text-white group-hover:text-pink-300 transition-colors line-clamp-2">
                            {rt || t("untitled")}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-[var(--mio-rose)]">
                            {t("read")} <span aria-hidden>→</span>
                          </p>
                        </div>
                      </article>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
