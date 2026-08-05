import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import { buildAlternates, buildOgLocale } from "@/lib/seo/alternates";
import { breadcrumbJsonLd, safeJsonLd, siteUrl } from "@/lib/seo/jsonLd";

// 2026-05-23 — Itzik flagged a build-time warning:
//   "[cms] loadCmsTextsForPage threw: Dynamic server usage: Route
//    /he/about/founder couldn't be rendered statically because it
//    used `cookies`."
// loadCmsTextsForPage() opens a Supabase server client that reads the
// auth cookies, which Next.js refuses to do at build time on a static
// route. The page is content-rich and reads from the live CMS on
// every visit, so static rendering wasn't appropriate anyway — we
// just have to tell Next.js it's dynamic. `noStore()` is already
// called inside the page; adding `force-dynamic` here makes the
// build-time renderer skip the page outright and stops the noisy
// warning from masking real CMS errors in the log.
export const dynamic = "force-dynamic";

/**
 * /[locale]/about/founder
 *
 * The personal story of Itzik Berlev — Mioshy's founder. Linked from
 * the Founder section CTA on the homepage ("קראו את הסיפור המלא").
 *
 * Design direction
 * ────────────────
 * Editorial long-form, NOT corporate "about us". The page reads like a
 * magazine feature: tight reading column (~680px, the cognitive-psych
 * sweet spot for sustained reading), serif chapter titles, sans body,
 * pull-quotes that interrupt the flow at the right moments, and a long
 * quiet closing CTA back to the product.
 *
 * The story has 8 chapters that are tonally distinct — crisis → decision
 * → study → breakthrough → insight → founding → naming → invitation.
 * The naming chapter (the Italian etymology) is the best moment of the
 * whole piece and gets its own visual treatment — it's the brand's
 * emotional keystone.
 *
 * Localization
 * ────────────
 * The long-form story copy is intentionally Hebrew-only — Itzik wrote it
 * in Hebrew and an English translation will be a separate copy pass, not
 * a machine translation. The seed in messages/en.json mirrors the Hebrew
 * text so /en/about/founder renders the story unchanged; bilingual
 * chrome (backLink / eyebrow / bioMeta / imageAlt / CTA button / meta)
 * carries proper English. Editing happens in /admin/content under the
 * `about` tab once migration 085 lands.
 *
 * CMS wiring
 * ──────────
 * Every visible string flows through `<CmsText>`. Metadata uses
 * `getCmsTranslations` so meta.title / meta.description are editable
 * too. Three rows are rich (is_rich=true in migration 085):
 *   • hero.nameRich      — italic "ברלב"
 *   • chapter4.p2        — italic "אנחנו"
 *   • chapter7.closer    — italic "אישה שלי"
 * They render through the .cms-rich pipeline so per-word formatting
 * from the admin editor is preserved exactly as in the CMS preview —
 * same path as homeV2.hero.lead.
 */

const BODY_FONT =
  "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif";
const SERIF_FONT = "'Frank Ruhl Libre', serif";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale === "he" ? "he" : "en";
  const t = await getCmsTranslations({
    locale,
    namespace: "about.founder",
    page: "about",
  });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: buildAlternates(locale, "/about/founder"),
    openGraph: {
      ...buildOgLocale(locale),
      type: "article",
      authors: ["Itzik Berlev"],
      images: ["/images/itzik-barlev_new.webp"],
    },
  };
}

