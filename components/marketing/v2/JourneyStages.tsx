"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";
import { useCmsText } from "@/hooks/useCmsText";
import { useJourneyPricing } from "./JourneyPricingProvider";

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

const STAGE_HREFS: Record<
  StageId,
  "/games" | "/mioshy-sex" | "/journey?start=1"
> = {
  "1": "/games",
  "2": "/mioshy-sex",
  // Stage 3 funnel-entry: skip the /journey marketing landing and drop the
  // visitor straight on the assessment's first question. `?start=1` lets the
  // /journey page run its state gating first, then auto-forward (anonymous → Q1,
  // in-progress → resume), while a signed-in member without a Journey
  // entitlement still gets their locked upsell. Stages 1 & 2 keep their own
  // product landings.
  "3": "/journey?start=1",
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
    // 2026-05-19 — was indigo navy (#4338CA / #3730A3). Itzik flagged
    // the blue as off-brand. Switched to a fuchsia-magenta family
    // (purple-leaning-red) that sits inside the same wine/rose family
    // as the rest of /journey: distinct from Stage 2 (wine #B83C4D)
    // but still part of the same identity, not a cold blue accent.
    dot: "#A21CAF",
    ink: "#86198F",
    soft: "rgba(162,28,175,0.08)",
    numeral: "03",
  },
};

