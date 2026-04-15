import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Mioshy",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-[var(--mio-bg)] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="mb-4 inline-flex rounded-full border border-purple-500/20 bg-[var(--mio-card)] px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur-md">
          404
        </p>
        <h1 className="font-heading text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
            Page not found
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-lg text-white/75">
          This link doesn’t exist anymore. Let’s get you back to the fun.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/en"
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-8 py-4 text-base font-semibold text-white transition hover:brightness-110 sm:w-auto"
          >
            Go to homepage
          </Link>
          <Link
            href="/en/products"
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-purple-400/50 hover:bg-purple-500/20 sm:w-auto"
          >
            Browse games
          </Link>
        </div>
      </div>
    </div>
  );
}

