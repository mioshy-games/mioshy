import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — Mioshy",
  robots: { index: false, follow: false },
};

// Pixel-art style decoration — pure CSS, no images needed
function PixelDeco({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none font-mono text-purple-500/20 leading-none ${className ?? ""}`}
      style={{ fontSize: "clamp(8px, 1.5vw, 14px)", letterSpacing: "0.05em" }}
    >
      {[
        "░░░▓▓▓░░░░░░░▓▓▓░░░",
        "░░▓▓▓▓▓░░░░▓▓▓▓▓░░░",
        "░▓▓▓▓▓▓▓░░▓▓▓▓▓▓▓░░",
        "░▓░░▓░░▓░░▓░░▓░░▓░░",
        "░▓▓▓▓▓▓▓░░▓▓▓▓▓▓▓░░",
        "░░░▓░▓░░░░░░▓░▓░░░░",
        "░░▓▓░░▓▓░░▓▓░░▓▓░░░",
      ].map((row, i) => (
        <div key={i}>{row}</div>
      ))}
    </div>
  );
}

export default function NotFound() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#07040f] text-white">

      {/* ── Ambient glows ─────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(139,92,246,0.25) 0%, transparent 70%), " +
            "radial-gradient(ellipse 40% 30% at 80% 80%, rgba(236,72,153,0.15) 0%, transparent 60%)",
        }}
      />

      {/* ── Pixel decorations (corners) ─────────────────────────────── */}
      <PixelDeco className="absolute top-10 left-8 rotate-0 hidden sm:block" />
      <PixelDeco className="absolute top-10 right-8 scale-x-[-1] hidden sm:block" />
      <PixelDeco className="absolute bottom-28 left-8 scale-y-[-1] hidden sm:block" />

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-4 py-20 text-center">

        {/* Chip */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-900/30 px-5 py-2 text-sm font-semibold text-purple-300 backdrop-blur-md">
          <span className="text-lg">🎮</span>
          <span className="tracking-widest">LEVEL NOT FOUND</span>
        </div>

        {/* Big glitch 404 */}
        <div className="relative mb-4 select-none">
          <p
            className="font-heading text-[clamp(6rem,22vw,14rem)] font-black leading-none tracking-tighter"
            style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #e879f9 45%, #f472b6 80%, #fb923c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 40px rgba(168,85,247,0.45))",
            }}
          >
            404
          </p>
          {/* Scanline overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
            }}
          />
        </div>

        {/* Hebrew + English headlines */}
        <h1 className="max-w-lg text-balance text-2xl font-bold text-white sm:text-3xl">
          העמוד הזה נעלם ב&shy;רמה אחרת
        </h1>
        <p className="mt-2 max-w-lg text-balance text-base text-white/55 sm:text-lg">
          This level doesn't exist. Let's get you back to the fun.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/he"
            className="group relative inline-flex min-h-[56px] w-full items-center justify-center overflow-hidden rounded-full px-8 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110 sm:w-auto"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500"
            />
            <span className="relative z-10 flex items-center gap-2">
              🏠 חזרה לדף הבית
            </span>
          </Link>

          <Link
            href="/he/games"
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-8 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-purple-400/50 hover:bg-purple-500/20 sm:w-auto"
          >
            🎮 כל המשחקים
          </Link>
        </div>

        {/* Small English fallback */}
        <p className="mt-6 text-sm text-white/25">
          or{" "}
          <Link href="/en" className="underline underline-offset-2 hover:text-white/50 transition-colors">
            go to English homepage
          </Link>
        </p>

      </main>
    </div>
  );
}