export function JourneyStages() {
  const sectionRef = useRef<HTMLElement>(null);
  // Sprint 4 #1 closeout — every DOM text via <CmsText>. Each stage
  // lives in its own <Stop /> sub-component (defined below) so its
  // many useCmsText/CmsText calls have a stable, isolated hook order.

  // TEMPORARY DEBUG (2026-05-19) — Itzik reports the bottom of the
  // section still looks dark after we softened the gradient + halved
  // the corner radials. Likely a hot-reload-cached CSS-in-JS payload,
  // but let's confirm by logging what the BROWSER actually applied.
  useEffect(() => {
    const log = () => {
      const section = document.querySelector<HTMLElement>(".mood-timeline");
      const bg = document.querySelector<HTMLElement>(".mood-timeline .js-bg");
      if (!section) {
        console.log("[mood-timeline] section NOT in DOM");
        return;
      }
      const secCS = getComputedStyle(section);
      const bgCS = bg ? getComputedStyle(bg) : null;
      const rect = section.getBoundingClientRect();
      console.log(
        "[mood-timeline]",
        `sectionBg=${secCS.backgroundImage?.slice(0, 120)}...`,
        `sectionBgColor=${secCS.backgroundColor}`,
        `sectionH=${Math.round(rect.height)}`,
      );
      console.log(
        "[mood-timeline js-bg]",
        bg ? `present=true` : `present=false`,
        bgCS ? `bgImage=${bgCS.backgroundImage?.slice(0, 200)}...` : "(n/a)",
      );
      // Probe a sample stop card to see what bg it inherits underneath.
      const stop3 = document.querySelector<HTMLElement>('[data-stop="3"]');
      if (stop3) {
        const stopCS = getComputedStyle(stop3);
        const stopRect = stop3.getBoundingClientRect();
        console.log(
          "[mood-timeline stop-3]",
          `bgImage=${stopCS.backgroundImage?.slice(0, 60)}`,
          `bgColor=${stopCS.backgroundColor}`,
          `top=${Math.round(stopRect.top)}`,
          `bottom=${Math.round(stopRect.bottom)}`,
        );
      }
    };
    log();
    const t = setTimeout(log, 500);
    return () => clearTimeout(t);
  }, []);

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
          <CmsText cmsKey="homeV2.journeyStages.eyebrow" as="div" className="eyebrow" />
          <CmsText cmsKey="homeV2.journeyStages.headline" as="h2" />
          <CmsText cmsKey="homeV2.journeyStages.description" as="p" />
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

        {/* `.js-quote` ("שני 'ערבים' בחודש כבר עוברים את 57₪/שבוע.")
            removed 2026-05-19 per Itzik. The CMS key
            `homeV2.journeyStages.valueQuote` and the `.js-quote` CSS
            rules stay on disk for possible re-use. */}
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
 * Format a shekel amount for display — strips any decimal remainder so
 * 69.00 → "69 ₪" (never "69.00 ₪"). Hebrew placement (number then ₪) to match
 * the rest of the Stage-3 block.
 */
function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
function shekel(n: number): string {
  return `${formatAmount(n)} ₪`;
}

/**
 * Stage-3 price block — monthly framing driven by the LIVE promo, from the same
 * source as the /journey/assessment results page and the checkout (so what we
 * show equals what Cardcom charges).
 *
 *   • active promo  → struck regular monthly + the first-charge price, labelled
 *     "לחודש הראשון", with an "אחר כך … לחודש" line so 37 never reads as permanent.
 *   • no promo      → the regular monthly price only, no strikethrough.
 *   • no live price (DB hiccup / no provider) → falls back to the CMS literals,
 *     i.e. the pre-existing behaviour, so the block never breaks.
 *
 * Hebrew-only copy by request (the homepage Stage-3 surface is he-first; en is
 * out of scope for this change). The weekly headline + weekly line are gone.
 *
 * Hooks run unconditionally before any branch to keep order stable.
 */
function Stage3Price() {
  const pricing = useJourneyPricing();
  // CMS literals — used only as the DB-unavailable safety net (and for their
  // typography/style overrides in that path).
  const cmsOriginal = useCmsText("homeV2.journeyStages.stage3OriginalPrice");
  const cmsAmount = useCmsText("homeV2.journeyStages.stage3Price");
  const cmsPeriod = useCmsText("homeV2.journeyStages.stage3Period");
  const cmsBilled = useCmsText("homeV2.journeyStages.stage3Billed");

  const monthly = pricing?.monthlyIls ?? null;

  // Safety net: no live monthly price → render the legacy CMS strings verbatim.
  if (monthly == null) {
    return (
      <>
        <div className="js-stop-price">
          <span
            className="js-stop-price-original"
            style={cmsOriginal.style}
            data-cms-key="homeV2.journeyStages.stage3OriginalPrice"
          >
            {cmsOriginal.text}
          </span>
          <span
            className="js-stop-price-amount"
            style={cmsAmount.style}
            data-cms-key="homeV2.journeyStages.stage3Price"
          >
            {cmsAmount.text}
          </span>
          <span
            className="js-stop-price-period"
            style={cmsPeriod.style}
            data-cms-key="homeV2.journeyStages.stage3Period"
          >
            {cmsPeriod.text}
          </span>
        </div>
        <p
          className="js-stop-price-billed"
          style={cmsBilled.style}
          data-cms-key="homeV2.journeyStages.stage3Billed"
        >
          {cmsBilled.text}
        </p>
      </>
    );
  }

  const first = pricing?.firstChargeIls ?? monthly;
  const hasPromo = pricing?.hasPromo ?? false;
  // Savings % off the regular monthly — same calc as the results page:
  // round((regular − firstCharge) / regular). Guarded to a real positive saving.
  const savePct =
    hasPromo && monthly > 0 && first < monthly
      ? Math.round(((monthly - first) / monthly) * 100)
      : null;

  return (
    <>
      <div className="js-stop-price">
        {hasPromo ? (
          <span className="js-stop-price-original">{shekel(monthly)}</span>
        ) : null}
        <span className="js-stop-price-amount">
          {/* "starting from" — Stage-3 shows the WITHOUT-coaching entry price;
              the with-coaching option is a higher tier, so this is the floor. */}
          {`החל מ-${shekel(hasPromo ? first : monthly)}`}
        </span>
        <span className="js-stop-price-period">
          {hasPromo ? "לחודש הראשון" : "לחודש"}
        </span>
        {savePct != null ? (
          <span className="js-stop-price-save">{`חיסכון ${savePct}%`}</span>
        ) : null}
      </div>
      {hasPromo ? (
        <p className="js-stop-price-billed js-stop3-billed">{`אחר כך ${shekel(monthly)} לחודש`}</p>
      ) : null}
    </>
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
  const isStage3 = id === "3";

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
          <CmsText
            cmsKey={`homeV2.journeyStages.stage${id}Label`}
            className="js-stop-label"
          />
          <CmsText
            cmsKey={`homeV2.journeyStages.stage${id}Hook`}
            as="h3"
            className="js-stop-hook"
          />
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

      <div className="js-stop-reveal">
        <div className="js-stop-reveal-inner">
          <CmsText
            cmsKey={`homeV2.journeyStages.stage${id}Desc`}
            as="p"
            className="js-stop-desc"
          />

          <div className="js-stop-block">
            <CmsText
              cmsKey={`homeV2.journeyStages.stage${id}GetTitle`}
              as="div"
              className="js-stop-block-title"
            />
            <CmsText
              cmsKey={`homeV2.journeyStages.stage${id}Get`}
              as="p"
              className="js-stop-block-body"
            />
            {isStage3 ? (
              <CmsText
                cmsKey="homeV2.journeyStages.stage3GetIncludes"
                as="p"
                className="js-stop-block-includes"
              />
            ) : null}
          </div>

          <div className="js-stop-block">
            <CmsText
              cmsKey={`homeV2.journeyStages.stage${id}WhenTitle`}
              as="div"
              className="js-stop-block-title"
            />
            <CmsText
              cmsKey={`homeV2.journeyStages.stage${id}When`}
              as="p"
              className="js-stop-block-body"
            />
          </div>

          <div className="js-stop-foot">
            <div className="js-stop-foot-info">
              <CmsText
                cmsKey={`homeV2.journeyStages.stage${id}Product`}
                as="div"
                className="js-stop-product"
              />
              {/* 2026-05-22 — all three stages show a price block. Stage 1 is
                  the games weekly; Stage 2 keeps its one-time per-game framing
                  with a strikethrough original. Stage 3 (journey) is now a
                  self-contained monthly/promo block driven by the live source
                  of truth (same as results + checkout) — see <Stage3Price />. */}
              {isStage3 ? (
                <Stage3Price />
              ) : (
                <>
                  <div className="js-stop-price">
                    {id === "2" ? (
                      <CmsText
                        cmsKey="homeV2.journeyStages.stage2OriginalPrice"
                        className="js-stop-price-original"
                      />
                    ) : null}
                    <CmsText
                      cmsKey={`homeV2.journeyStages.stage${id}Price`}
                      className="js-stop-price-amount"
                    />
                    <CmsText
                      cmsKey={`homeV2.journeyStages.stage${id}Period`}
                      className="js-stop-price-period"
                    />
                  </div>
                  {/* C2.4: billed-monthly transparency line — Stage 1 only
                      (Stage 2 is a one-time game purchase). */}
                  {id !== "2" ? (
                    <CmsText
                      cmsKey={`homeV2.journeyStages.stage${id}Billed`}
                      as="p"
                      className="js-stop-price-billed"
                    />
                  ) : null}
                </>
              )}
            </div>
            <Link href={STAGE_HREFS[id]} className="js-stop-cta">
              <CmsText cmsKey={`homeV2.journeyStages.stage${id}Cta`} />{" "}
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
  /* 2026-05-19 (revision 3) — Itzik asked for a lighter, lavender-
     leaning wash at ~10% intensity and transparency throughout.
     Base linear-gradient uses rgba so the white page underneath
     shows through; stops carry a very light violet tint that builds
     gently toward the bottom. Corner radials repainted lavender
     (violet-300/400) at 10% opacity each — replaces the amber+
     fuchsia mix that read warmer than asked for. */
  .mood-timeline{
    position:relative;
    padding:96px 0 80px;
    overflow:hidden;
    background:linear-gradient(180deg,
      rgba(255,255,255,0.6) 0%,
      rgba(196,181,253,0.10) 55%,
      rgba(167,139,250,0.12) 100%);
    isolation:isolate;
  }
  .mood-timeline .js-bg{
    position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(620px 420px at 88% 8%, rgba(196,181,253,0.10), transparent 65%),
      radial-gradient(620px 420px at 12% 92%, rgba(167,139,250,0.10), transparent 65%);
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
  /* 2026-05-19 (revision 4) — Itzik flagged that the panel was in
     wine/rose (rgba 244,114,128 at the bottom + wine shadow) while
     the section background just shifted to lavender. Two palettes
     fighting on the same surface. UX/UI fix: panel is now a neutral
     ELEVATED CARD — white top, warm-neutral middle, soft lavender
     bottom that pulls FROM the section background, not from a
     separate accent. Shadow recoloured violet to match. This creates
     one cohesive surface: outer lavender → panel that fades into
     the same lavender at its edge → content reads on white. */
  .mood-timeline .js-stops-panel{
    max-width:640px;
    margin:0 auto;
    background:linear-gradient(180deg,
      rgba(255,255,255,0.96) 0%,
      rgba(252,250,253,0.92) 50%,
      rgba(243,236,250,0.85) 100%);
    border:1px solid rgba(255,255,255,0.75);
    border-radius:28px;
    box-shadow:
      0 32px 64px -36px rgba(124,58,237,0.20),
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
    /* 2026-06-09 — bumped 12→14px and 600→700 weight per Itzik. */
    font-size:14px;font-weight:700;letter-spacing:0.18em;
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
    margin-top:-4px;
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
    font-weight:600;
  }
  .mood-timeline .js-stop-block{margin-bottom:16px}
  .mood-timeline .js-stop-block-title{
    /* 2026-06-09 — labels bumped 11→14 per Itzik. */
    font-size:14px;font-weight:700;letter-spacing:0.18em;
    text-transform:uppercase;color:#170E14;
    margin-bottom:5px;
  }
  .mood-timeline .js-stop-block-body{
    /* 2026-06-09 — body bumped 19→20 per Itzik. */
    font-size:20px;line-height:1.55;color:#170E14;
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
  /* C2.4: subtle billed-monthly transparency line under the weekly price. */
  .mood-timeline .js-stop-price-billed{
    margin-top:3px;
    font-size:12px;color:#9C8B91;font-weight:500;
    line-height:1.3;
  }
  /* Stage-3 "חיסכון X%" — prominent maroon, matching the results page
     (.ar-opt-save: 800 / #7A1F2B). Sits at the end of the price row. */
  .mood-timeline .js-stop-price-save{
    font-family:'Frank Ruhl Libre',serif;
    font-size:18px;font-weight:800;color:#7A1F2B;
    line-height:1;
  }
  /* Stage-3 billed line — larger + darker than the Stage-1 transparency line,
     consistent with the results-page sub-note (.ar-opt-note: 18px / #4B4640). */
  .mood-timeline .js-stop3-billed{
    font-size:18px;color:#4B4640;font-weight:500;
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
    /* 2026-06-09 — CTA text bumped 15→20 per Itzik. */
    font-size:20px;font-weight:600;
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
    .mood-timeline .js-stop-block-title{font-size:14px;letter-spacing:0.16em}

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
