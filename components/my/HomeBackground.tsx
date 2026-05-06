/**
 * Animated dark backdrop for /my - same purple ↔ rose converging-blob
 * language as the HomepageV2 hero so the post-login surface reads as
 * "your premium home" rather than a separate visual world.
 *
 * Self-contained: the CSS lives in this file under home-bg-* class names
 * (not .hero-* - those are scoped to .home-v2 over in v2/styles.css and
 * we don't want to inherit that whole stylesheet here). The keyframes
 * shipped in this component are independent copies; tweak the hero
 * homepage and /my will not auto-follow, which is intentional -
 * different surfaces, same family.
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
        {/* Converging pair - red top-right, purple bottom-left, 32s synced loop */}
        <div className="home-bg-blob home-bg-blob-1" />
        <div className="home-bg-blob home-bg-blob-2" />

        {/* Ambient secondary blobs for depth */}
        <div className="home-bg-blob home-bg-blob-3" />
        <div className="home-bg-blob home-bg-blob-4" />

        {/* Soft cyan floating orb */}
        <div className="home-bg-floating-circle" />

        {/* 12 wheels-game-style translucent orbit dots */}
        <span className="home-bg-orbit home-bg-orbit-1" />
        <span className="home-bg-orbit home-bg-orbit-2" />
        <span className="home-bg-orbit home-bg-orbit-3" />
        <span className="home-bg-orbit home-bg-orbit-4" />
        <span className="home-bg-orbit home-bg-orbit-5" />
        <span className="home-bg-orbit home-bg-orbit-6" />
        <span className="home-bg-orbit home-bg-orbit-7" />
        <span className="home-bg-orbit home-bg-orbit-8" />
        <span className="home-bg-orbit home-bg-orbit-9" />
        <span className="home-bg-orbit home-bg-orbit-10" />
        <span className="home-bg-orbit home-bg-orbit-11" />
        <span className="home-bg-orbit home-bg-orbit-12" />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS - kept in this file so the component is drop-in. All selectors are
// home-bg- prefixed; @keyframes names are home-bg-* so they don't collide
// with the homepage hero's hero-* keyframes.
// ─────────────────────────────────────────────────────────────────────────────

