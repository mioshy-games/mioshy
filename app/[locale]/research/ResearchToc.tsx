"use client";

/**
 * Chapter navigation for /he/research.
 *
 * One component drives both modes the mockup specifies, because they are the
 * same element at different breakpoints: a horizontally scrolling chip bar that
 * sticks under the header on narrow screens, and a fixed rail floating to the
 * right of the column from 1180px. The CSS decides which; this file only owns
 * the active state.
 *
 * Ported from the inline script in docs/research-page-mockup.html, with three
 * changes:
 *
 * - Scroll position comes from `getBoundingClientRect()` rather than
 *   `offsetTop`. The mockup's sections were direct children of the document, so
 *   the two agreed; inside the app the article sits in several positioned
 *   wrappers and `offsetTop` would be measured against the nearest of them.
 * - Anchor clicks are intercepted so the jump can be smooth without setting
 *   `scroll-behavior: smooth` on `html`, which the mockup could do and a scoped
 *   page cannot. `scrollIntoView` honours the section's `scroll-margin-top`, so
 *   the sticky stack is cleared exactly as the CSS declares it.
 * - `prefers-reduced-motion` disables both the smooth jump and the chip-bar
 *   auto-centering.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./research.module.css";

interface Chapter {
  id: string;
  label: string;
}

/** Copy is frozen — these labels are verbatim from the mockup's nav. */
const CHAPTERS: Chapter[] = [
  { id: "finding-passion", label: "התשוקה היא החוסר" },
  { id: "paradox", label: "הפרדוקס של התקשורת" },
  { id: "rituals", label: "הרגעים הקבועים" },
  { id: "appreciation", label: "כוחה של מילה טובה" },
  { id: "who", label: "מי השתתף" },
  { id: "share", label: "שיתוף וציטוט" },
  { id: "method", label: "איך נעשה המחקר" },
  { id: "faq", label: "שאלות ותשובות" },
];

/** Distance from the document bottom at which the last chapter always wins. */
const BOTTOM_SNAP_PX = 40;

/** Breathing room between the sticky stack and the heading that lands under it. */
const CLEARANCE_PX = 12;

/** How far below the sticky stack a heading must be to count as current. */
const ACTIVE_LINE_SLACK_PX = 40;

/**
 * Fallback used before the first measurement and if the header cannot be found.
 * Matches the `--research-stack` default in research.module.css.
 */
const FALLBACK_STACK_PX = 130;

/**
 * Height of everything pinned to the top of the viewport, measured rather than
 * hardcoded.
 *
 * The first build assumed SiteHeader was exactly 64px below `sm` and 72px above
 * it. On the preview it measured 69px at 390px wide and 73px at 320px, because
 * the header's contents wrap. Every anchor then landed 12px short and the
 * heading sat under the chip bar. Constants cannot track a header that reflows,
 * so this reads the real thing.
 *
 * `offsetHeight` rather than `getBoundingClientRect().bottom`: SiteHeader hides
 * itself on scroll by translating away, and the offset has to stay correct for
 * the case where it is showing.
 */
/** The app's own sticky header, or null if this page renders without chrome. */
function findStickyHeader(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    Array.from(document.querySelectorAll("header")).find((el) => {
      const pos = getComputedStyle(el).position;
      return pos === "sticky" || pos === "fixed";
    }) ?? null
  );
}

/**
 * Which shape the nav is currently in.
 *
 * Read from the `--toc-mode` custom property rather than a `matchMedia` call so
 * the 1180px breakpoint is declared exactly once, in the stylesheet. Both modes
 * are `position: sticky` now, so position alone can no longer tell them apart.
 */
function tocMode(nav: HTMLElement | null): "bar" | "rail" {
  if (!nav) return "bar";
  return getComputedStyle(nav).getPropertyValue("--toc-mode").trim() === "rail"
    ? "rail"
    : "bar";
}

