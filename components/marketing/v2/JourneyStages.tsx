"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

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
  const t = useTranslations("homeV2.journeyStages");
  const sectionRef = useRef<HTMLElement>(null);

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

  const renderStop = (id: StageId) => {
    const tone = STAGE_TONE[id];
    // Stage 3 lists what's bundled in ("Online couples games", "Mioshy's
    // Sex") as a checklist under the GetTitle. Previously this was a
    // single inline string with `·` separators; split into discrete
    // items so the rendered <ul> can use a brand-coloured ✓ marker and
    // future additions are a JSON-key change, not a component change.
    const includesItems = id === "3"
      ? [t("stage3GetIncludesItem1"), t("stage3GetIncludesItem2")]
      : null;
    // Stage 3 "when this is the right thing" — list of 6 personas a
    // user can self-identify with. Previously a single short paragraph;
    // converted to a list so the user can scan ("am I one of these?")
    // and the page can run a different marker style (dot, not ✓) so
    // the two Stage-3 lists aren't visually identical.
    const whenItems = id === "3"
      ? [
          t("stage3WhenItem1"),
          t("stage3WhenItem2"),
          t("stage3WhenItem3"),
          t("stage3WhenItem4"),
          t("stage3WhenItem5"),
          t("stage3WhenItem6"),
        ]
      : null;
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
              onHeadClick(
                e as unknown as React.MouseEvent<HTMLDivElement>,
              );
            }
          }}
        >
          <span className="js-stop-numeral" aria-hidden>
            {tone.numeral}
          </span>
          <div className="js-stop-head-text">
            <span className="js-stop-label">{t(`stage${id}Label`)}</span>
            <h3 className="js-stop-hook">{t(`stage${id}Hook`)}</h3>
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
            <p className="js-stop-desc">{t(`stage${id}Desc`)}</p>

            <div className="js-stop-block">
              <div className="js-stop-block-title">
                {t(`stage${id}GetTitle`)}
              </div>
              <p className="js-stop-block-body">{t(`stage${id}Get`)}</p>
              {includesItems ? (
                <ul className="js-stop-block-includes-list">
                  {includesItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="js-stop-block">
              <div className="js-stop-block-title">
                {t(`stage${id}WhenTitle`)}
              </div>
              {whenItems ? (
                <ul className="js-stop-block-when-list">
                  {whenItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="js-stop-block-body">{t(`stage${id}When`)}</p>
              )}
            </div>

            <div className="js-stop-foot">
              <div className="js-stop-foot-info">
                <div className="js-stop-product">
                  {t(`stage${id}Product`)}
                </div>
                {id === "1" ? (
                  /* Stage 1 framing: don't lead with the price — let
                     the user try the games for free first. The actual
                     price reveals on the games page itself, by design. */
                  <div className="js-stop-trial">{t("stage1Trial")}</div>
                ) : (
                  <div className="js-stop-price">
                    {id === "2" ? (
                      <span className="js-stop-price-original">
                        {t("stage2OriginalPrice")}
                      </span>
                    ) : null}
                    <span className="js-stop-price-amount">
                      {t(`stage${id}Price`)}
                    </span>
                    <span className="js-stop-price-period">
                      {t(`stage${id}Period`)}
                    </span>
                  </div>
                )}
              </div>
              <Link href={STAGE_HREFS[id]} className="js-stop-cta">
                {t(`stage${id}Cta`)}
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <section
      ref={sectionRef}
      className="mood-timeline"
      id="mood-timeline"
    >
      <div className="js-bg" aria-hidden />

      <div className="container js-container">
        <div className="js-head">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("headline")}</h2>
          <p>{t("description")}</p>
        </div>

        {/* Single rounded panel wrapping all 3 stops — gives the
            "one piece, three chapters" feeling instead of three
            floating sections. */}
        <div className="js-stops-panel">
          <div className="js-stops">
            {renderStop("1")}
            {renderStop("2")}
            {renderStop("3")}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: STYLES,
        }}
      />
    </section>
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
  /* Stage 3 "what's included" list — each <li> shows a brand-coloured
     ✓ marker in the stop's tone-ink. The tone-ink is set per-stop via
     a CSS variable on .js-stop, so the checkmark stays semantically
     tied to Stage 3 (indigo) rather than using a generic green. */
  .mood-timeline .js-stop-block-includes-list{
    list-style:none;
    margin:8px 0 0;
    padding:0;
    display:flex;flex-direction:column;gap:4px;
  }
  .mood-timeline .js-stop-block-includes-list li{
    position:relative;
    padding-inline-start:24px;
    font-size:17px;line-height:1.55;
    color:var(--tone-ink);
    font-weight:600;
  }
  .mood-timeline .js-stop-block-includes-list li::before{
    content:"\\2713"; /* ✓ */
    position:absolute;
    inset-inline-start:0;
    top:0;
    color:var(--tone-ink);
    font-weight:700;
  }
  /* Stage 3 "who it's for" list — different semantic meaning than the
     "what's included" checklist above, so a different marker (•) and
     more airy spacing so the user has time to read each persona and
     ask "is that me?". Same tone-ink colour for visual unity within
     Stage 3, but the larger gap + softer marker tells the reader
     these are identification prompts, not feature confirmations. */
  .mood-timeline .js-stop-block-when-list{
    list-style:none;
    margin:8px 0 0;
    padding:0;
    display:flex;flex-direction:column;gap:10px;
  }
  .mood-timeline .js-stop-block-when-list li{
    position:relative;
    padding-inline-start:20px;
    font-size:18px;line-height:1.5;
    color:#3D2C36;
    font-weight:500;
  }
  .mood-timeline .js-stop-block-when-list li::before{
    content:"\\2022"; /* • */
    position:absolute;
    inset-inline-start:0;
    top:0;
    color:var(--tone-ink);
    font-weight:700;
    font-size:20px;
    line-height:1.35;
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


  /* ─── Mobile (≤899px) ──────────────────────────────────────────────── */
  @media (max-width:899px){
    .mood-timeline{padding:72px 0 56px}
    .mood-timeline .js-head{margin-bottom:40px}
    /* I3 — Mioshy-Services eyebrow ≥16px mobile (was 13px). Brings
       it uniform with the other section eyebrows on mobile which all
       sit at 16+ after the typography pass. */
    .mood-timeline .eyebrow{font-size:16px;letter-spacing:0.16em}
    /* I4 — Section subtitle bumped 16→19px on mobile so the "three
       ways to reconnect" subtitle reads at the body floor (other
       v2 section subtitles on mobile sit at 18-20). */
    .mood-timeline .js-head p{font-size:19px;line-height:1.55}

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
    .mood-timeline .js-stop-block-includes-list li{font-size:17px}
    .mood-timeline .js-stop-block-when-list{gap:8px}
    .mood-timeline .js-stop-block-when-list li{font-size:17px;padding-inline-start:18px}
    .mood-timeline .js-stop-block-title{font-size:13px;letter-spacing:0.16em}

    .mood-timeline .js-stop-foot{
      flex-direction:column;align-items:stretch;
      gap:14px;
    }
    .mood-timeline .js-stop-cta{align-self:flex-start}
    .mood-timeline .js-stop-price-amount{font-size:38px}
  }
`;
