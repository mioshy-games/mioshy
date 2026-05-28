/**
 * Animated dark backdrop for /my and every other authed page.
 *
 * Itzik 2026-05-27 PERFORMANCE REBUILD:
 *   Was 17 simultaneous animated layers (4 blobs + 1 floating circle +
 *   12 orbit dots) and the user reported the page felt heavy. Now
 *   matches the public homepage hero (`components/marketing/v2/Hero.tsx`)
 *   exactly: 3 blobs + 1 floating circle = 4 animated layers. The 12
 *   orbit dots are removed entirely (the same cut was applied to the
 *   homepage hero on 2026-05-19; this brings the authed surface in
 *   line). Visual language preserved — same purple ↔ rose converging
 *   blob family — just at 24% of the previous animation budget.
 *
 * Self-contained: the CSS lives in this file under home-bg-* class
 * names (not .hero-* — those are scoped to .home-v2 in v2/styles.css
 * and we don't want to inherit that whole stylesheet here). Keyframes
 * are independent copies; tweak the hero homepage and /my will NOT
 * auto-follow, which is intentional — different surfaces, same family.
 *
 * Server component (no JS). RTL-agnostic; layout is purely transform-based.
 */
export function HomeBackground() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: HOME_BG_CSS,
        }}
      />
      {/* fixed positioning + inset-0 + 100vw width = backdrop is locked to
          the viewport. Horizontal-scroll lines (e.g. mobile keyboards) and
          long pages can't drag it. Only the content above scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#0E0810] via-[#150812] to-[#0a0610]"
      >
        {/* Converging pair — red top-right, purple bottom-left, 64s synced loop */}
        <div className="home-bg-blob home-bg-blob-1" />
        <div className="home-bg-blob home-bg-blob-2" />

        {/* Single ambient pink blob for depth (was 2 — blob-4 removed in
            the 2026-05-27 perf rebuild to match the homepage hero). */}
        <div className="home-bg-blob home-bg-blob-3" />

        {/* Soft floating ring */}
        <div className="home-bg-floating-circle" />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — kept in this file so the component is drop-in. All selectors are
// home-bg- prefixed; @keyframes names are home-bg-* so they don't collide
// with the homepage hero's hero-* keyframes. The orbit-dot rules and
// blob-4 were removed in the 2026-05-27 perf rebuild; see component
// docstring for the rationale.
// ─────────────────────────────────────────────────────────────────────────────

const HOME_BG_CSS = `
  /* Converging blobs — red top-right ↔ purple bottom-left.
     Durations chosen to feel "ambient" rather than "moving" — slow enough
     that the user reads the bg as atmosphere on focus-heavy pages
     (assessment, timeline) without it pulling attention.
     PERF 2026-05-19 — filter:blur(70px) removed entirely. Radial
     gradient stops softened with a mid stop at 35% so the edge stays
     feathered. This component is mounted on EVERY authed page
     (dashboard, journey, my, …) — dropping the blur shader frees GPU
     time across the whole authed app. Same pattern used on the homepage. */
  .home-bg-blob{position:absolute;border-radius:50%;opacity:0.78}
  .home-bg-blob-1{width:680px;height:680px;background:radial-gradient(circle,#F43F5E 0%,rgba(244,63,94,0.45) 35%,rgba(244,63,94,0) 75%);top:-180px;right:-120px;animation:home-bg-converge-1 64s ease-in-out infinite}
  .home-bg-blob-2{width:560px;height:560px;background:radial-gradient(circle,#A855F7 0%,rgba(168,85,247,0.45) 35%,rgba(168,85,247,0) 75%);bottom:-120px;left:5%;animation:home-bg-converge-2 64s ease-in-out infinite}
  .home-bg-blob-3{width:440px;height:440px;background:radial-gradient(circle,#EC4899 0%,rgba(236,72,153,0.45) 35%,rgba(236,72,153,0) 75%);top:25%;left:35%;animation:home-bg-drift-3 60s ease-in-out infinite}

  @keyframes home-bg-converge-1 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(-340px, 220px) scale(1.25); }
  }
  @keyframes home-bg-converge-2 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(340px, -220px) scale(1.22); }
  }
  @keyframes home-bg-drift-3 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(120px,-90px) scale(0.9); }
    66%      { transform: translate(-50px,80px) scale(1.05); }
  }

  /* Floating circle — PERF 2026-05-19 dropped filter:blur(24px).
     Gradient inverted into a soft ring (transparent core → violet
     edge → transparent outside) so the visual reads as a soft glow
     without the blur shader. Same trick used on .hero-floating-circle. */
  .home-bg-floating-circle{
    position:absolute;width:160px;height:160px;left:60%;top:30%;
    border-radius:50%;
    background:radial-gradient(circle,rgba(168,85,247,0) 30%,rgba(168,85,247,0.55) 70%,rgba(168,85,247,0) 100%);
    opacity:0.65;
    animation:home-bg-floating 36s ease-in-out infinite;
  }
  @keyframes home-bg-floating {
    0%,100% { transform: translate(0,0) scale(1); }
    20%      { transform: translate(-60px, 80px) scale(1.12); }
    40%      { transform: translate(80px, 120px) scale(0.92); }
    60%      { transform: translate(120px, -60px) scale(1.15); }
    80%      { transform: translate(-40px, -80px) scale(1.08); }
  }
`;