function measureStack(nav: HTMLElement | null): number {
  if (typeof document === "undefined") return FALLBACK_STACK_PX;

  const header = findStickyHeader();
  const headerH = header ? header.offsetHeight : 0;

  // In rail mode the nav sits BESIDE the column, so it occupies no vertical
  // space and must not be added to the anchor offset. Before the rail became
  // sticky this was a position check; it is now a mode check, because sticky
  // no longer distinguishes the two.
  const navH = nav && tocMode(nav) === "bar" ? nav.offsetHeight : 0;

  const stack = headerH + navH;
  return stack > 0 ? stack : FALLBACK_STACK_PX;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ResearchToc() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const stackRef = useRef(FALLBACK_STACK_PX);

  // ── Publish the measured sticky stack for scroll-margin-top ──────────────
  // Written onto the page root, not :root, so the variable cannot be read by
  // anything outside this article.
  useEffect(() => {
    const nav = navRef.current;
    const root = nav?.closest<HTMLElement>("[data-research-root]") ?? null;

    const sync = () => {
      const stack = measureStack(nav);
      stackRef.current = stack;
      root?.style.setProperty("--research-stack", `${stack + CLEARANCE_PX}px`);

      const header = findStickyHeader();
      root?.style.setProperty(
        "--research-header-h",
        `${header ? header.offsetHeight : 0}px`,
      );
    };

    sync();
    window.addEventListener("resize", sync);

    // The header reflows on font load and on hydration of its own contents, so
    // one measurement at mount is not enough.
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    const header = Array.from(document.querySelectorAll("header")).find((el) => {
      const pos = getComputedStyle(el).position;
      return pos === "sticky" || pos === "fixed";
    });
    if (ro && header) ro.observe(header);
    if (ro && nav) ro.observe(nav);

    return () => {
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      root?.style.removeProperty("--research-stack");
    };
  }, []);

  // ── Follow the header's visible edge ─────────────────────────────────────
  /*
   * SiteHeader hides itself on scroll by translating up, but it keeps its box
   * in the layout. Pinning the chip bar to that layout height therefore left a
   * transparent strip between the top of the screen and the bar, with article
   * text scrolling through it.
   *
   * The fix is to track where the header actually IS: its rect bottom, clamped
   * at zero. While it is showing the bar sits flush beneath it, and once it has
   * translated away the bar sits at the top of the screen.
   *
   * The header animates over ~300ms, and scroll events stop firing the moment
   * the finger lifts, so sampling on scroll alone would freeze the bar
   * mid-animation and reopen the gap. After every scroll burst the sampler
   * therefore keeps running until the value settles (or a short cap elapses),
   * which is what makes the bar travel WITH the header rather than jump after
   * it.
   */
  useEffect(() => {
    const nav = navRef.current;
    const root = nav?.closest<HTMLElement>("[data-research-root]") ?? null;
    if (!root) return;

    let raf = 0;
    let settleUntil = 0;
    let last = -1;

    const sample = () => {
      raf = 0;
      const header = findStickyHeader();
      const visible = header
        ? Math.max(0, Math.round(header.getBoundingClientRect().bottom))
        : 0;

      if (visible !== last) {
        last = visible;
        root.style.setProperty("--research-header-visible", `${visible}px`);
        // Value is still moving — keep watching past the end of the scroll.
        settleUntil = performance.now() + 400;
      }

      if (performance.now() < settleUntil) raf = requestAnimationFrame(sample);
    };

    const kick = () => {
      settleUntil = performance.now() + 400;
      if (!raf) raf = requestAnimationFrame(sample);
    };

    sample();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--research-header-visible");
    };
  }, []);

  // ── Scrollspy ────────────────────────────────────────────────────────────
  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;

      const line = stackRef.current + ACTIVE_LINE_SLACK_PX;
      let next = -1;
      for (let i = 0; i < CHAPTERS.length; i++) {
        const el = document.getElementById(CHAPTERS[i].id);
        if (el && el.getBoundingClientRect().top <= line) next = i;
      }

      // At the very bottom the last chapter can be too short to ever cross the
      // line, so it would never light up. Snap to it.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - BOTTOM_SNAP_PX;
      if (atBottom) next = CHAPTERS.length - 1;

      setActiveIndex((prev) => (prev === next ? prev : next));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  // ── Keep the active chip in view on the horizontal bar ───────────────────
  useEffect(() => {
    const nav = navRef.current;
    const link = linkRefs.current[activeIndex];
    if (!nav || !link) return;
    // Only the bar scrolls horizontally; the rail lays out vertically.
    if (tocMode(nav) !== "bar") return;
    if (nav.scrollWidth <= nav.clientWidth + 4) return;

    nav.scrollTo({
      left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [activeIndex]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) return; // let the browser handle it
      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      // Keep the URL shareable without triggering a second, un-offset jump.
      window.history.replaceState(null, "", `#${id}`);
    },
    [],
  );

  return (
    <nav
      ref={navRef}
      className={styles.toc}
      aria-label="ניווט בפרקי המחקר"
    >
      <div className={styles.tocTitle}>בתוך המחקר</div>
      {CHAPTERS.map((chapter, i) => (
        <a
          key={chapter.id}
          ref={(el) => {
            linkRefs.current[i] = el;
          }}
          href={`#${chapter.id}`}
          className={i === activeIndex ? styles.active : undefined}
          aria-current={i === activeIndex ? "true" : undefined}
          onClick={(e) => handleClick(e, chapter.id)}
        >
          {chapter.label}
        </a>
      ))}
    </nav>
  );
}
