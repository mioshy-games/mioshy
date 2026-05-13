"use client";

import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FAQ — accordion section. Question = plain key; answer = rich
 * (contains <p>, sometimes <em> / <strong>). Both render through
 * <CmsText>; CmsText switches mode based on the row's is_rich.
 */
export function FAQ() {
  // 11 entries — first is open by default.
  const FAQS = Array.from({ length: 11 }, (_, i) => ({
    n: i + 1,
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
              <CmsText cmsKey="homeV2.faq.contactCta" />{" "}
              <span className="arrow">←</span>
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
