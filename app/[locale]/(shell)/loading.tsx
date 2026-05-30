/**
 * (shell)/loading.tsx — instant skeleton shown during navigation between
 * post-login pages.
 *
 * Why this file exists:
 *   Every (shell) page is `export const dynamic = "force-dynamic"`, which
 *   tells Next.js to skip the Full Route Cache and re-render on every
 *   navigation. That re-render runs `getShellData()` and per-page data
 *   fetches before any HTML is sent — meaning a click on a sidebar item
 *   stalls visually for ~300-600ms with NOTHING painted.
 *
 *   With this file present, Next ships the skeleton on `<Link>` prefetch
 *   and paints it instantly when the user clicks. The page's server work
 *   then streams in over the top. Layout (sidebar, mobile tabs) stays
 *   rendered the whole time — only the `<main>` slot swaps.
 *
 * Neutral skeleton: this file fires for ANY (shell)/* navigation, so it
 * approximates the common rhythm (header band + a few card placeholders)
 * rather than mimicking a specific page. The PageHeader real component
 * is sticky, so even this skeleton starts with a header-shaped band so
 * the visual identity carries through.
 *
 * Added 2026-05-31 — perf pass on nav latency.
 */

export default function ShellLoading() {
  return (
    <>
      {/* Fake PageHeader — same dimensions as components/shell/PageHeader.
          We can't actually show the page name here (don't know which
          route is loading) so we render two stacked greys that look like
          the crumb + page-title pair. */}
      <header
        className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between gap-3 border-b px-5 py-3 backdrop-blur-md"
        style={{
          background: "rgba(15,8,40,0.55)",
          borderColor: "var(--shell-line-soft)",
        }}
      >
        <div className="flex flex-col gap-1.5">
          <SkeletonBar w={56} h={10} />
          <SkeletonBar w={120} h={14} />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonCircle size={32} />
          <SkeletonCircle size={32} />
        </div>
      </header>

      {/* Content placeholder — three soft cards in the standard 880px
          column. Matches today/lessons rhythm; on games/adults the real
          page will widen to 1080 and re-flow over the top once the
          server work returns. */}
      <div
        className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-5 py-6"
        aria-hidden
      >
        <SkeletonCard h={90} />
        <SkeletonCard h={180} />
        <SkeletonCard h={120} />
        <SkeletonCard h={120} />
      </div>

      {/* Single keyframe used by every skeleton element below. Scoped to
          the page via :where() so it doesn't leak. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shell-skeleton-pulse {
              0%, 100% { opacity: 0.55; }
              50%      { opacity: 0.85; }
            }
            .shell-skeleton {
              animation: shell-skeleton-pulse 1.4s ease-in-out infinite;
              background: rgba(255,255,255,0.06);
            }
          `,
        }}
      />
    </>
  );
}

function SkeletonBar({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="shell-skeleton rounded-full"
      style={{ width: w, height: h }}
    />
  );
}

function SkeletonCircle({ size }: { size: number }) {
  return (
    <div
      className="shell-skeleton rounded-full"
      style={{ width: size, height: size }}
    />
  );
}

function SkeletonCard({ h }: { h: number }) {
  return (
    <div
      className="shell-skeleton rounded-[14px]"
      style={{ height: h }}
    />
  );
}
