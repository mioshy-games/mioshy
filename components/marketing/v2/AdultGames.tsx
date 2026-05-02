// Side-effect import: ensures the v2 scoped styles are loaded whenever
// AdultGames is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * AdultGames - "The private chamber". Premium private-chamber section with midnight
 * wine + bronze palette, 3 manifesto pillars, signature whisper, and dramatic
 * closer CTA.
 */
export function AdultGames() {
  const t = useTranslations("homeV2.adultGames");
  return (
    <section className="adult-games" id="adult-games">
      <span className="ag-aura ag-aura-1" aria-hidden="true"></span>
      <span className="ag-aura ag-aura-2" aria-hidden="true"></span>

      <div className="ag-frame">
        <div className="ag-stage">
          <div className="ag-pills">
            <span className="ag-pill">{t("pill1")}</span>
            <span className="ag-pill">{t("pill2")}</span>
            <span className="ag-pill">{t("pill3")}</span>
          </div>

          <span className="ag-eyebrow">{t("eyebrow")}</span>

          <h2>
            {t.rich("headline", {
              em: (chunks) => <em>{chunks}</em>,
              br: () => <br />,
            })}
          </h2>

          <p className="ag-lead">
            {t.rich("lead", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>

          <div className="ag-pillars">
            <article className="ag-pillar">
              <span className="ag-pillar-num">I</span>
              <h4>{t("pillar1Title")}</h4>
              <p>{t("pillar1Body")}</p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">II</span>
              <h4>{t("pillar2Title")}</h4>
              <p>{t("pillar2Body")}</p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">III</span>
              <h4>{t("pillar3Title")}</h4>
              <p>{t("pillar3Body")}</p>
            </article>
          </div>

          <div className="ag-signature">
            <span className="ag-signature-line" aria-hidden="true"></span>
            <em>{t("signature")}</em>
            <span className="ag-signature-line" aria-hidden="true"></span>
          </div>

          <div className="ag-closer">
            <h3 className="ag-closer-statement">
              {t.rich("closer", {
                em: (chunks) => <em>{chunks}</em>,
                br: () => <br />,
              })}
            </h3>
            <Link href="/adults" className="ag-closer-cta">
              {t("cta")}
            </Link>
            <div className="ag-closer-trust">
              <span>{t("trust1")}</span>
              <span>{t("trust2")}</span>
              <span>{t("trust3")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
