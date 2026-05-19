"use client";

import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FAQ — accordion section. Question = plain key; answer = rich
 * (contains <p>, sometimes <em> / <strong>). Both render through
 * <CmsText>; CmsText switches mode based on the row's is_rich.
 */
export function FAQ() {
  // Source has 11 questions in messages/*.json (item1..11). 2026-05-19
  // Itzik dropped item8 ("ליווי צמוד עם המומחים - באמת הכל כלול?") and
  // item11 ("למי בדיוק התוכן מתאים?") from the homepage FAQ. The CMS
  // keys for those entries are intentionally retained on disk so the
  // questions can be re-introduced cleanly. First visible entry stays
  // open by default.
  const VISIBLE_FAQ_NUMS = [1, 2, 3, 4, 5, 6, 7, 9, 10] as const;
  const FAQS = VISIBLE_FAQ_NUMS.map((n, i) => ({
    n,
    defaultOpen: i === 0,
  }));

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="faq-grid">
          <div className="faq-side">
            <CmsText cmsKey="homeV2.faq.eyebrow" as="div" className="eyebrow" />
            <CmsText cmsKey="homeV2.faq.headline" as="h2" />
            <CmsText cmsKey="homeV2.faq.description" as="p" />
            <Link href="/contact" className="btn btn-ghost">
              <CmsText cmsKey="homeV2.faq.contactCta" />
            </Link>
          </div>

          <div className="faq-list">
            {FAQS.map((item) => (
              <details className="faq-item" key={item.n} open={item.defaultOpen}>
                <summary>
                  <CmsText cmsKey={`homeV2.faq.item${item.n}Q`} />{" "}
                  <span className="faq-icon">+</span>
                </summary>
                <CmsText
                  cmsKey={`homeV2.faq.item${item.n}A`}
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
