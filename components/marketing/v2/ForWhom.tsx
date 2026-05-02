import { useTranslations } from "next-intl";
import { TrackedLink } from "./TrackedLink";

/**
 * ForWhom - 6 personas grid. Each card is a clickable link to the matching
 * service section. CTA banner below points to the assessment quiz.
 */
export function ForWhom() {
  const t = useTranslations("homeV2.forWhom");

  const PERSONAS = [
    {
      icon: "✦",
      title: t("persona1Title"),
      desc: t("persona1Desc"),
      linkLabel: t("persona1Link"),
      href: "#journey",
    },
    {
      icon: "⌛",
      title: t("persona2Title"),
      desc: t("persona2Desc"),
      linkLabel: t("persona2Link"),
      href: "#journey",
    },
    {
      icon: "◆",
      title: t("persona3Title"),
      desc: t("persona3Desc"),
      linkLabel: t("persona3Link"),
      href: "#journey",
    },
    {
      icon: "↻",
      title: t("persona4Title"),
      desc: t("persona4Desc"),
      linkLabel: t("persona4Link"),
      href: "#couples-games",
    },
    {
      icon: "★",
      title: t("persona5Title"),
      desc: t("persona5Desc"),
      linkLabel: t("persona5Link"),
      href: "#couples-games",
    },
    {
      icon: "♨",
      title: t("persona6Title"),
      desc: t("persona6Desc"),
      linkLabel: t("persona6Link"),
      href: "#adult-games",
    },
  ];

  return (
    <section className="for-whom" id="for-whom">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>
            {t("headlinePart1")}
            <br />
            {t("headlinePart2")}
            <em
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                color: "var(--accent)",
                fontStyle: "italic",
              }}
            >
              {t("headlineEm")}
            </em>
          </h2>
          <p>{t("description")}</p>
        </div>

        <div className="personas-grid">
          {PERSONAS.map((p) => (
            <a key={p.title} href={p.href} className="persona">
              <div className="persona-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <span className="persona-link">
                {p.linkLabel} <span>←</span>
              </span>
            </a>
          ))}
        </div>

        <div className="for-whom-cta">
          <div className="for-whom-cta-text">
            <span className="small">{t("ctaSmall")}</span>
            <span className="big">{t("ctaBig")}</span>
          </div>
          <TrackedLink href="/journey/assessment" className="btn btn-primary" ctaId="for_whom_assessment" section="for-whom">
            {t("cta")} <span className="arrow">←</span>
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
