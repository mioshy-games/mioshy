import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Full-screen dark backdrop for /auth and /auth/signup.
 *
 * 2026-06-02 PERF REBUILD (Itzik):
 *   Was an 18-particle + 3-animated-blob framer-motion canvas with three
 *   `filter:blur(110-130px)` shaders running concurrently on mount.
 *   That's a substantial GPU bill for what is, by definition, the user's
 *   first visit — the first frame after typing the URL.
 *
 *   This is now a server component (no JS at all) that mirrors the
 *   public homepage hero pattern (components/my/HomeBackground.tsx):
 *     • 3 static radial-gradient blobs (no blur shader, no animation).
 *     • Soft floating ring (single radial-gradient).
 *     • Same colour family as before (purple/rose/fuchsia) so visually
 *       the page still reads as "Mioshy auth".
 *
 *   Removed: 18 floating particles, 3 framer-motion blob animations,
 *   2 vignette overlays, the scanlines texture, and the wrapper opacity
 *   mount fade. Net cost on first frame: ~0. The blobs render in a
 *   single paint pass via radial-gradient with a soft mid-stop, same
 *   trick used everywhere else in the authed app.
 */
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AUTH_BG_CSS }} />

      {/* Fixed background — locked to the viewport so it doesn't shift
          when the mobile keyboard pushes the form. Below z-index 0 so
          the SiteHeader / form / SiteFooter all render above it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#0E0810] via-[#150812] to-[#0a0610]"
      >
        <div className="auth-bg-blob auth-bg-blob-1" />
        <div className="auth-bg-blob auth-bg-blob-2" />
        <div className="auth-bg-blob auth-bg-blob-3" />
        <div className="auth-bg-floating-circle" />
      </div>

      {/* Content shell — same layout as before so the form positions
          unchanged. */}
      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col items-center justify-center px-5 py-14 sm:px-4 sm:py-12">
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSS — same pattern as HomeBackground.tsx, scoped to auth-bg-*.
// Radial-gradient with a soft mid-stop replaces filter:blur(120px) so
// the GPU paints a static layer instead of running a blur shader every
// frame.
// ─────────────────────────────────────────────────────────────────────
const AUTH_BG_CSS = `
  /* All blobs are radial-gradient (no filter:blur — same trick as the
     homepage hero), animated via GPU-only transform keyframes.
     Animations only live on /auth + /auth/signup so the cost is bounded
     to a single visit per session, unlike HomeBackground which is
     mounted on every authed page and therefore stayed static. */
  .auth-bg-blob{position:absolute;border-radius:50%;opacity:0.78;will-change:transform}

  .auth-bg-blob-1{
    width:680px;height:680px;
    background:radial-gradient(circle,#A855F7 0%,rgba(168,85,247,0.45) 35%,rgba(168,85,247,0) 75%);
    top:-180px;left:-120px;
    animation:auth-bg-drift-1 22s ease-in-out infinite;
  }
  .auth-bg-blob-2{
    width:560px;height:560px;
    background:radial-gradient(circle,#F43F5E 0%,rgba(244,63,94,0.45) 35%,rgba(244,63,94,0) 75%);
    bottom:-120px;right:5%;
    animation:auth-bg-drift-2 26s ease-in-out infinite;
  }
  .auth-bg-blob-3{
    width:440px;height:440px;
    background:radial-gradient(circle,#EC4899 0%,rgba(236,72,153,0.45) 35%,rgba(236,72,153,0) 75%);
    top:35%;left:50%;
    animation:auth-bg-drift-3 30s ease-in-out infinite;
  }

  /* Floating accent — was a ring (dark center, bright edge) by mistake.
     Now a proper filled blob: bright indigo center fading outward, same
     gradient shape as the three main blobs. */
  .auth-bg-floating-circle{
    position:absolute;width:200px;height:200px;left:75%;top:25%;
    border-radius:50%;
    background:radial-gradient(circle,#6366F1 0%,rgba(99,102,241,0.45) 35%,rgba(99,102,241,0) 75%);
    opacity:0.72;
    will-change:transform;
    animation:auth-bg-floating 24s ease-in-out infinite;
  }

  @keyframes auth-bg-drift-1 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(180px, 140px) scale(1.12); }
  }
  @keyframes auth-bg-drift-2 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(-200px, -160px) scale(1.10); }
  }
  @keyframes auth-bg-drift-3 {
    0%,100% { transform: translate(-50%,-50%) scale(1); }
    33%     { transform: translate(calc(-50% + 90px), calc(-50% - 70px)) scale(0.92); }
    66%     { transform: translate(calc(-50% - 80px), calc(-50% + 80px)) scale(1.08); }
  }
  @keyframes auth-bg-floating {
    0%,100% { transform: translate(0,0) scale(1); }
    25%     { transform: translate(-70px, 90px) scale(1.1); }
    50%     { transform: translate(90px, 130px) scale(0.95); }
    75%     { transform: translate(120px, -60px) scale(1.15); }
  }

  @media (prefers-reduced-motion: reduce) {
    .auth-bg-blob,.auth-bg-floating-circle { animation: none; }
  }
`;