const HOME_BG_CSS = `
  /* Converging blobs - red top-right ↔ purple bottom-left.
     Durations chosen to feel "ambient" rather than "moving" - slow enough
     that the user reads the bg as atmosphere on focus-heavy pages
     (assessment, timeline) without it pulling attention. */
  .home-bg-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.78;mix-blend-mode:screen;will-change:transform}
  .home-bg-blob-1{width:680px;height:680px;background:radial-gradient(circle,#F43F5E 0%,rgba(244,63,94,0) 70%);top:-180px;right:-120px;animation:home-bg-converge-1 64s ease-in-out infinite}
  .home-bg-blob-2{width:560px;height:560px;background:radial-gradient(circle,#A855F7 0%,rgba(168,85,247,0) 70%);bottom:-120px;left:5%;animation:home-bg-converge-2 64s ease-in-out infinite}
  .home-bg-blob-3{width:440px;height:440px;background:radial-gradient(circle,#EC4899 0%,rgba(236,72,153,0) 70%);top:25%;left:35%;animation:home-bg-drift-3 60s ease-in-out infinite}
  .home-bg-blob-4{width:380px;height:380px;background:radial-gradient(circle,#7C3AED 0%,rgba(124,58,237,0) 70%);bottom:15%;right:25%;animation:home-bg-drift-4 72s ease-in-out infinite}

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
  @keyframes home-bg-drift-4 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(-110px,50px) scale(1.2); }
  }

  /* Floating circle - cyan-tinted, slow ambient drift */
  .home-bg-floating-circle{
    position:absolute;width:160px;height:160px;left:60%;top:30%;
    border-radius:50%;
    background:radial-gradient(circle,rgba(255,255,255,0) 50%,#A855F7 100%);
    filter:blur(24px);opacity:0.65;
    animation:home-bg-floating 36s ease-in-out infinite;
  }
  @keyframes home-bg-floating {
    0%,100% { transform: translate(0,0) scale(1); }
    20%      { transform: translate(-60px, 80px) scale(1.12); }
    40%      { transform: translate(80px, 120px) scale(0.92); }
    60%      { transform: translate(120px, -60px) scale(1.15); }
    80%      { transform: translate(-40px, -80px) scale(1.08); }
  }

  /* 12 small translucent orbit dots - durations roughly doubled vs first
     pass. Still drifting, but slow enough that you don't catch any of
     them mid-flight while reading. */
  .home-bg-orbit{position:absolute;border-radius:50%;z-index:2;pointer-events:none;will-change:transform,opacity;opacity:0.5}
  .home-bg-orbit-1 {width:10px;height:10px;left:12%;top:22%;background:radial-gradient(circle,rgba(244,114,182,0.85) 0%,rgba(244,114,182,0) 70%);box-shadow:0 0 14px 2px rgba(244,114,182,0.45);animation:home-bg-orbit-a 24s ease-in-out infinite}
  .home-bg-orbit-2 {width:7px;height:7px;left:24%;top:68%;background:radial-gradient(circle,rgba(167,139,250,0.85) 0%,rgba(167,139,250,0) 70%);box-shadow:0 0 12px 2px rgba(167,139,250,0.4);animation:home-bg-orbit-b 30s ease-in-out infinite;animation-delay:.6s}
  .home-bg-orbit-3 {width:12px;height:12px;left:38%;top:18%;background:radial-gradient(circle,rgba(244,63,94,0.8) 0%,rgba(244,63,94,0) 70%);box-shadow:0 0 16px 3px rgba(244,63,94,0.4);animation:home-bg-orbit-c 28s ease-in-out infinite;animation-delay:1.2s}
  .home-bg-orbit-4 {width:6px;height:6px;left:48%;top:74%;background:radial-gradient(circle,rgba(251,191,36,0.85) 0%,rgba(251,191,36,0) 70%);box-shadow:0 0 10px 2px rgba(251,191,36,0.4);animation:home-bg-orbit-d 34s ease-in-out infinite;animation-delay:2s}
  .home-bg-orbit-5 {width:9px;height:9px;left:62%;top:30%;background:radial-gradient(circle,rgba(236,72,153,0.85) 0%,rgba(236,72,153,0) 70%);box-shadow:0 0 14px 2px rgba(236,72,153,0.4);animation:home-bg-orbit-e 26s ease-in-out infinite;animation-delay:.4s}
  .home-bg-orbit-6 {width:8px;height:8px;left:74%;top:66%;background:radial-gradient(circle,rgba(192,132,252,0.85) 0%,rgba(192,132,252,0) 70%);box-shadow:0 0 12px 2px rgba(192,132,252,0.4);animation:home-bg-orbit-a 32s ease-in-out infinite;animation-delay:1.8s}
  .home-bg-orbit-7 {width:11px;height:11px;left:86%;top:24%;background:radial-gradient(circle,rgba(251,113,133,0.85) 0%,rgba(251,113,133,0) 70%);box-shadow:0 0 16px 3px rgba(251,113,133,0.4);animation:home-bg-orbit-b 28s ease-in-out infinite;animation-delay:2.6s}
  .home-bg-orbit-8 {width:7px;height:7px;left:18%;top:46%;background:radial-gradient(circle,rgba(240,171,252,0.85) 0%,rgba(240,171,252,0) 70%);box-shadow:0 0 10px 2px rgba(240,171,252,0.4);animation:home-bg-orbit-c 36s ease-in-out infinite;animation-delay:.9s}
  .home-bg-orbit-9 {width:10px;height:10px;left:54%;top:54%;background:radial-gradient(circle,rgba(253,164,175,0.85) 0%,rgba(253,164,175,0) 70%);box-shadow:0 0 14px 2px rgba(253,164,175,0.4);animation:home-bg-orbit-d 30s ease-in-out infinite;animation-delay:3.1s}
  .home-bg-orbit-10{width:8px;height:8px;left:80%;top:48%;background:radial-gradient(circle,rgba(168,85,247,0.85) 0%,rgba(168,85,247,0) 70%);box-shadow:0 0 12px 2px rgba(168,85,247,0.4);animation:home-bg-orbit-e 32s ease-in-out infinite;animation-delay:1.4s}
  .home-bg-orbit-11{width:6px;height:6px;left:30%;top:38%;background:radial-gradient(circle,rgba(249,168,212,0.85) 0%,rgba(249,168,212,0) 70%);box-shadow:0 0 10px 2px rgba(249,168,212,0.4);animation:home-bg-orbit-a 26s ease-in-out infinite;animation-delay:2.2s}
  .home-bg-orbit-12{width:9px;height:9px;left:68%;top:8%;background:radial-gradient(circle,rgba(252,165,165,0.85) 0%,rgba(252,165,165,0) 70%);box-shadow:0 0 16px 3px rgba(252,165,165,0.4);animation:home-bg-orbit-b 30s ease-in-out infinite;animation-delay:.3s}

  @keyframes home-bg-orbit-a{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(60px,-90px);opacity:1}}
  @keyframes home-bg-orbit-b{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(-80px,60px);opacity:1}}
  @keyframes home-bg-orbit-c{0%,100%{transform:translate(0,0);opacity:.3}33%{transform:translate(90px,40px);opacity:.9}66%{transform:translate(-50px,-70px);opacity:1}}
  @keyframes home-bg-orbit-d{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(-70px,-100px);opacity:1}}
  @keyframes home-bg-orbit-e{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(100px,80px);opacity:1}}
`;
