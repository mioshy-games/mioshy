import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * Journey - editorial timeline of 4 stages. Connecting hairline line through
 * all 4 numbers, each stage with its own checklist of features. Closing CTA
 * banner at the bottom.
 */
export function Journey() {
  const t = useTranslations("homeV2.journey");

  const STAGES = [
    {
      num: "01",
      title: t("stage1Title"),
      description: t("stage1Description"),
      bullets: [t("stage1Bullet1"), t("stage1Bullet2"), t("stage1Bullet3")],
    },
    {
      num: "02",
      title: t("stage2Title"),
      description: t("stage2Description"),
      bullets: [t("stage2Bullet1"), t("stage2Bullet2"), t("stage2Bullet3")],
    },
    {
      num: "03",
      title: t("stage3Title"),
      description: t("stage3Description"),
      bullets: [t("stage3Bullet1"), t("stage3Bullet2"), t("stage3Bullet3")],
    },
    {
      num: "04",
      title: t("stage4Title"),
      description: t("stage4Description"),
      bullets: [t("stage4Bullet1"), t("stage4Bullet2"), t("stage4Bullet3")],
    },
  ];

  return (
    <section className="journey" id="journey">
      <div className="container">
        <div className="section-head journey-head">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>
            {t.rich("headline", {
              /* `display:inline` overrides the global
                 `h1 em, h2 em { display: block }` rule in styles.css.
                 Without this, "מתחזקת." would land on a 3rd line
                 below "הזוגיות שלכם" — but the line break we WANT is
                 already provided by the <br>, so the em should sit
                 inline on the same line as "הזוגיות שלכם". Same
                 pattern as Authority.tsx. */
              em: (chunks) => <em style={{ display: "inline" }}>{chunks}</em>,
              br: () => <br />,
            })}
          </h2>
          <p>{t("description")}</p>
        </div>

        <div className="journey-timeline">
          <div className="journey-line"></div>
          <div className="journey-stages">
            {STAGES.map((stage) => (
              <div className="journey-stage" key={stage.num}>
                <div className="journey-num-wrap">
                  <div className="journey-num">
                    {stage.num}
                    <span className="dot">.</span>
                  </div>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                <ul className="journey-list">
                  {stage.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="journey-cta">
          <div className="journey-cta-text">{t("ctaText")}</div>
          <Link href="/journey/assessment" className="btn btn-primary">
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
