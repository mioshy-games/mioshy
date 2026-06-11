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
import "./styles.css";
import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FAQ — accordion section. Question = plain key; answer = rich
 * (contains <p>, sometimes <em> / <strong>). Both render through
 * <CmsText>; CmsText switches mode based on the row's is_rich.
 *
 * 2026-05-20 — generalised so both the homepage and /games can use the
 * same component. Pass `cmsKeyPrefix` to swap the CMS namespace and
 * `numbers` to control which item indices render.
 *
 * The default values reproduce the homepage's behaviour exactly so
 * existing callers (HomepageV2.tsx mounts `<FAQ />` with no props)
 * keep working without changes.
 */
type FAQProps = {
  /**
   * CMS key namespace for the FAQ rows. Each item is read at
   * `${cmsKeyPrefix}.item{N}Q` and `${cmsKeyPrefix}.item{N}A`.
   * The header keys live at `${cmsKeyPrefix}.{eyebrow,headline,
   * description,contactCta}`. Defaults to "homeV2.faq".
   */
  cmsKeyPrefix?: string;
  /**
   * Which numeric indices to render. Homepage skips a couple of
   * historical items by passing a sparse list; /games passes
   * [1..8]. Defaults to the homepage's visible set.
   */
  numbers?: readonly number[];
  /**
   * Anchor id on the section. Multiple FAQ instances would clash on
   * the same page if both used `#faq`; not an issue today but the
   * prop is here to future-proof. Defaults to "faq".
   */
  anchorId?: string;
};

const HOMEPAGE_DEFAULT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 9, 10] as const;

export function FAQ({
  cmsKeyPrefix = "homeV2.faq",
  numbers = HOMEPAGE_DEFAULT_NUMBERS,
  anchorId = "faq",
}: FAQProps = {}) {
  const FAQS = numbers.map((n, i) => ({
    n,
    defaultOpen: i === 0,
  }));

  return (
    <section className="faq" id={anchorId}>
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
                  <CmsText cmsKey={`${cmsKeyPrefix}.item${item.n}Q`} />{" "}
                  <span className="faq-icon">+</span>
                </summary>
                <CmsText
                  cmsKey={`${cmsKeyPrefix}.item${item.n}A`}
                  as="div"
                  className="faq-answer"
                />
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
