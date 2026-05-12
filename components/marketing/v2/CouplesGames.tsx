import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * CouplesGames - energetic two-column section with text content on the right
 * (RTL) and a fanned stack of 3 game cards on the left.
 */
export function CouplesGames() {
  const t = useTranslations("homeV2.couplesGames");
  return (
    <section className="couples-games" id="couples-games">
      <div className="container">
        <div className="cg-grid">
          <div className="cg-text">
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>
              {t("headlinePart1")}
              <br />
              <span className="text-mark">{t("headlineMark")}</span>
              {t("headlinePart2")}
            </h2>
            <p className="lead">{t("lead")}</p>

            <div className="cg-callout">
              <p>{t("callout")}</p>
            </div>

            <div className="cg-stats">
              <div className="cg-stat">
                <div className="num">{t("statTasks")}</div>
                <div className="label">{t("statTasksLabel")}</div>
              </div>
              <div className="cg-stat">
                <div className="num">{t("statRecs")}</div>
                <div className="label">{t("statRecsLabel")}</div>
              </div>
              <div className="cg-stat">
                <div className="num">{t("statLevels")}</div>
                <div className="label">{t("statLevelsLabel")}</div>
              </div>
            </div>

            <div className="cg-actions">
              <Link href="/games" className="btn btn-primary">
                {t("ctaPrimary")}
              </Link>
            </div>
          </div>

          <div className="cg-visual">
            <div className="cg-card cg-card-3">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">{t("card3Tag")}</div>
                <div className="cg-card-title">
                  {t("card3TitleLine1")}
                  <br />
                  {t("card3TitleLine2")}
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-2">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">{t("card2Tag")}</div>
                <div className="cg-card-title">
                  {t("card2TitleLine1")}
                  <br />
                  {t("card2TitleLine2")}
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-1">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">{t("card1Tag")}</div>
                <div className="cg-card-title">
                  {t("card1TitleLine1")}
                  <br />
                  {t("card1TitleLine2")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
