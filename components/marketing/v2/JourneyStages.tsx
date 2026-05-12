"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * JourneyStages — connected Q&A, scroll-revealed
 * ───────────────────────────────────────────────
 * Itzik 2026-05-08 (rev 3): the rail+arrow rev felt like a SaaS pricing
 * page. New direction: three "questions" the reader asks themselves —
 * "I want us to laugh", "I want us to be bold", "I want someone to
 * guide us" — connected as a single flowing Q&A. The questions are
 * always visible (one after another, sharing top-borders that carry
 * the journey's gradient); the answers open as each section enters
 * the viewport's centre, like the page itself is responding.
 *
 *   • No cards, no boxes, no solid backgrounds. Each stop is a content
 *     block bounded only by a gradient hairline above it. The
 *     section's own wash is visible through every stop, which is what
 *     "transparent" + "less colour separation" called for.
 *   • Decorative big "01 / 02 / 03" numerals in serif, low opacity, in
 *     each stop's tone colour — playful editorial mark, not a UI chip.
 *   • Reveal animation is grid-template-rows 0fr → 1fr (true accordion
 *     expand) plus opacity. IntersectionObserver toggles a
 *     data-revealed attribute when a stop's centre enters viewport.
 *     Once revealed, stays open — no closing on scroll-back, which
 *     would be hostile UX.
 *   • Removed: the rail, the descending arrow, the heart marker, the
 *     "absorbs the previous stops" label and the three coloured dots
 *     under stop 3. None of those communicated anything to the user
 *     according to last review.
 *
 * Performance contract: IntersectionObserver only (no scroll
 * listener). One observer instance, single threshold. Reveal toggles
 * a single attribute → CSS transitions take it from there. No React
 * re-renders during scroll.
 */

type StageId = "1" | "2" | "3";

const STAGE_HREFS: Record<StageId, "/games" | "/mioshy-sex" | "/journey"> = {
  "1": "/games",
  "2": "/mioshy-sex",
  "3": "/journey",
};

const STAGE_TONE: Record<
  StageId,
  { dot: string; ink: string; soft: string; numeral: string }
> = {
  "1": {
    dot: "#F59E0B",
    ink: "#B45309",
    soft: "rgba(251,191,36,0.10)",
    numeral: "01",
  },
  "2": {
    dot: "#B83C4D",
    ink: "#9F1239",
    soft: "rgba(184,60,77,0.08)",
    numeral: "02",
  },
  "3": {
    dot: "#4338CA",
    ink: "#3730A3",
    soft: "rgba(67,56,202,0.08)",
    numeral: "03",
  },
};

export function JourneyStages() {
  const sectionRef = useRef<HTMLElement>(null);
  // CMS-migrated (Sprint 1). Section-level keys read here; each
  // stage's keys live in its own <Stop /> sub-component below so the
  // hook ordering stays stable per stage even if a stage is later
  // conditionally rendered.
  const eyebrow = useCmsText("homeV2.journeyStages.eyebrow");
  const headline = useCmsText("homeV2.journeyStages.headline");
  const description = useCmsText("homeV2.journeyStages.description");
  const valueQuote = useCmsText("homeV2.journeyStages.valueQuote");

  // F6 (Itzik #10) — switched from bidirectional to one-way reveal.
  // The previous "open in band, close out of band" behaviour was
  // pushing stop 2 closed the moment the user scrolled toward stop 3,
  // so the description had no time to be read on mobile. Now: once a
  // stop is in the trigger band it stays open, and we widen the band
  // upward (-25% top) so the next stop reveals only after the previous
  // one has been comfortably read.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const stops = Array.from(
      section.querySelectorAll<HTMLElement>("[data-stop]"),
    );
    if (!stops.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).setAttribute(
              "data-revealed",
              "true",
            );
          }
        });
      },
      {
        rootMargin: "-25% 0px -45% 0px",
        threshold: 0,
      },
    );
    stops.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Manual toggle on head click. Both the observer and the click can
  // mutate data-revealed; whichever fired most recently wins. In
  // practice that means: click overrides scroll until next scroll-
  // driven intersection event.
  const onHeadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const stop = e.currentTarget.closest<HTMLElement>("[data-stop]");
    if (!stop) return;
    if (stop.getAttribute("data-revealed") === "true") {
      stop.removeAttribute("data-revealed");
    } else {
      stop.setAttribute("data-revealed", "true");
    }
  };

  // `renderStop` is now a render of <Stop id="…" onHeadClick={…} /> —
  // see the sub-component below. Each stop has 11+ useCmsText calls;
  // confining them to a per-stop component keeps the hook order stable
  // and consistent across re-renders.

  return (
    <section
      ref={sectionRef}
      className="mood-timeline"
      id="mood-timeline"
    >
      <div className="js-bg" aria-hidden />

      <div className="container js-container">
        <div className="js-head">
          <div className="eyebrow" style={eyebrow.style}>
            {eyebrow.text}
          </div>
          <h2 style={headline.style}>{headline.text}</h2>
          <p style={description.style}>{description.text}</p>
        </div>

        {/* Single rounded panel wrapping all 3 stops — gives the
            "one piece, three chapters" feeling instead of three
            floating sections. */}
        <div className="js-stops-panel">
          <div className="js-stops">
            <Stop id="1" onHeadClick={onHeadClick} />
            <Stop id="2" onHeadClick={onHeadClick} />
            <Stop id="3" onHeadClick={onHeadClick} />
          </div>
        </div>

        <p className="js-quote" style={valueQuote.style}>
          {valueQuote.text}
        </p>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: STYLES,
        }}
      />
    </section>
  );
}

