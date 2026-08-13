"use client";

/**
 * Chapter navigation for /he/research.
 *
 * One component, two shapes, chosen by CSS at 1180px:
 *
 *   rail (desktop) — the whole index is always visible beside the article,
 *                    sticky within it.
 *   index (mobile) — a collapsed sticky row naming the current chapter, which
 *                    expands into the same vertical index as an OVERLAY.
 *
 * The mobile shape was a horizontally scrolling chip carousel until 2026-08-13.
 * It is now a page index, so the two shapes show the same thing at the same
 * size and only their packaging differs. The horizontal auto-centering that the
 * carousel needed is gone: nothing scrolls sideways any more.
 *
 * Scrolling behaviour, unchanged from the carousel:
 *
 * - Position comes from `getBoundingClientRect()` rather than `offsetTop`. The
 *   mockup's sections were direct children of the document, so the two agreed;
 *   inside the app the article sits in several positioned wrappers and
 *   `offsetTop` would be measured against the nearest of them.
 * - Anchor activation is intercepted so the jump can be smooth without setting
 *   `scroll-behavior: smooth` on `html`, which the mockup could do and a scoped
 *   page cannot. `scrollIntoView` honours `scroll-margin-top`, so the sticky
 *   stack is cleared exactly as the CSS declares it.
 * - `prefers-reduced-motion` disables the smooth jump.
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
];

const PANEL_ID = "research-toc-panel";

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
 * are `position: sticky`, so position alone cannot tell them apart.
 */
function tocMode(nav: HTMLElement | null): "index" | "rail" {
  if (!nav) return "index";
  return getComputedStyle(nav).getPropertyValue("--toc-mode").trim() === "rail"
    ? "rail"
    : "index";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Height of everything pinned to the top of the viewport, measured rather than
 * hardcoded.
 *
 * An earlier build assumed SiteHeader was exactly 64px below `sm` and 72px
 * above it. On the preview it measured 69px at 390px wide and 73px at 320px,
 * because the header's contents wrap. Every anchor then landed short and the
 * heading sat under the bar. Constants cannot track a header that reflows, so
 * this reads the real thing.
 *
 * `offsetHeight` rather than `getBoundingClientRect().bottom`: SiteHeader hides
 * itself on scroll by translating away, and the offset has to stay correct for
 * the case where it is showing.
 *
 * In index mode this measures the COLLAPSED ROW only. The expanded panel is
 * absolutely positioned, so it never contributes height and the anchor offset
 * does not change when the index opens.
 */
function measureStack(nav: HTMLElement | null, row: HTMLElement | null): number {
  if (typeof document === "undefined") return FALLBACK_STACK_PX;

  const header = findStickyHeader();
  const headerH = header ? header.offsetHeight : 0;

  // In rail mode the nav sits BESIDE the column, so it occupies no vertical
  // space and must not be added to the anchor offset.
  const rowH = nav && tocMode(nav) === "index" && row ? row.offsetHeight : 0;

  const stack = headerH + rowH;
  return stack > 0 ? stack : FALLBACK_STACK_PX;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chev} ${open ? styles.chevOpen : ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ResearchToc() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const stackRef = useRef(FALLBACK_STACK_PX);

  // ── Publish the measured sticky stack for scroll-margin-top ──────────────
  // Written onto the page root, not :root, so the variable cannot be read by
  // anything outside this article.
  useEffect(() => {
    const nav = navRef.current;
    const root = nav?.closest<HTMLElement>("[data-research-root]") ?? null;

    const sync = () => {
      const stack = measureStack(nav, rowRef.current);
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
    const header = findStickyHeader();
    if (ro && header) ro.observe(header);
    if (ro && rowRef.current) ro.observe(rowRef.current);

    return () => {
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      root?.style.removeProperty("--research-stack");
      root?.style.removeProperty("--research-header-h");
    };
  }, []);

  // ── Follow the header's visible edge ─────────────────────────────────────
  /*
   * SiteHeader hides itself on scroll by translating up, but it keeps its box
   * in the layout. Pinning the collapsed row to that layout height therefore
   * left a transparent strip between the top of the screen and the row, with
   * article text scrolling through it.
   *
   * The fix is to track where the header actually IS: its rect bottom, clamped
   * at zero. While it is showing the row sits flush beneath it, and once it has
   * translated away the row sits at the top of the screen.
   *
   * The header animates over ~300ms, and scroll events stop firing the moment
   * the finger lifts, so sampling on scroll alone would freeze the row
   * mid-animation and reopen the gap. After every scroll burst the sampler
   * therefore keeps running until the value settles, which is what makes the
   * row travel WITH the header rather than jump after it.
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

  // ── Close the index: outside pointer, Escape ─────────────────────────────
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const nav = navRef.current;
      if (nav && e.target instanceof Node && !nav.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rowRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const goTo = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) return; // let the browser handle it
      event.preventDefault();
      setOpen(false);
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      // Keep the URL shareable without triggering a second, un-offset jump.
      window.history.replaceState(null, "", `#${id}`);
    },
    [],
  );

  // Above the first chapter there is no current section yet; the row names the
  // one the reader is about to reach rather than sitting empty.
  const currentLabel =
    CHAPTERS[activeIndex >= 0 ? activeIndex : 0]?.label ?? CHAPTERS[0].label;

  return (
    <nav
      ref={navRef}
      className={styles.toc}
      aria-label="ניווט בפרקי המחקר"
      data-open={open ? "true" : "false"}
    >
      {/* Collapsed row — index mode only; CSS hides it in rail mode. */}
      <button
        ref={rowRef}
        type="button"
        className={styles.tocToggle}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.tocLabel}>בתוך המחקר</span>
        <span className={styles.tocCurrent}>{currentLabel}</span>
        <Chevron open={open} />
      </button>

      {/* The index itself. In rail mode this is the whole component and is
          always visible; in index mode it overlays the article when open, so
          expanding never shifts the page. */}
      {/* Closed in index mode the panel is `display: none` in CSS, which takes
          its links out of the tab order for free. Driving `tabIndex` from
          `open` would have been wrong: the rail is never "open", so it would
          have made the entire desktop index unfocusable. */}
      <div
        id={PANEL_ID}
        className={styles.tocPanel}
        data-open={open ? "true" : "false"}
      >
        <div className={styles.tocTitle}>בתוך המחקר</div>
        {CHAPTERS.map((chapter, i) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={i === activeIndex ? styles.active : undefined}
            aria-current={i === activeIndex ? "true" : undefined}
            onClick={(e) => goTo(e, chapter.id)}
          >
            {chapter.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
