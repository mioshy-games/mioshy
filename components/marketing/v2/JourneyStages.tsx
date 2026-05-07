"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

/**
 * JourneyStages — "What are you in the mood for tonight?"
 * ────────────────────────────────────────────────────────
 * A mood-picker that replaces the old 3-step stage chooser. Per Itzik
 * 2026-05-06, the previous "stages" framing read as feature-comparison
 * — we want it to read as **self-categorization in the moment**: the
 * user picks a vibe ("I want us to laugh", "I'm in the mood to be
 * bold", "I want someone to guide us") and the matching product
 * surfaces with its price and CTA.
 *
 * Design choices and the reasoning behind them:
 *
 *   • Three moods, three products — same trio as before (games / sex /
 *     journey), but the framing flips from "where are you on a journey"
 *     to "what's your vibe right now". This lowers commitment anxiety:
 *     a vibe is temporary, a "stage" sounds permanent.
 *
 *   • Mobile = horizontal snap-scroll. The user swipes between cards
 *     with one thumb. Each card takes ~85% of the viewport width so
 *     the next card peeks into view, signalling there's more without
 *     a "Next →" affordance. Dot-indicators below show position.
 *     This is the same pattern Spotify, Instagram, and Netflix use for
 *     mood-based content — familiar = no learning curve.
 *
 *   • Desktop = 3 cards side-by-side. Each card responds to the mouse
 *     position with a gentle tilt (CSS transform, no JS animation
 *     loop) — depth illusion that makes them feel tangible rather
 *     than flat. Selected/hovered card brightens its gradient.
 *
 *   • Each mood has its own gradient (rose / wine / purple-deep),
 *     applied as a soft wash inside the card. Color-coded mood is
 *     a small but reliable cognitive shortcut (emotional anchoring).
 *
 *   • Big mood emoji at the top of each card — visual anchor that
 *     communicates the feeling faster than the headline does.
 *
 *   • Microcopy is in the user's own voice ("בא לי..."). This is
 *     deliberate: it lets the user step inside the choice instead of
 *     evaluating an external label.
 *
 * All copy comes from `homeV2.journeyStages.*` (HE/EN parity).
 */

type StageId = "1" | "2" | "3";

const STAGE_HREFS: Record<StageId, "/games" | "/mioshy-sex" | "/journey"> = {
  "1": "/games",
  "2": "/mioshy-sex",
  "3": "/journey",
};

// Mood-specific visual identity. Kept here (not in CSS) so it travels
// with the component and per-card tweaks don't risk leaking into other
// sections via cascade.
const STAGE_VISUAL: Record<
  StageId,
  { emoji: string; gradient: string; accent: string; glow: string }
> = {
  "1": {
    // Light, warm, social — laughs together.
    emoji: "💬",
    gradient: "linear-gradient(135deg,#FFE4E6 0%,#FECDD3 60%,#FDA4AF 100%)",
    accent: "#E11D48",
    glow: "rgba(225,29,72,0.35)",
  },
  "2": {
    // Bold, sensual, nighttime — Mioshy's Sex.
    emoji: "🔥",
    gradient: "linear-gradient(135deg,#3D1F3D 0%,#5B1A33 50%,#8B2638 100%)",
    accent: "#F8C8CE",
    glow: "rgba(184,60,77,0.5)",
  },
  "3": {
    // Deep, contemplative, guided — journey.
    emoji: "✨",
    gradient: "linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4338CA 100%)",
    accent: "#C7D2FE",
    glow: "rgba(67,56,202,0.45)",
  },
};

