import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * JourneyStages - "Where are you on the journey?" three-stage chooser.
 *
 * Sits on HomepageV2 directly under <Pricing /> per Itzik 2026-05-06.
 * The intent: after the visitor has seen the price grid, frame the same
 * three products as a self-selection - "where are YOU right now?" -
 * with hooks instead of features. This makes a couple who isn't sure
 * which plan fits their readiness pick a stage instead of comparing
 * features.
 *
 * Stages:
 *   1. Casual / "just want to talk differently" → /games (₪9/wk)
 *   2. Brave / "ready for the bedroom too"      → /adults (₪97/game)
 *   3. Guided / "want someone to lead"          → /journey (₪57/wk)
 *
 * Visual language matches the rest of v2: serif headline, accent dots,
 * cream tone via parent wrapper, accent line connectors between stages
 * on desktop. All copy comes from `homeV2.journeyStages` so HE/EN stay
 * in lockstep.
 */
type StageId = "1" | "2" | "3";

const STAGE_HREFS: Record<StageId, "/games" | "/adults" | "/journey"> = {
  "1": "/games",
  "2": "/adults",
  "3": "/journey",
};

export function JourneyStages() {
  const t = useTranslations("homeV2.journeyStages");

  const stages: Array<{
    id: StageId;
    label: string;
    hook: string;
    desc: string;
    product: string;
    price: string;
    period: string;
    tag: string;
    cta: string;
  }> = (["1", "2", "3"] as const).map((id) => ({
    id,
    label: t(`stage${id}Label`),
    hook: t(`stage${id}Hook`),
    desc: t(`stage${id}Desc`),
    product: t(`stage${id}Product`),
    price: t(`stage${id}Price`),
    period: t(`stage${id}Period`),
    tag: t(`stage${id}Tag`),
    cta: t(`stage${id}Cta`),
  }));

  return (
    <section className="journey-stages" id="journey-stages">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("headline")}</h2>
          <p>{t("description")}</p>
        </div>

        <ol className="js-stages">
          {stages.map((stage, idx) => (
            <li
              key={stage.id}
              className={`js-stage js-stage-${stage.id}`}
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              {/* Stage number badge */}
              <div className="js-stage-num" aria-hidden>
                {stage.id}
              </div>

              {/* Tag chip - "Start here" / "When you're ready" / "The comprehensive path" */}
              <span className="js-stage-tag">{stage.tag}</span>

              {/* Stage label (small uppercase) */}
              <div className="js-stage-label">{stage.label}</div>

              {/* Hook - the emotional headline */}
              <h3 className="js-stage-hook">{stage.hook}</h3>

              {/* Description (longer text) */}
              <p className="js-stage-desc">{stage.desc}</p>

              {/* Product + price block */}
              <div className="js-stage-product">
                <div className="js-stage-product-name">{stage.product}</div>
                <div className="js-stage-price">
                  <span className="js-stage-price-amount">{stage.price}</span>
                  <span className="js-stage-price-period">{stage.period}</span>
                </div>
              </div>

              {/* CTA */}
              <Link
                href={STAGE_HREFS[stage.id]}
                className="js-stage-cta"
              >
                {stage.cta}
                <span aria-hidden className="arrow">←</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* Local styles - scoped to .journey-stages so the wine palette
          and serif headlines don't leak into other v2 sections. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .journey-stages{
              padding:96px 0 80px;
              background:linear-gradient(180deg,#FFF9FB 0%,#F8EEEC 60%,#FFF9FB 100%);
              position:relative;
              overflow:hidden;
            }
            .journey-stages::before{
              content:"";
              position:absolute;inset:0;
              background:
                radial-gradient(700px 380px at 12% 18%, rgba(184,60,77,0.08), transparent 60%),
                radial-gradient(700px 380px at 88% 82%, rgba(61,31,61,0.08), transparent 60%);
              pointer-events:none;
            }
            .journey-stages .container{position:relative}
            .journey-stages .section-head{
              text-align:center;
              max-width:680px;
              margin:0 auto 56px;
            }
            .journey-stages .eyebrow{
              display:inline-flex;align-items:center;gap:10px;
              font-size:13px;font-weight:600;letter-spacing:0.2em;
              text-transform:uppercase;color:#170E14;
              margin-bottom:14px;
            }
            .journey-stages .eyebrow::before{
              content:"";width:7px;height:7px;border-radius:1px;
              background:#B83C4D;box-shadow:0 0 0 3px rgba(184,60,77,0.18);
            }
            .journey-stages h2{
              font-family:'Frank Ruhl Libre',serif;
              font-size:clamp(32px,4vw,52px);
              line-height:1.08;letter-spacing:-0.02em;
              color:#170E14;font-weight:600;margin-bottom:18px;
            }
            .journey-stages .section-head p{
              font-size:18px;line-height:1.6;color:#4A3A45;
              max-width:560px;margin:0 auto;
            }

            /* The 3-card lane - desktop horizontal, mobile stacked. */
            .js-stages{
              list-style:none;padding:0;margin:0;
              display:grid;gap:24px;
              grid-template-columns:1fr;
            }
            @media (min-width:900px){
              .js-stages{
                grid-template-columns:repeat(3,1fr);
                gap:32px;
                position:relative;
              }
              /* Connector line between stages - soft hairline that
                 communicates progression. RTL flips automatically. */
              .js-stages::before{
                content:"";
                position:absolute;
                top:48px;left:8%;right:8%;height:2px;
                background:linear-gradient(90deg,
                  rgba(184,60,77,0) 0%,
                  rgba(184,60,77,0.35) 20%,
                  rgba(184,60,77,0.35) 80%,
                  rgba(184,60,77,0) 100%);
                z-index:0;
              }
            }

            .js-stage{
              position:relative;
              background:#FFFFFF;
              border:1px solid #EAE0E3;
              border-radius:24px;
              padding:32px 28px 28px;
              display:flex;flex-direction:column;
              box-shadow:0 12px 32px -16px rgba(74,23,33,0.18);
              transition:transform .4s cubic-bezier(.22,.61,.36,1),
                         box-shadow .4s cubic-bezier(.22,.61,.36,1),
                         border-color .4s;
              z-index:1;
            }
            .js-stage:hover{
              transform:translateY(-4px);
              border-color:rgba(184,60,77,0.3);
              box-shadow:0 28px 56px -20px rgba(74,23,33,0.22);
            }

            /* Stage number medallion at the top - sits on the connector
               line and reads as a "stop along the way". */
            .js-stage-num{
              position:absolute;
              top:-22px;
              inset-inline-start:50%;
              transform:translateX(-50%);
              width:48px;height:48px;
              border-radius:50%;
              background:linear-gradient(135deg,#B83C4D 0%,#8B2638 100%);
              color:#fff;
              font-family:'Frank Ruhl Libre',serif;
              font-size:22px;font-weight:700;
              display:grid;place-items:center;
              box-shadow:0 8px 20px rgba(184,60,77,0.35);
              z-index:2;
            }
            [dir="rtl"] .js-stage-num{transform:translateX(50%)}

            .js-stage-tag{
              align-self:flex-start;
              margin-top:18px;
              padding:5px 12px;
              border-radius:999px;
              background:rgba(184,60,77,0.10);
              border:1px solid rgba(184,60,77,0.25);
              color:#8B2638;
              font-size:12px;font-weight:600;
              letter-spacing:0.04em;
            }

            .js-stage-label{
              margin-top:14px;
              font-size:11px;font-weight:600;letter-spacing:0.22em;
              text-transform:uppercase;color:#7A6A75;
            }

            .js-stage-hook{
              font-family:'Frank Ruhl Libre',serif;
              font-size:24px;line-height:1.18;
              color:#170E14;font-weight:600;
              margin:8px 0 12px;
            }

            .js-stage-desc{
              font-size:15px;line-height:1.6;color:#4A3A45;
              margin-bottom:24px;flex-grow:1;
            }

            .js-stage-product{
              padding-top:18px;
              border-top:1px solid #EAE0E3;
              margin-bottom:18px;
            }
            .js-stage-product-name{
              font-size:14px;font-weight:600;color:#170E14;
              margin-bottom:6px;
            }
            .js-stage-price{
              display:flex;align-items:baseline;gap:6px;
            }
            .js-stage-price-amount{
              font-family:'Frank Ruhl Libre',serif;
              font-size:32px;font-weight:700;color:#B83C4D;
              line-height:1;
            }
            .js-stage-price-period{
              font-size:13px;color:#7A6A75;font-weight:500;
            }

            .js-stage-cta{
              display:inline-flex;align-items:center;gap:8px;
              padding:12px 22px;border-radius:999px;
              background:#170E14;color:#fff;
              font-size:14px;font-weight:600;
              text-decoration:none;
              transition:background .25s,transform .25s;
              align-self:flex-start;
            }
            .js-stage-cta:hover{
              background:#B83C4D;
              transform:translateX(-2px);
            }
            [dir="rtl"] .js-stage-cta:hover{transform:translateX(2px)}
            .js-stage-cta .arrow{
              display:inline-block;
              transition:transform .25s;
            }
            .js-stage-cta:hover .arrow{
              transform:translateX(-3px);
            }
            [dir="rtl"] .js-stage-cta:hover .arrow{transform:translateX(3px)}

            /* Stage 2 (the brave) - wine accent on the medallion to set
               it apart from the other two stages. */
            .js-stage-2 .js-stage-num{
              background:linear-gradient(135deg,#8B2638 0%,#3D1F3D 100%);
            }
            /* Stage 3 (coaching) - purple-deep medallion. */
            .js-stage-3 .js-stage-num{
              background:linear-gradient(135deg,#3D1F3D 0%,#1E0F1E 100%);
            }

            @media (max-width:640px){
              .journey-stages{padding:72px 0 60px}
              .journey-stages .section-head{margin-bottom:48px}
              .js-stage{padding:28px 22px 22px}
              .js-stage-num{width:44px;height:44px;font-size:20px;top:-20px}
              .js-stage-hook{font-size:21px}
              .js-stage-desc{font-size:15px}
            }
          `,
        }}
      />
    </section>
  );
}
