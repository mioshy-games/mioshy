// PERF 2026-05-21 — FAQ is a pure-structural component: it renders
// native <details> for the accordion (zero JS needed for open/close)
// and <CmsText> for every editable string. CmsText itself stays a
// client island, but FAQ no longer needs its own client chunk + its
// own hydration. Removed "use client" → FAQ is now a Server Component.
// 2026-06-09 — self-import the v2 stylesheet so the FAQ is styled
// wherever it's mounted. On the homepage styles.css loads via other
// v2 sections, but on /games no other component pulled it in, so the
// FAQ rendered unstyled. CSS imports are de-duped by Next.js, so this
// is a no-op on pages that already load styles.css.
// 2026-06-18 (AI-readiness P0) — FAQ is now async: it resolves the same
// CMS Q/A keys server-side to emit FAQPage JSON-LD, and wraps each question
// in an <h3> inside the (kept) native <summary>. Every caller is a server
// component, so an async child is safe.
import "./styles.css";
import { getLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { faqPageJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import type { CmsPage } from "@/lib/cms/types";

/**
 * FAQ — accordion section. Question = plain key; answer = rich
 * (contains <p>, sometimes <em> / <strong>). Both render through
 * <CmsText>; CmsText switches mode based on the row's is_rich.
 */
type FAQProps = {
  /** CMS key namespace; each item is `${cmsKeyPrefix}.item{N}Q/A`. */
  cmsKeyPrefix?: string;
  /** Which numeric indices to render. */
  numbers?: readonly number[];
  /** Anchor id on the section. */
  anchorId?: string;
  /**
   * CMS `page` the rows live on — needed to resolve the Q/A server-side for
   * the FAQPage JSON-LD. homepage="homepage", /games="games",
   * /mioshy-sex="mioshy-sex". Defaults to "homepage".
   */
  cmsPage?: CmsPage;
  /** Live values substituted into `{token}` placeholders in the Q/A copy
   *  (both the rendered answer and the JSON-LD). E.g. vars={{N: 12}}. */
  vars?: Record<string, string | number>;
};

/** Substitute {token} placeholders — mirrors CmsText's `vars` so the rendered
 *  answer and the schema text stay in sync. */
function applyVars(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return Object.keys(vars).reduce(
    (acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])),
    s,
  );
}

const HOMEPAGE_DEFAULT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 9, 10] as const;

/**
 * Strip HTML tags and decode the common entities so the FAQPage JSON-LD
 * answer text is clean machine-readable plain text (the rendered answer keeps
 * its rich markup via <CmsText>).
 */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function FAQ({
  cmsKeyPrefix = "homeV2.faq",
  numbers = HOMEPAGE_DEFAULT_NUMBERS,
  anchorId = "faq",
  cmsPage = "homepage",
  vars,
}: FAQProps = {}) {
  const FAQS = numbers.map((n, i) => ({ n, defaultOpen: i === 0 }));

  // ── FAQPage JSON-LD (AI-readiness P0) ─────────────────────────────────────
  // Resolve the same Q/A keys the section renders, clean to plain text, and
  // drop any item whose Q or A is missing/blank (so the schema never carries
  // empty entries or raw key strings).
  const locale = (await getLocale()) as "he" | "en";
  const t = await getCmsTranslations({ locale, namespace: cmsKeyPrefix, page: cmsPage });
  const faqItems = numbers
    .map((n) => ({ n, q: t(`item${n}Q`), a: t(`item${n}A`) }))
    .filter(({ n, q, a }) => q && a && q !== `item${n}Q` && a !== `item${n}A`)
    .map(({ q, a }) => ({
      question: stripHtml(applyVars(q, vars)),
      answer: stripHtml(applyVars(a, vars)),
    }))
    .filter((it) => it.question.length > 0 && it.answer.length > 0);

  return (
    <section className="faq" id={anchorId}>
      {faqItems.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faqItems)) }}
        />
      ) : null}
      <div className="container">
        <div className="faq-grid">
          <div className="faq-side">
            <CmsText cmsKey={`${cmsKeyPrefix}.eyebrow`} as="div" className="eyebrow" />
            <CmsText cmsKey={`${cmsKeyPrefix}.headline`} as="h2" />
            <CmsText cmsKey={`${cmsKeyPrefix}.description`} as="p" />
            <Link href="/contact" className="btn btn-ghost">
              <CmsText cmsKey={`${cmsKeyPrefix}.contactCta`} />
            </Link>
          </div>

          <div className="faq-list">
            {FAQS.map((item) => (
              <details className="faq-item" key={item.n} open={item.defaultOpen}>
                <summary>
                  {/* AI-readiness P0: question is an <h3> (after the section's
                      <h2> — no level skip, WCAG 1.3.1). The native <details>/
                      <summary> disclosure is kept exactly as-is. */}
                  <h3 className="faq-q">
                    <CmsText cmsKey={`${cmsKeyPrefix}.item${item.n}Q`} />
                  </h3>
                  <span className="faq-icon">+</span>
                </summary>
                <CmsText
                  cmsKey={`${cmsKeyPrefix}.item${item.n}A`}
                  as="div"
                  className="faq-answer"
                  vars={vars}
                />
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
