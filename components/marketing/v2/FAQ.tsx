import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * FAQ - accordion section. Uses native <details> for open/close behavior
 * (no JS needed). First item is open by default.
 */
export function FAQ() {
  const t = useTranslations("homeV2.faq");

  // 11 FAQ entries; only the first is open by default.
  const FAQS = [
    { qKey: "item1Q", aKey: "item1A", defaultOpen: true },
    { qKey: "item2Q", aKey: "item2A" },
    { qKey: "item3Q", aKey: "item3A" },
    { qKey: "item4Q", aKey: "item4A" },
    { qKey: "item5Q", aKey: "item5A" },
    { qKey: "item6Q", aKey: "item6A" },
    { qKey: "item7Q", aKey: "item7A" },
    { qKey: "item8Q", aKey: "item8A" },
    { qKey: "item9Q", aKey: "item9A" },
    { qKey: "item10Q", aKey: "item10A" },
    { qKey: "item11Q", aKey: "item11A" },
  ] as const;

  // Rich-text tag map shared across all FAQ answers.
  const richTags = {
    p: (chunks: React.ReactNode) => <p>{chunks}</p>,
    strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
    em: (chunks: React.ReactNode) => <em>{chunks}</em>,
  };

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="faq-grid">
          <div className="faq-side">
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>
              {t.rich("headline", { br: () => <br /> })}
            </h2>
            <p>{t("description")}</p>
            <Link href="/contact" className="btn btn-ghost">
              {t("contactCta")} <span className="arrow">←</span>
            </Link>
          </div>

          <div className="faq-list">
            {FAQS.map((item, i) => (
              <details className="faq-item" key={i} open={item.defaultOpen}>
                <summary>
                  {t(item.qKey)} <span className="faq-icon">+</span>
                </summary>
                <div className="faq-answer">
                  {t.rich(item.aKey, richTags)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