export function JourneyStages() {
  const t = useTranslations("homeV2.journeyStages");

  // Track which card is currently in view on mobile, for the dot indicator.
  // We use IntersectionObserver against the scrolling track rather than
  // listening to scroll events — cheaper, and snaps cleanly to the snap-
  // aligned card.
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(
      track.querySelectorAll<HTMLLIElement>("li.js-mood-card"),
    );
    if (!cards.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the card with the largest intersection ratio as the
        // current "active" card. Multiple cards can be partially
        // visible during a swipe; we pick the dominant one.
        let best: { idx: number; ratio: number } = { idx: -1, ratio: 0 };
        entries.forEach((entry) => {
          const idx = cards.indexOf(entry.target as HTMLLIElement);
          if (entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        });
        if (best.idx >= 0) setActiveIdx(best.idx);
      },
      {
        root: track,
        // 0.6 = card has to be majority-visible to count as active.
        // Lower thresholds caused the dot to flip too eagerly mid-swipe.
        threshold: [0.4, 0.6, 0.8, 1],
      },
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  // Programmatic dot click → scroll the matching card into view.
  const scrollToCard = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelectorAll<HTMLLIElement>("li.js-mood-card")[idx];
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  // Desktop tilt handler. Uses CSS variables on the card itself so the
  // transform stays GPU-cheap. No state writes on mousemove.
  const handleTilt = (e: React.MouseEvent<HTMLLIElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height; // 0..1
    // Map to -3deg..+3deg — subtle, not gimmicky.
    const rotY = (x - 0.5) * 6;
    const rotX = (0.5 - y) * 6;
    card.style.setProperty("--tilt-x", `${rotX}deg`);
    card.style.setProperty("--tilt-y", `${rotY}deg`);
  };
  const handleTiltReset = (e: React.MouseEvent<HTMLLIElement>) => {
    const card = e.currentTarget;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
  };

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

        {/* Card track — horizontal scroller on mobile, 3-up grid on desktop.
            Both layouts share the same DOM; CSS does the rest. */}
        <ol className="js-mood-track" ref={trackRef}>
          {stages.map((stage) => {
            const visual = STAGE_VISUAL[stage.id];
            return (
              <li
                key={stage.id}
                className={`js-mood-card js-mood-${stage.id}`}
                style={
                  {
                    "--mood-gradient": visual.gradient,
                    "--mood-accent": visual.accent,
                    "--mood-glow": visual.glow,
                    "--tilt-x": "0deg",
                    "--tilt-y": "0deg",
                  } as React.CSSProperties
                }
                onMouseMove={handleTilt}
                onMouseLeave={handleTiltReset}
              >
                {/* Mood emoji — the visual anchor */}
                <div className="js-mood-emoji" aria-hidden>
                  {visual.emoji}
                </div>

                {/* Tag chip — small categorization label */}
                <span className="js-mood-tag">{stage.tag}</span>

                {/* Mood label — small uppercase under the tag */}
                <div className="js-mood-label">{stage.label}</div>

                {/* Hook — the user-voice headline ("בא לי...") */}
                <h3 className="js-mood-hook">{stage.hook}</h3>

                {/* Description */}
                <p className="js-mood-desc">{stage.desc}</p>

                {/* Product + price block — divider above */}
                <div className="js-mood-product">
                  <div className="js-mood-product-name">{stage.product}</div>
                  <div className="js-mood-price">
                    <span className="js-mood-price-amount">{stage.price}</span>
                    <span className="js-mood-price-period">{stage.period}</span>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={STAGE_HREFS[stage.id]}
                  className="js-mood-cta"
                >
                  {stage.cta}
                  <span aria-hidden className="arrow">←</span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Dot indicator — mobile only. Tapping a dot scrolls to the card. */}
        <div className="js-mood-dots" role="tablist" aria-label={t("eyebrow")}>
          {stages.map((stage, idx) => (
            <button
              key={stage.id}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx}
              aria-controls={`js-mood-${stage.id}`}
              className={`js-mood-dot ${idx === activeIdx ? "is-active" : ""}`}
              onClick={() => scrollToCard(idx)}
            >
              <span className="sr-only">{stage.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Local styles. Scoped via .journey-stages so the wine palette and
          mood gradients don't bleed into other v2 sections. */}
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
                radial-gradient(700px 380px at 12% 18%, rgba(225,29,72,0.06), transparent 60%),
                radial-gradient(700px 380px at 88% 82%, rgba(67,56,202,0.06), transparent 60%);
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
            /* H2 inherits font-family/size/weight from the global homepage
               token. Per Itzik 2026-05-06 sizes are uniform; only color
               varies per section. */
            .journey-stages h2{color:#170E14;margin-bottom:18px}
            .journey-stages .section-head p{
              font-size:18px;line-height:1.6;color:#4A3A45;
              max-width:560px;margin:0 auto;
            }

            /* ─── Card track ───────────────────────────────────────────── */
            /* Mobile: horizontal snap-scroller. Desktop: 3-up grid.
               Same DOM, CSS picks the layout. */
            .js-mood-track{
              list-style:none;padding:0;margin:0;
              display:grid;grid-auto-flow:column;
              grid-auto-columns:85%;
              gap:18px;
              overflow-x:auto;
              overflow-y:visible;
              scroll-snap-type:x mandatory;
              scroll-padding-inline:24px;
              padding:16px 24px 28px;
              -webkit-overflow-scrolling:touch;
              scrollbar-width:none;
            }
            .js-mood-track::-webkit-scrollbar{display:none}

            @media (min-width:900px){
              .js-mood-track{
                grid-auto-flow:initial;
                grid-template-columns:repeat(3,1fr);
                grid-auto-columns:initial;
                gap:32px;
                overflow:visible;
                scroll-snap-type:none;
                padding:24px 0;
                perspective:1200px;
              }
            }

            /* ─── Card ─────────────────────────────────────────────────── */
            .js-mood-card{
              position:relative;
              background:#FFFFFF;
              border:1px solid #EAE0E3;
              border-radius:28px;
              padding:36px 28px 28px;
              display:flex;flex-direction:column;
              scroll-snap-align:center;
              box-shadow:0 20px 50px -28px rgba(74,23,33,0.25);
              isolation:isolate;
              overflow:hidden;
              transition:transform .35s cubic-bezier(.22,.61,.36,1),
                         box-shadow .35s cubic-bezier(.22,.61,.36,1),
                         border-color .35s;
            }
            /* The mood gradient lives inside ::before so we can vary its
               opacity without affecting card content. It floods the card
               from a corner so the rest of the surface stays readable. */
            .js-mood-card::before{
              content:"";
              position:absolute;
              inset:0;
              z-index:0;
              background:var(--mood-gradient);
              opacity:0.18;
              transition:opacity .4s ease;
              pointer-events:none;
            }
            .js-mood-card > *{position:relative;z-index:1}

            /* Desktop tilt. The CSS variables --tilt-x/--tilt-y are set
               by the mousemove handler. transform-style: preserve-3d is
               not strictly needed because we only use one transform. */
            @media (min-width:900px){
              .js-mood-card{
                transform:perspective(1000px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
                transform-style:preserve-3d;
                transition:transform .15s ease-out,
                           box-shadow .35s,
                           border-color .35s;
              }
              .js-mood-card:hover{
                box-shadow:
                  0 32px 70px -28px var(--mood-glow),
                  0 14px 32px -16px rgba(74,23,33,0.22);
                border-color:rgba(184,60,77,0.3);
              }
              .js-mood-card:hover::before{opacity:0.28}
            }

            /* ─── Card contents ────────────────────────────────────────── */
            .js-mood-emoji{
              font-size:54px;
              line-height:1;
              margin-bottom:20px;
              filter:drop-shadow(0 6px 16px var(--mood-glow));
              transition:transform .35s cubic-bezier(.22,.61,.36,1);
            }
            .js-mood-card:hover .js-mood-emoji{transform:scale(1.08)}

            .js-mood-tag{
              align-self:flex-start;
              padding:5px 12px;
              border-radius:999px;
              background:rgba(255,255,255,0.6);
              border:1px solid rgba(0,0,0,0.06);
              color:#170E14;
              font-size:12px;font-weight:600;
              letter-spacing:0.04em;
              backdrop-filter:blur(6px);
            }
            .js-mood-2 .js-mood-tag,
            .js-mood-3 .js-mood-tag{
              background:rgba(255,255,255,0.92);
            }

            .js-mood-label{
              margin-top:14px;
              font-size:11px;font-weight:600;letter-spacing:0.22em;
              text-transform:uppercase;color:#7A6A75;
            }

            .js-mood-hook{
              font-family:'Frank Ruhl Libre','Noto Serif Hebrew',serif;
              font-size:28px;line-height:1.18;
              color:#170E14;font-weight:700;
              margin:8px 0 14px;
              letter-spacing:-0.01em;
            }

            .js-mood-desc{
              font-size:15px;line-height:1.6;color:#4A3A45;
              margin-bottom:24px;flex-grow:1;
            }

            .js-mood-product{
              padding-top:18px;
              border-top:1px solid rgba(0,0,0,0.08);
              margin-bottom:18px;
            }
            .js-mood-product-name{
              font-size:14px;font-weight:700;color:#170E14;
              margin-bottom:6px;
              letter-spacing:0.005em;
            }
            .js-mood-price{
              display:flex;align-items:baseline;gap:6px;
            }
            .js-mood-price-amount{
              font-family:'Frank Ruhl Libre',serif;
              font-size:36px;font-weight:700;color:var(--mood-accent);
              line-height:1;
            }
            .js-mood-price-period{
              font-size:13px;color:#7A6A75;font-weight:500;
            }
            /* Stage 2/3 use dark gradient backgrounds — accent color from
               the visual map is light, so we recolor the price for contrast
               against the WHITE card surface. */
            .js-mood-2 .js-mood-price-amount{color:#B83C4D}
            .js-mood-3 .js-mood-price-amount{color:#4338CA}

            .js-mood-cta{
              display:inline-flex;align-items:center;gap:8px;
              padding:14px 24px;border-radius:999px;
              background:#170E14;color:#fff;
              font-size:14px;font-weight:600;
              text-decoration:none;
              transition:background .25s,transform .25s,box-shadow .25s;
              align-self:flex-start;
            }
            .js-mood-cta:hover{
              background:var(--mood-accent);
              color:#170E14;
              transform:translateX(-2px);
              box-shadow:0 12px 24px -10px var(--mood-glow);
            }
            .js-mood-2 .js-mood-cta:hover{color:#fff;background:#B83C4D}
            .js-mood-3 .js-mood-cta:hover{color:#fff;background:#4338CA}
            [dir="rtl"] .js-mood-cta:hover{transform:translateX(2px)}
            .js-mood-cta .arrow{
              display:inline-block;
              transition:transform .25s;
            }
            .js-mood-cta:hover .arrow{transform:translateX(-3px)}
            [dir="rtl"] .js-mood-cta:hover .arrow{transform:translateX(3px)}

            /* ─── Dot indicator — mobile only ──────────────────────────── */
            .js-mood-dots{
              display:flex;justify-content:center;gap:10px;
              margin-top:16px;
            }
            @media (min-width:900px){
              .js-mood-dots{display:none}
            }
            .js-mood-dot{
              appearance:none;border:0;background:transparent;cursor:pointer;
              padding:8px;
              -webkit-tap-highlight-color:transparent;
            }
            .js-mood-dot::after{
              content:"";display:block;
              width:8px;height:8px;border-radius:999px;
              background:rgba(23,14,20,0.2);
              transition:width .3s,background .3s;
            }
            .js-mood-dot.is-active::after{
              width:28px;
              background:#B83C4D;
            }

            /* sr-only utility (used by dots for a11y label) */
            .journey-stages .sr-only{
              position:absolute;width:1px;height:1px;padding:0;margin:-1px;
              overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;
            }

            /* ─── Mobile fine-tune ─────────────────────────────────────── */
            @media (max-width:640px){
              .journey-stages{padding:72px 0 56px}
              .journey-stages .section-head{margin-bottom:36px}
              .js-mood-card{padding:30px 24px 24px;border-radius:24px}
              .js-mood-emoji{font-size:46px;margin-bottom:16px}
              .js-mood-hook{font-size:24px;line-height:1.2}
              .js-mood-desc{font-size:15px}
              .js-mood-price-amount{font-size:32px}
            }
          `,
        }}
      />
    </section>
  );
}
