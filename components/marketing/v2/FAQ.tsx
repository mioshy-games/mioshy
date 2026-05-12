"use client";

import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FAQ - accordion section. Uses native <details> for open/close behavior
 * (no JS needed). First item is open by default.
 *
 * CMS-migrated (Sprint 1). Question text is plain (rendered via
 * useCmsText().text); answer text carries <p>/<strong>/<em> markup
 * and is rendered via <CmsText> (dangerouslySetInnerHTML).
 */
export function FAQ() {
  // Section-level keys
  const eyebrow = useCmsText("homeV2.faq.eyebrow");
  const description = useCmsText("homeV2.faq.description");
  const contactCta = useCmsText("homeV2.faq.contactCta");

  // 11 FAQ entries — index 0 is open by default.
  const FAQS = [
    { qKey: "item1Q", aKey: "item1A", defaultOpen: true },
    { qKey: "item2Q", aKey: "item2A", defaultOpen: false },
    { qKey: "item3Q", aKey: "item3A", defaultOpen: false },
    { qKey: "item4Q", aKey: "item4A", defaultOpen: false },
    { qKey: "item5Q", aKey: "item5A", defaultOpen: false },
    { qKey: "item6Q", aKey: "item6A", defaultOpen: false },
    { qKey: "item7Q", aKey: "item7A", defaultOpen: false },
    { qKey: "item8Q", aKey: "item8A", defaultOpen: false },
    { qKey: "item9Q", aKey: "item9A", defaultOpen: false },
    { qKey: "item10Q", aKey: "item10A", defaultOpen: false },
    { qKey: "item11Q", aKey: "item11A", defaultOpen: false },
  ] as const;

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="faq-grid">
          <div className="faq-side">
            <div className="eyebrow" style={eyebrow.style}>
              {eyebrow.text}
            </div>
            {/* headline contains <br> */}
            <CmsText cmsKey="homeV2.faq.headline" as="h2" />
            <p style={description.style}>{description.text}</p>
            <Link href="/contact" className="btn btn-ghost">
              {contactCta.text} <span className="arrow">←</span>
            </Link>
          </div>

          <div className="faq-list">
            {FAQS.map((item, i) => (
              <FaqRow
                key={i}
                qKey={`homeV2.faq.${item.qKey}`}
                aKey={`homeV2.faq.${item.aKey}`}
                defaultOpen={item.defaultOpen}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Per-item row. Lifted into its own component so each FAQ entry has a
 * stable hook order — useCmsText fires unconditionally per render and
 * the iteration count is fixed (11 rows). Question is plain text;
 * answer carries <p>/<strong>/<em> markup so it renders via CmsText.
 */
function FaqRow({
  qKey,
  aKey,
  defaultOpen,
}: {
  qKey: string;
  aKey: string;
  defaultOpen: boolean;
}) {
  const q = useCmsText(qKey);
  return (
    <details className="faq-item" open={defaultOpen}>
      <summary style={q.style}>
        {q.text} <span className="faq-icon">+</span>
      </summary>
      <CmsText cmsKey={aKey} as="div" className="faq-answer" />
    </details>
  );
}