/**
 * Per-stop rendering. Pulled out of JourneyStages so each instance has
 * its own stable hook order — 11 useCmsText calls per stop (12 for
 * Stage 3 which has the `GetIncludes` extra). Without this split, the
 * parent would call useCmsText × 33+ in the closure, and any future
 * conditional render would shift hook order.
 *
 * Stage 1 has a free trial (no price block); stages 2 & 3 have price
 * blocks. Stage 2 carries an `originalPrice` strikethrough for the
 * "intro discount" framing.
 */
function Stop({
  id,
  onHeadClick,
}: {
  id: StageId;
  onHeadClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const tone = STAGE_TONE[id];

  // Shared keys for every stage
  const label = useCmsText(`homeV2.journeyStages.stage${id}Label`);
  const hook = useCmsText(`homeV2.journeyStages.stage${id}Hook`);
  const desc = useCmsText(`homeV2.journeyStages.stage${id}Desc`);
  const getTitle = useCmsText(`homeV2.journeyStages.stage${id}GetTitle`);
  const get = useCmsText(`homeV2.journeyStages.stage${id}Get`);
  const whenTitle = useCmsText(`homeV2.journeyStages.stage${id}WhenTitle`);
  const when = useCmsText(`homeV2.journeyStages.stage${id}When`);
  const product = useCmsText(`homeV2.journeyStages.stage${id}Product`);
  const cta = useCmsText(`homeV2.journeyStages.stage${id}Cta`);
  const price = useCmsText(`homeV2.journeyStages.stage${id}Price`);
  const period = useCmsText(`homeV2.journeyStages.stage${id}Period`);

  // Stage-specific extras — these keys are looked up for every stage to
  // keep hook order constant, but rendered conditionally based on `id`.
  // Empty strings just fall through to JSON or render nothing.
  const stage3GetIncludes = useCmsText("homeV2.journeyStages.stage3GetIncludes");
  const stage1Trial = useCmsText("homeV2.journeyStages.stage1Trial");
  const stage2OriginalPrice = useCmsText("homeV2.journeyStages.stage2OriginalPrice");

  const includes = id === "3" ? stage3GetIncludes.text : null;

  return (
    <article
      className={`js-stop js-stop--${id}`}
      data-stop={id}
      style={
        {
          "--tone-dot": tone.dot,
          "--tone-ink": tone.ink,
          "--tone-soft": tone.soft,
        } as React.CSSProperties
      }
    >
      <div className="js-stop-spine" aria-hidden />
      <div
        className="js-stop-head"
        role="button"
        tabIndex={0}
        aria-expanded="false"
        onClick={onHeadClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onHeadClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
      >
        <span className="js-stop-numeral" aria-hidden>
          {tone.numeral}
        </span>
        <div className="js-stop-head-text">
          <span className="js-stop-label" style={label.style}>
            {label.text}
          </span>
          <h3 className="js-stop-hook" style={hook.style}>
            {hook.text}
          </h3>
        </div>
        <span className="js-stop-chevron" aria-hidden>
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path
              d="M3 5.5L8 10.5L13 5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* The "answer" — collapsed by default, revealed via the
          grid-template-rows trick when the stop enters viewport. */}
      <div className="js-stop-reveal">
        <div className="js-stop-reveal-inner">
          <p className="js-stop-desc" style={desc.style}>
            {desc.text}
          </p>

          <div className="js-stop-block">
            <div className="js-stop-block-title" style={getTitle.style}>
              {getTitle.text}
            </div>
            <p className="js-stop-block-body" style={get.style}>
              {get.text}
            </p>
            {includes ? (
              <p className="js-stop-block-includes" style={stage3GetIncludes.style}>
                {includes}
              </p>
            ) : null}
          </div>

          <div className="js-stop-block">
            <div className="js-stop-block-title" style={whenTitle.style}>
              {whenTitle.text}
            </div>
            <p className="js-stop-block-body" style={when.style}>
              {when.text}
            </p>
          </div>

          <div className="js-stop-foot">
            <div className="js-stop-foot-info">
              <div className="js-stop-product" style={product.style}>
                {product.text}
              </div>
              {id === "1" ? (
                /* Stage 1 framing: don't lead with the price — let
                   the user try the games for free first. */
                <div className="js-stop-trial" style={stage1Trial.style}>
                  {stage1Trial.text}
                </div>
              ) : (
                <div className="js-stop-price">
                  {id === "2" ? (
                    <span
                      className="js-stop-price-original"
                      style={stage2OriginalPrice.style}
                    >
                      {stage2OriginalPrice.text}
                    </span>
                  ) : null}
                  <span className="js-stop-price-amount" style={price.style}>
                    {price.text}
                  </span>
                  <span className="js-stop-price-period" style={period.style}>
                    {period.text}
                  </span>
                </div>
              )}
            </div>
            <Link href={STAGE_HREFS[id]} className="js-stop-cta">
              {cta.text}{" "}
              <span aria-hidden className="js-stop-cta-arrow">
                ←
              </span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

const STYLES = `
  .mood-timeline{
    position:relative;
    padding:96px 0 80px;
    overflow:hidden;
    background:linear-gradient(180deg,#FFF9FB 0%,#F5E9EC 55%,#EFE7F1 100%);
    isolation:isolate;
  }
  .mood-timeline .js-bg{
    position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(620px 420px at 88% 8%, rgba(251,191,36,0.16), transparent 65%),
      radial-gradient(620px 420px at 12% 92%, rgba(67,56,202,0.14), transparent 65%);
  }

  .mood-timeline .js-container{position:relative;z-index:2}

  .mood-timeline .js-head{
    text-align:center;
    max-width:680px;
    margin:0 auto 64px;
  }
  .mood-timeline .eyebrow{
    display:inline-flex;align-items:center;gap:10px;
    font-size:13px;font-weight:600;letter-spacing:0.2em;
    text-transform:uppercase;color:#170E14;
    margin-bottom:14px;
  }
  .mood-timeline .eyebrow::before{
    content:"";width:7px;height:7px;border-radius:1px;
    background:#B83C4D;box-shadow:0 0 0 3px rgba(184,60,77,0.18);
  }
  .mood-timeline h2{color:#170E14;margin-bottom:18px}
  .mood-timeline .js-head p{
    font-size:18px;line-height:1.6;color:#4A3A45;
    max-width:560px;margin:0 auto;
  }

  /* ─── Stops panel — single rounded container wrapping all 3 stops ─── */
  /* Panel background: bright white at top fading to a soft brand-wine
     at the bottom. Wine here is intentionally LIGHT — the dark wine
     shade was crushing the readability of body text against it. We
     keep just enough of the wine hue at the bottom to anchor the
     panel to the brand palette, while the contrast against text
     stays high throughout. */
  .mood-timeline .js-stops-panel{
    max-width:640px;
    margin:0 auto;
    background:linear-gradient(180deg,
      rgba(255,255,255,0.92) 0%,
      rgba(253,243,245,0.78) 45%,
      rgba(244,114,128,0.18) 100%);
    border:1px solid rgba(255,255,255,0.7);
    border-radius:28px;
    box-shadow:
      0 32px 64px -36px rgba(159,18,57,0.18),
      inset 0 1px 0 rgba(255,255,255,0.7);
    padding:6px 36px;
    position:relative;
  }
  .mood-timeline .js-stops{position:relative}

  /* ─── Stop block ──────────────────────────────────────────────────── */
  .mood-timeline .js-stop{
    position:relative;
    padding:36px 0 32px;
    /* Hairline divider between stops; first stop has no top border
       so the panel's edge does the work there. */
    border-top:1px solid rgba(23,14,20,0.08);
  }
  .mood-timeline .js-stop:first-of-type{border-top:none;padding-top:32px}
  .mood-timeline .js-stop:last-of-type{padding-bottom:36px}

  /* No per-stop background — the panel above provides the visual
     continuity. The .js-stop-spine div is now used as the "active
     glow" that brightens when the stop is in view. */
  .mood-timeline .js-stop-spine{
    position:absolute;
    inset:-8px -16px;
    background:radial-gradient(closest-side, var(--tone-soft) 0%, transparent 70%);
    z-index:-1;
    pointer-events:none;
    opacity:0;
    transform:scale(0.92);
    transition:opacity .8s ease, transform .8s cubic-bezier(.34,.66,.6,1);
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-spine{
    opacity:1;
    transform:scale(1);
  }

  /* ─── Stop head — always visible (the "question"), clickable ─────── */
  .mood-timeline .js-stop-head{
    display:grid;
    grid-template-columns:auto 1fr auto;
    gap:18px;
    align-items:center;
    cursor:pointer;
    user-select:none;
    -webkit-tap-highlight-color:transparent;
    border-radius:14px;
    margin:-8px -10px;
    padding:8px 10px;
    transition:background-color .25s ease;
  }
  .mood-timeline .js-stop-head:hover,
  .mood-timeline .js-stop-head:focus-visible{
    background-color:rgba(255,255,255,0.45);
    outline:none;
  }

  /* Chevron at the end of the head — rotates 180deg when stop is open. */
  .mood-timeline .js-stop-chevron{
    display:inline-flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:50%;
    background:rgba(23,14,20,0.04);
    color:#7A6A75;
    transition:transform .35s cubic-bezier(.22,.61,.36,1), background-color .25s ease, color .25s ease;
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-chevron{
    transform:rotate(180deg);
    background:var(--tone-soft);
    color:var(--tone-ink);
  }
  /* Numeral animation: starts small + dim, grows + brightens on reveal
     with a slight elastic settle. Each stop has its own resting tilt
     so the trio feels hand-set, not stamped from a template. */
  .mood-timeline .js-stop-numeral{
    font-family:'Frank Ruhl Libre','Noto Serif Hebrew',serif;
    font-size:88px;
    font-weight:300;
    line-height:0.85;
    color:var(--tone-dot);
    opacity:0.32;
    letter-spacing:-0.04em;
    transform-origin:center;
    transition:
      opacity .7s ease,
      transform .9s cubic-bezier(.34,.66,.6,1.4);
  }
  /* Per-stop resting tilts — applied via CSS variables so the reveal
     animation can compose with them. */
  .mood-timeline .js-stop--1{--tilt:-3deg}
  .mood-timeline .js-stop--2{--tilt:2deg}
  .mood-timeline .js-stop--3{--tilt:-2deg}
  .mood-timeline .js-stop-numeral{transform:rotate(var(--tilt,0)) scale(0.86)}
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-numeral{
    opacity:0.62;
    transform:rotate(var(--tilt,0)) scale(1);
  }

  .mood-timeline .js-stop-head-text{display:flex;flex-direction:column;gap:8px}
  .mood-timeline .js-stop-label{
    font-size:12px;font-weight:600;letter-spacing:0.18em;
    text-transform:uppercase;color:var(--tone-ink);
  }
  .mood-timeline .js-stop-hook{
    font-family:'Frank Ruhl Libre','Noto Serif Hebrew',serif;
    font-size:34px;line-height:1.16;font-weight:700;
    margin:0;letter-spacing:-0.01em;
    color:#170E14;
  }

  /* ─── Stop reveal — collapsed by default, opens on scroll ──────────── */
  /* The grid-template-rows 0fr → 1fr trick lets us animate height to
     auto-content. Inner element must have overflow:hidden. */
  .mood-timeline .js-stop-reveal{
    display:grid;
    grid-template-rows:0fr;
    opacity:0;
    transform:translateY(12px);
    transition:
      grid-template-rows .7s cubic-bezier(.22,.61,.36,1),
      opacity .6s ease,
      transform .6s ease;
    margin-top:0;
  }
  .mood-timeline .js-stop-reveal-inner{
    overflow:hidden;
    min-height:0;
    /* When opened, this is where padding-top lives — keeps the
       collapsed state truly compact. */
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-reveal{
    grid-template-rows:1fr;
    opacity:1;
    transform:translateY(0);
    margin-top:24px;
  }
  /* Reduced-motion: skip the slide-and-fade, just show content. */
  @media (prefers-reduced-motion:reduce){
    .mood-timeline .js-stop-reveal{
      transition:none;
    }
  }

  /* ─── Body content (revealed with stagger) ────────────────────────── */
  /* Each child of the reveal animates in with a tiny delay offset so
     the open feels alive — not all at once, not too sequential. The
     stagger is 100ms per element. */
  .mood-timeline .js-stop-desc,
  .mood-timeline .js-stop-block,
  .mood-timeline .js-stop-foot{
    opacity:0;
    transform:translateY(10px);
    transition:opacity .55s ease, transform .55s cubic-bezier(.22,.61,.36,1);
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-desc{
    opacity:1;transform:none;transition-delay:.10s;
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-block:nth-of-type(1){
    opacity:1;transform:none;transition-delay:.22s;
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-block:nth-of-type(2){
    opacity:1;transform:none;transition-delay:.32s;
  }
  .mood-timeline .js-stop[data-revealed="true"] .js-stop-foot{
    opacity:1;transform:none;transition-delay:.44s;
  }

  /* Tightened vertical rhythm — short copy was floating. Gaps between
     blocks now 14-18px (was 24-32px) so each block reads as one unit. */
  .mood-timeline .js-stop-desc{
    font-size:20px;line-height:1.6;color:#3D2C36;
    margin:18px 0 22px;
    font-weight:400;
  }
  .mood-timeline .js-stop-block{margin-bottom:16px}
  .mood-timeline .js-stop-block-title{
    font-size:11px;font-weight:600;letter-spacing:0.18em;
    text-transform:uppercase;color:#7A6A75;
    margin-bottom:5px;
  }
  .mood-timeline .js-stop-block-body{
    font-size:19px;line-height:1.55;color:#3D2C36;
    margin:0;
  }
  .mood-timeline .js-stop-block-includes{
    font-size:17px;line-height:1.55;
    margin:8px 0 0;
    color:var(--tone-ink);
    font-weight:600;
  }
  .mood-timeline .js-stop-foot{
    margin-top:22px;
    padding-top:18px;
    border-top:1px dashed rgba(23,14,20,0.10);
    display:flex;align-items:flex-end;justify-content:space-between;gap:18px;
    flex-wrap:wrap;
  }
  .mood-timeline .js-stop-foot-info{display:flex;flex-direction:column;gap:5px}
  .mood-timeline .js-stop-product{
    font-size:13px;font-weight:600;color:#170E14;
    letter-spacing:0.005em;
  }
  .mood-timeline .js-stop-price{
    display:flex;align-items:baseline;gap:8px;
  }
  /* Stage 2 strikethrough — original 200₪ shown alongside the discounted
     97₪. Smaller, faded, with a line-through to make the offer obvious. */
  .mood-timeline .js-stop-price-original{
    font-family:'Frank Ruhl Libre',serif;
    font-size:20px;font-weight:500;
    color:#9C8B91;
    text-decoration:line-through;
    text-decoration-thickness:1.5px;
    text-decoration-color:rgba(159,18,57,0.5);
    line-height:1;
  }
  .mood-timeline .js-stop-price-amount{
    font-family:'Frank Ruhl Libre',serif;
    font-size:42px;font-weight:700;color:var(--tone-ink);
    line-height:1;
  }
  .mood-timeline .js-stop-price-period{
    font-size:13px;color:#7A6A75;font-weight:500;
  }
  /* Stage 1 free-trial framing — replaces the price block. Compact,
     friendly, reassuring (no credit card). */
  .mood-timeline .js-stop-trial{
    font-size:14px;font-weight:600;
    color:var(--tone-ink);
    letter-spacing:0.005em;
    line-height:1.4;
  }
  .mood-timeline .js-stop-cta{
    display:inline-flex;align-items:center;gap:8px;
    padding:14px 24px;border-radius:999px;
    background:var(--tone-ink);color:#FFFFFF;
    font-size:15px;font-weight:600;
    text-decoration:none;
    transition:gap .25s ease, transform .25s ease, box-shadow .25s ease;
    box-shadow:0 8px 22px -10px var(--tone-ink);
  }
  .mood-timeline .js-stop-cta:hover{
    gap:12px;
    transform:translateY(-1px);
    box-shadow:0 14px 28px -12px var(--tone-ink);
  }
  .mood-timeline .js-stop-cta-arrow{
    display:inline-block;
    transition:transform .25s ease;
  }
  .mood-timeline .js-stop-cta:hover .js-stop-cta-arrow{transform:translateX(-3px)}
  [dir="ltr"] .mood-timeline .js-stop-cta-arrow{transform:scaleX(-1)}
  [dir="ltr"] .mood-timeline .js-stop-cta:hover .js-stop-cta-arrow{transform:scaleX(-1) translateX(-3px)}

  /* ─── Closing quote ─────────────────────────────────────────────────── */
  .mood-timeline .js-quote{
    text-align:center;
    max-width:560px;
    margin:64px auto 0;
    font-family:'Frank Ruhl Libre',serif;
    font-size:18px;font-style:italic;
    color:#4A3A45;line-height:1.65;
  }

  /* ─── Mobile (≤899px) ──────────────────────────────────────────────── */
  @media (max-width:899px){
    .mood-timeline{padding:72px 0 56px}
    .mood-timeline .js-head{margin-bottom:40px}
    .mood-timeline .js-head p{font-size:16px}

    .mood-timeline .js-stops-panel{
      padding:4px 22px;
      border-radius:24px;
    }

    .mood-timeline .js-stop{padding:32px 0 28px}
    .mood-timeline .js-stop:first-of-type{padding-top:28px}
    .mood-timeline .js-stop-head{
      grid-template-columns:auto 1fr;
      gap:16px;
    }
    .mood-timeline .js-stop-numeral{font-size:64px}
    .mood-timeline .js-stop-hook{font-size:26px;line-height:1.2}

    /* F6 (Itzik #10) — descriptions and "what you get / when" body
       bumped to 20px on mobile so each stop reads at the body floor. */
    .mood-timeline .js-stop-desc{font-size:20px;line-height:1.55;margin:20px 0 24px}
    .mood-timeline .js-stop-block-body{font-size:20px;line-height:1.55}
    .mood-timeline .js-stop-block-includes{font-size:17px}
    .mood-timeline .js-stop-block-title{font-size:13px;letter-spacing:0.16em}

    .mood-timeline .js-stop-foot{
      flex-direction:column;align-items:stretch;
      gap:14px;
    }
    .mood-timeline .js-stop-cta{align-self:flex-start}
    .mood-timeline .js-stop-price-amount{font-size:38px}

    .mood-timeline .js-quote{
      font-size:16px;
      padding:0 24px;
    }
  }
`;
