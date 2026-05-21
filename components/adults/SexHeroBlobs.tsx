/**
 * SexHeroBlobs — the three drifting gradient blobs that paint the
 * /mioshy-sex hero atmosphere.
 *
 * Why a shared component
 * ──────────────────────
 * The catalogue page (/mioshy-sex) and every product detail page
 * (/mioshy-sex/[slug]) need the same blob field so the entire
 * "after-dark room" feels like one continuous surface as the visitor
 * navigates between them. Defining the blobs once and importing here
 * keeps positions, palette, and animation timing identical across
 * routes — a single edit propagates everywhere.
 *
 * Composition — the "dance"
 * ─────────────────────────
 * Per Itzik 2026-05-20: blobs must read as a duo/trio interacting,
 * not three lonely smudges in opposite corners. Sizes shrunk and
 * positions pulled toward the upper-mid axis so all three overlap in
 * the same region. The animation paths converge near the middle of
 * each cycle — the rose blob drifts down-right, the violet blob
 * up-left, and the pink blob orbits between them. Net effect: three
 * dancers passing through each other near centre, then drifting
 * back, then meeting again.
 *
 * Performance
 * ───────────
 * Server-rendered. Pure CSS — transform-only animations on positioned
 * divs, compositor-cheap. Gradient terminal stops fade to the page
 * background colour (#070111) so the blobs dissolve into the dark
 * plate with no halo edge. `prefers-reduced-motion: reduce` freezes
 * all three.
 */

export function SexHeroBlobs({ isHe }: { isHe: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[140dvh] overflow-hidden"
      >
        <div className="sx-blob sx-blob-1" />
        <div className="sx-blob sx-blob-2" />
        <div className="sx-blob sx-blob-3" />
      </div>

      {/* Static SVG film-grain overlay so the dark plate never bands. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.42 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sx-blob { position: absolute; border-radius: 50%; opacity: 0.78; }

            /* All three blobs now anchor to the LOWER-LEFT region of
               the hero (in RTL — lower-right in LTR), beneath/around
               the product cover image. Per Itzik 2026-05-20: moved
               from the upper-mid axis to where the visitor's eye
               actually lingers — the image side of the page. Sizes
               + trajectories preserved so the "dance" reads the
               same. */

            .sx-blob-1 {
              width: 560px; height: 560px;
              bottom: -160px; ${isHe ? "left: 8%" : "right: 8%"};
              background: radial-gradient(circle, #F43F5E 0%, rgba(244,63,94,0.5) 26%, rgba(110,18,46,0.22) 52%, rgba(35,8,22,0.08) 78%, rgba(7,1,17,0) 96%);
              animation: sx-blob-1-dance 22s ease-in-out infinite;
            }

            .sx-blob-2 {
              width: 520px; height: 520px;
              bottom: -60px; ${isHe ? "left: 28%" : "right: 28%"};
              background: radial-gradient(circle, #A21CAF 0%, rgba(162,28,175,0.5) 26%, rgba(80,16,90,0.22) 52%, rgba(28,8,40,0.08) 78%, rgba(7,1,17,0) 96%);
              animation: sx-blob-2-dance 26s ease-in-out infinite;
            }

            .sx-blob-3 {
              width: 480px; height: 480px;
              bottom: -40px; ${isHe ? "left: 18%" : "right: 18%"};
              background: radial-gradient(circle, #EC4899 0%, rgba(236,72,153,0.5) 26%, rgba(120,30,76,0.20) 52%, rgba(28,8,40,0.08) 78%, rgba(7,1,17,0) 96%);
              animation: sx-blob-3-orbit 20s ease-in-out infinite;
              opacity: 0.62;
            }

            /* Dance choreography — blobs converge near 50% of each
               cycle, then drift apart, then meet again. Travel
               distances are intentionally small (±70-90px) so the
               whole motion stays within a tight neighbourhood of the
               anchor — the trio reads as connected. */
            @keyframes sx-blob-1-dance {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
              50%      { transform: translate3d(${isHe ? "70px" : "-70px"}, 60px, 0) scale(1.08); }
            }
            @keyframes sx-blob-2-dance {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
              50%      { transform: translate3d(${isHe ? "-80px" : "80px"}, -50px, 0) scale(1.08); }
            }
            @keyframes sx-blob-3-orbit {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
              33%      { transform: translate3d(40px, -30px, 0) scale(1.06); }
              66%      { transform: translate3d(-30px, 40px, 0) scale(0.96); }
            }

            @media (prefers-reduced-motion: reduce) {
              .sx-blob-1, .sx-blob-2, .sx-blob-3 { animation: none !important; }
            }
          `,
        }}
      />
    </>
  );
}