export default async function FounderStoryPage({
  params,
}: {
  params: { locale: string };
}) {
  // CMS edits should appear on next render without rebuild, so we opt
  // out of the route-level static cache. The page used to be
  // `force-static` (it had no per-request data); flipping to noStore
  // matches the homepage and the journey marketing page.
  noStore();
  const isHe = params.locale === "he";
  const cmsRows = await loadCmsTextsForPage("about");

  // Resolve the image alt server-side so we don't have to plant a
  // `useCmsText` hook inside this server tree just for one attribute.
  // CMS row wins; falls back to the hardcoded literal that the page
  // shipped with before the migration (kept stable so a CMS outage
  // can't break the alt).
  const altRow = cmsRows.find((r) => r.key === "about.founder.hero.imageAlt");
  const altCms = isHe ? altRow?.he_text : altRow?.en_text;
  const imageAlt =
    altCms && altCms.trim().length > 0
      ? altCms
      : isHe
        ? "איציק ברלב"
        : "Itzik Berlev";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // Person entity for the founder — builds brand/E-E-A-T (the page is
  // og:type=article but shipped no Person/Article schema).
  const base = siteUrl();
  // One name for both structured-data nodes so the breadcrumb below and the
  // Person node can never drift. NOTE: the page's own visible <h1> renders
  // "יצחק ברלב" while this spells it "איציק" — a pre-existing mismatch, left
  // exactly as-is here because which spelling is correct is Itzik's call, not
  // a refactor's.
  const founderName = isHe ? "איציק ברלב" : "Itzik Berlev";
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: founderName,
    url: `${base}/${params.locale}/about/founder`,
    jobTitle: isHe ? "מייסד מיאושי" : "Founder of Mioshy",
    worksFor: { "@type": "Organization", name: "Mioshy", url: base },
  };

  return (
    <CmsTextProvider rows={cmsRows}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            // No "/about" crumb between home and here: that URL 404s (there is
            // no about index, only this page), and a breadcrumb that links to a
            // 404 is worse than a shorter trail.
            ...breadcrumbJsonLd(isHe ? "he" : "en", [
              { name: founderName, path: "/about/founder" },
            ]),
          }),
        }}
      />
      <article
        dir={isHe ? "rtl" : "ltr"}
        className="relative min-h-[100dvh] overflow-hidden bg-[#fdf8f4] text-stone-900"
        style={{ fontFamily: BODY_FONT }}
      >
        {/* Soft warm gradient wash — cream → peach at the top so the
            page reads like an open book rather than a flat content
            page. Decorative only; pointer-events-none keeps it out of
            any selection. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60vh] bg-[linear-gradient(180deg,#fff0e6_0%,#fdf2ec_45%,#fdf8f4_100%)]"
        />

        {/* ───── HERO ───── */}
        <header className="relative z-10 mx-auto max-w-[920px] px-5 pt-12 sm:pt-16">
          {/* Back link — quiet, doesn't compete with the headline */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-stone-900"
          >
            <Arrow className="h-3.5 w-3.5" />
            <CmsText cmsKey="about.founder.hero.backLink" />
          </Link>

          {/* Eyebrow + bold name treatment. The italic accent on
              "ברלב" / "Berlev" comes from the rich-text <em> in the
              CMS row; .cms-rich em is brand red + italic, so we strip
              `italic` here to avoid double-italicising. */}
          <div className="mt-10 sm:mt-14">
            <CmsText
              cmsKey="about.founder.hero.eyebrow"
              as="p"
              className="text-[12px] font-semibold uppercase tracking-[0.32em] text-rose-600/80"
              style={{ fontFamily: BODY_FONT }}
            />
            <CmsText
              cmsKey="about.founder.hero.nameRich"
              as="h1"
              className="mt-4 text-[42px] leading-[1.05] tracking-tight text-stone-900 sm:text-[56px] lg:text-[72px]"
              style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
            />
            <CmsText
              cmsKey="about.founder.hero.bioMeta"
              as="p"
              className="mt-4 text-[15px] text-stone-500 sm:text-[16px]"
              style={{ fontFamily: BODY_FONT }}
            />
          </div>

          {/* Hero photo — editorial frame.
              2026-05-19 — Itzik flagged that at the previous size
              (920px wide × 4:3 aspect = 690px tall) the photo
              dominated the page and still cropped the lower face
              despite the top-anchored object-position. Two fixes:
              (a) cap the photo at 460-540px wide so it reads as an
              editorial portrait card, not a billboard; (b) switch
              aspect from 4:3 (landscape) to 4:5 (portrait) so the
              face fits naturally without aggressive cropping. The
              wrapper is still centered inside the 920px header. */}
          <figure className="relative mx-auto mt-10 w-full max-w-[460px] overflow-hidden rounded-[28px] shadow-[0_30px_70px_-25px_rgba(120,53,15,0.4)] sm:mt-14 sm:max-w-[540px]">
            <div className="aspect-[4/5] w-full bg-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/itzik-barlev_new.webp"
                alt={imageAlt}
                className="h-full w-full object-cover"
                style={{ objectPosition: "center top" }}
              />
            </div>
          </figure>

          {/* Big pull quote that hooks the reader before chapter 1.
              The job of this quote: make a stranger commit to reading
              the next 5 minutes. It promises the arc of the whole
              story — the crisis, the journey, and the outcome — in
              one breath. */}
          <blockquote
            className="mx-auto mt-12 max-w-[680px] text-center sm:mt-16"
            style={{ fontFamily: SERIF_FONT }}
          >
            <CmsText
              cmsKey="about.founder.hero.pullQuote"
              as="p"
              className="text-[26px] leading-[1.3] text-stone-900 sm:text-[32px]"
              style={{ fontStyle: "italic", fontWeight: 500 }}
            />
          </blockquote>
        </header>

        {/* ───── BODY (chapters) ───── */}
        <main className="relative z-10 mx-auto mt-16 max-w-[680px] px-5 pb-24 sm:mt-20 sm:pb-32">
          <Chapter num={1} titleKey="about.founder.chapter1.title">
            <Lede>
              <CmsText cmsKey="about.founder.chapter1.lede" />
            </Lede>
            <p>
              <CmsText cmsKey="about.founder.chapter1.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter1.p2" />
            </p>
            <p className="font-semibold text-stone-900">
              <CmsText cmsKey="about.founder.chapter1.p3" />
            </p>
          </Chapter>

          <Chapter num={2} titleKey="about.founder.chapter2.title">
            <p>
              <CmsText cmsKey="about.founder.chapter2.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter2.p2" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter2.p3" />
            </p>
          </Chapter>

          <Chapter num={3} titleKey="about.founder.chapter3.title">
            <p>
              <CmsText cmsKey="about.founder.chapter3.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter3.p2" />
            </p>
            <PullQuote>
              <CmsText cmsKey="about.founder.chapter3.pullQuote" />
            </PullQuote>
            <p>
              <CmsText cmsKey="about.founder.chapter3.p3" />
            </p>
          </Chapter>

          <Chapter num={4} titleKey="about.founder.chapter4.title">
            <p>
              <CmsText cmsKey="about.founder.chapter4.p1" />
            </p>
            <CmsText cmsKey="about.founder.chapter4.p2" as="p" />
          </Chapter>

          <Chapter num={5} titleKey="about.founder.chapter5.title">
            <p>
              <CmsText cmsKey="about.founder.chapter5.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter5.p2" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter5.p3" />
            </p>
          </Chapter>

          <Chapter num={6} titleKey="about.founder.chapter6.title">
            <p>
              <CmsText cmsKey="about.founder.chapter6.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter6.p2" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter6.p3" />
            </p>
          </Chapter>

          {/* ───── THE NAMING CHAPTER ─────
              The brand's emotional keystone. Visually it deserves its
              own treatment — a soft accent card with the Italian
              etymology broken out so the reader sees the wordplay
              rather than parsing it from prose. */}
          <Chapter num={7} titleKey="about.founder.chapter7.title">
            <Lede>
              <CmsText cmsKey="about.founder.chapter7.lede" />
            </Lede>
            <p>
              <CmsText cmsKey="about.founder.chapter7.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter7.p2" />
            </p>

            {/* Etymology breakout — three rows, each a piece of the name */}
            <div
              className="my-8 rounded-[20px] border border-amber-200/70 bg-gradient-to-br from-amber-50 to-rose-50/60 px-6 py-7 sm:px-8 sm:py-8"
              dir="rtl"
            >
              <div className="space-y-5">
                <EtymologyRow
                  italianKey="about.founder.chapter7.etymology.row1Italian"
                  meaningKey="about.founder.chapter7.etymology.row1Meaning"
                />
                <EtymologyRow
                  italianKey="about.founder.chapter7.etymology.row2Italian"
                  meaningKey="about.founder.chapter7.etymology.row2Meaning"
                />
                <div className="border-t border-amber-200/60 pt-5">
                  <EtymologyRow
                    italianKey="about.founder.chapter7.etymology.row3Italian"
                    meaningKey="about.founder.chapter7.etymology.row3Meaning"
                    emphasized
                  />
                </div>
                <div className="pt-2 text-center">
                  <CmsText
                    cmsKey="about.founder.chapter7.etymology.brandLatin"
                    as="span"
                    className="inline-block bg-gradient-to-br from-rose-600 to-amber-600 bg-clip-text text-[44px] leading-none text-transparent sm:text-[56px]"
                    style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
                  />
                  <CmsText
                    cmsKey="about.founder.chapter7.etymology.brandHebrew"
                    as="p"
                    className="mt-2 text-[14px] text-stone-600"
                    style={{ fontFamily: BODY_FONT }}
                  />
                </div>
              </div>
            </div>

            <CmsText cmsKey="about.founder.chapter7.closer" as="p" />
          </Chapter>

          <Chapter num={8} titleKey="about.founder.chapter8.title">
            <p>
              <CmsText cmsKey="about.founder.chapter8.p1" />
            </p>
            <p>
              <CmsText cmsKey="about.founder.chapter8.p2" />
            </p>
            <p className="font-semibold text-stone-900">
              <CmsText cmsKey="about.founder.chapter8.p3" />
            </p>
          </Chapter>

          {/* ───── CLOSING CTA ─────
              Primary "התחילו את המסע שלכם" routes to /journey by
              request — after a 7-minute personal-letter read, the
              reader is in the highest emotional-readiness state of the
              funnel and the right move is to drop them into the most
              committed product (Journey) rather than the homepage. */}
          <div className="mt-16 rounded-[28px] border border-rose-200/60 bg-gradient-to-br from-rose-50 to-amber-50 px-7 py-10 text-center sm:mt-20 sm:px-10 sm:py-12">
            <Sparkles className="mx-auto h-5 w-5 text-rose-500" />
            <CmsText
              cmsKey="about.founder.cta.title"
              as="h2"
              className="mx-auto mt-4 max-w-[440px] text-[26px] leading-[1.2] text-stone-900 sm:text-[32px]"
              style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
            />
            <CmsText
              cmsKey="about.founder.cta.body"
              as="p"
              className="mx-auto mt-4 max-w-[420px] text-[15px] leading-[1.6] text-stone-700"
              style={{ fontFamily: BODY_FONT }}
            />
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/journey"
                className="group relative inline-flex min-h-[52px] items-center gap-2 overflow-hidden rounded-full px-8 text-[15px] font-semibold text-white shadow-2xl shadow-rose-500/30 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)]"
                />
                <span className="relative z-10 inline-flex items-center gap-2">
                  <CmsText cmsKey="about.founder.cta.button" />
                  <Arrow className="h-4 w-4 transition group-hover:-translate-x-1" />
                </span>
              </Link>
            </div>
          </div>

          {/* Footer note — soft sign-off, the equivalent of "yours,
              Itzik" at the bottom of a long letter. whitespace-pre-line
              preserves the line break baked into the CMS value. */}
          <CmsText
            cmsKey="about.founder.footer.signoff"
            as="p"
            className="mt-12 whitespace-pre-line text-center text-[13px] italic text-stone-500"
            style={{ fontFamily: SERIF_FONT }}
          />
        </main>
      </article>
    </CmsTextProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponents — kept inline so the page reads top-to-bottom as a
// story.
// ─────────────────────────────────────────────────────────────────────

/**
 * Chapter — numbered section with a serif title. The number is set in
 * italic-serif rose, the title in a heavier serif, and there's a thin
 * horizontal rule between chapters so the reader's eye gets a beat to
 * breathe between sections.
 */
function Chapter({
  num,
  titleKey,
  children,
}: {
  num: number;
  titleKey: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0 sm:mt-16">
      {/* Chapter divider — only show above non-first chapters; the
          first chapter sits directly under the hero pull-quote. */}
      {num > 1 ? (
        <div
          aria-hidden
          className="mx-auto mb-12 h-px w-24 bg-gradient-to-r from-transparent via-rose-300/70 to-transparent sm:mb-14"
        />
      ) : null}

      <div className="mb-6 flex items-baseline gap-3">
        <span
          className="text-[28px] leading-none text-rose-500/80 sm:text-[32px]"
          style={{
            fontFamily: SERIF_FONT,
            fontStyle: "italic",
            fontWeight: 500,
          }}
          aria-hidden
        >
          {String(num).padStart(2, "0")}
        </span>
        <CmsText
          cmsKey={titleKey}
          as="h2"
          className="text-[26px] leading-[1.2] tracking-tight text-stone-900 sm:text-[32px]"
          style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
        />
      </div>

      <div
        className="space-y-5 text-[17px] leading-[1.78] text-stone-800 sm:text-[18px]"
        style={{ fontFamily: BODY_FONT }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Lede — the first paragraph of a chapter, slightly heavier weight + a
 * touch larger than body. Editorial convention; signals "this is the
 * opening claim of the section, lean in".
 */
function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[19px] font-medium leading-[1.7] text-stone-900 sm:text-[20px]">
      {children}
    </p>
  );
}

/**
 * PullQuote — interrupts the flow at a key emotional beat. Larger,
 * italic, serif, indented from the body so the eye knows it's not
 * regular text.
 */
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="my-8 border-s-[3px] border-rose-400/70 ps-5 text-[22px] leading-[1.4] text-stone-900 sm:my-10 sm:text-[26px]"
      style={{ fontFamily: SERIF_FONT, fontStyle: "italic", fontWeight: 500 }}
    >
      {children}
    </blockquote>
  );
}

/**
 * EtymologyRow — used inside the naming chapter to break down the
 * Italian roots of "Mioshy". Two columns: the Italian word large in
 * serif on one side, the Hebrew meaning in body sans on the other.
 */
function EtymologyRow({
  italianKey,
  meaningKey,
  emphasized,
}: {
  italianKey: string;
  meaningKey: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <CmsText
        cmsKey={italianKey}
        as="span"
        className={`${
          emphasized ? "text-[28px] sm:text-[34px]" : "text-[24px] sm:text-[28px]"
        } leading-none text-stone-900`}
        style={{
          fontFamily: SERIF_FONT,
          fontStyle: "italic",
          fontWeight: emphasized ? 700 : 500,
        }}
      />
      <CmsText
        cmsKey={meaningKey}
        as="span"
        className={`text-[14px] text-stone-700 sm:text-[15px] ${
          emphasized ? "font-semibold text-stone-900" : ""
        }`}
        style={{ fontFamily: BODY_FONT }}
      />
    </div>
  );
}
