/**
 * GamesPageAtmosphere - the page-level dark gradient + drifting blobs +
 * floating glows + 16 orbit dots that wash behind every section of
 * /games (both the marketing return and the authenticated catalog).
 *
 * Lives in its own component so the long inline <style> block isn't
 * duplicated between the two return trees in app/[locale]/games/page.tsx.
 *
 * Mounted as `aria-hidden` non-interactive layers behind the content;
 * the parent wrapper is responsible for `position: relative` and
 * `overflow: hidden` so the blobs don't escape.
 *
 * Mobile: hides ~half of the orbits/glows under 640px to keep the DOM
 * lean. `prefers-reduced-motion` disables every animation here.
 */
export function GamesPageAtmosphere() {
  return (
    <>
      {/* Base dark gradient - full content height. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          background:
            "linear-gradient(180deg,#0E0810 0%,#1A0B14 25%,#1E0F1E 55%,#1A0B14 80%,#0E0810 100%)",
        }}
      />
      {/* Wine-palette radial highlights spread across the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(1100px 600px at 12% 0%, rgba(196,68,86,0.18), transparent 62%), " +
            "radial-gradient(900px 520px at 88% 30%, rgba(139,38,56,0.14), transparent 60%), " +
            "radial-gradient(900px 540px at 18% 65%, rgba(184,60,77,0.12), transparent 60%), " +
            "radial-gradient(800px 500px at 80% 90%, rgba(74,23,33,0.16), transparent 60%)",
        }}
      />
      {/* Drifting blobs + floating glow + 8 orbit dots. Performance:
          orbit count halved (was 16) and one blob/floating-circle pair
          dropped (was 4 blobs + 2 circles) per Itzik 2026-05-06 audit
          — the dense field was a major GPU consumer on /games. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="games-blob games-blob-1" />
        <div className="games-blob games-blob-2" />
        <div className="games-blob games-blob-3" />
        <div className="games-floating-circle games-floating-circle-1" />
        <span className="games-orbit games-orbit-1" />
        <span className="games-orbit games-orbit-2" />
        <span className="games-orbit games-orbit-3" />
        <span className="games-orbit games-orbit-4" />
        <span className="games-orbit games-orbit-5" />
        <span className="games-orbit games-orbit-6" />
        <span className="games-orbit games-orbit-7" />
        <span className="games-orbit games-orbit-8" />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Perf 2026-05-17 — blur 140px→55px and blob dimensions
               trimmed ~30%. blur(140px) on 680² elements was the top
               GPU consumer on this page in Chrome (74% GPU, cursor
               freezes for tens of seconds). Compositor cost scales
               roughly with radius² × area; cutting both gives ~6×
               cheaper paint per frame. The radial-gradient on each
               blob already feathers softly so visually the change is
               near-imperceptible. */
            .games-blob{position:absolute;border-radius:50%;filter:blur(55px);opacity:0.5;pointer-events:none;will-change:transform}
            .games-blob-1{width:480px;height:480px;top:-140px;inset-inline-start:-110px;background:radial-gradient(circle,rgba(184,60,77,0.65) 0%,rgba(184,60,77,0) 70%);animation:games-blob-a 64s ease-in-out infinite}
            .games-blob-2{width:420px;height:420px;top:35%;inset-inline-end:-100px;background:radial-gradient(circle,rgba(139,38,56,0.55) 0%,rgba(139,38,56,0) 70%);animation:games-blob-b 72s ease-in-out infinite}
            .games-blob-3{width:440px;height:440px;bottom:18%;inset-inline-start:-120px;background:radial-gradient(circle,rgba(61,31,61,0.6) 0%,rgba(61,31,61,0) 70%);animation:games-blob-a 60s ease-in-out infinite reverse}
            .games-blob-4{width:400px;height:400px;bottom:-110px;inset-inline-end:-70px;background:radial-gradient(circle,rgba(184,60,77,0.5) 0%,rgba(184,60,77,0) 70%);animation:games-blob-b 68s ease-in-out infinite reverse}
            @keyframes games-blob-a{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(160px,120px) scale(1.08)}}
            @keyframes games-blob-b{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-140px,-100px) scale(1.06)}}

            .games-floating-circle{position:absolute;border-radius:50%;filter:blur(50px);opacity:0.5;pointer-events:none;will-change:transform}
            .games-floating-circle-1{width:240px;height:240px;top:22%;left:48%;background:radial-gradient(circle,rgba(232,131,148,0.45) 0%,rgba(184,60,77,0) 70%);animation:games-fc-a 36s ease-in-out infinite}
            .games-floating-circle-2{width:200px;height:200px;top:72%;left:38%;background:radial-gradient(circle,rgba(245,158,177,0.4) 0%,rgba(184,60,77,0) 70%);animation:games-fc-b 42s ease-in-out infinite}
            @keyframes games-fc-a{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-40px,50px) scale(1.06)}50%{transform:translate(50px,-25px) scale(1.1)}75%{transform:translate(25px,40px) scale(1)}}
            @keyframes games-fc-b{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(35px,-45px) scale(1.05)}66%{transform:translate(-30px,30px) scale(1.08)}}

            .games-orbit{position:absolute;border-radius:50%;pointer-events:none;will-change:transform,opacity}
            .games-orbit-1 { width:8px; height:8px; left:12%; top:6%;  background:radial-gradient(circle,rgba(232,131,148,0.85) 0%,rgba(232,131,148,0) 70%); box-shadow:0 0 10px rgba(232,131,148,0.25); animation:games-orbit-a 30s ease-in-out infinite; }
            .games-orbit-2 { width:6px; height:6px; left:24%; top:14%; background:radial-gradient(circle,rgba(184,60,77,0.85)  0%,rgba(184,60,77,0)  70%); box-shadow:0 0 8px  rgba(184,60,77,0.22);   animation:games-orbit-b 34s ease-in-out infinite; animation-delay:1s; }
            .games-orbit-3 { width:10px;height:10px;left:38%; top:22%; background:radial-gradient(circle,rgba(251,200,210,0.8)  0%,rgba(251,200,210,0)  70%); box-shadow:0 0 12px rgba(251,200,210,0.22); animation:games-orbit-c 32s ease-in-out infinite; animation-delay:2s; }
            .games-orbit-4 { width:5px; height:5px; left:54%; top:8%;  background:radial-gradient(circle,rgba(245,158,177,0.85) 0%,rgba(245,158,177,0) 70%); box-shadow:0 0 8px  rgba(245,158,177,0.22); animation:games-orbit-d 38s ease-in-out infinite; animation-delay:3s; }
            .games-orbit-5 { width:7px; height:7px; left:72%; top:18%; background:radial-gradient(circle,rgba(184,60,77,0.8)   0%,rgba(184,60,77,0)   70%); box-shadow:0 0 10px rgba(184,60,77,0.22);   animation:games-orbit-e 32s ease-in-out infinite; animation-delay:.8s; }
            .games-orbit-6 { width:7px; height:7px; left:88%; top:30%; background:radial-gradient(circle,rgba(139,38,56,0.85)  0%,rgba(139,38,56,0)  70%); box-shadow:0 0 10px rgba(139,38,56,0.22);   animation:games-orbit-a 34s ease-in-out infinite; animation-delay:3.6s; }
            .games-orbit-7 { width:9px; height:9px; left:18%; top:42%; background:radial-gradient(circle,rgba(232,131,148,0.85) 0%,rgba(232,131,148,0) 70%); box-shadow:0 0 12px rgba(232,131,148,0.22); animation:games-orbit-b 36s ease-in-out infinite; animation-delay:4.2s; }
            .games-orbit-8 { width:6px; height:6px; left:46%; top:50%; background:radial-gradient(circle,rgba(245,158,177,0.85) 0%,rgba(245,158,177,0) 70%); box-shadow:0 0 8px  rgba(245,158,177,0.22); animation:games-orbit-c 40s ease-in-out infinite; animation-delay:1.6s; }
            .games-orbit-9 { width:8px; height:8px; left:78%; top:56%; background:radial-gradient(circle,rgba(184,60,77,0.8)   0%,rgba(184,60,77,0)   70%); box-shadow:0 0 10px rgba(184,60,77,0.22);   animation:games-orbit-d 34s ease-in-out infinite; animation-delay:5s; }
            .games-orbit-10{ width:7px; height:7px; left:30%; top:64%; background:radial-gradient(circle,rgba(251,200,210,0.85) 0%,rgba(251,200,210,0) 70%); box-shadow:0 0 10px rgba(251,200,210,0.22); animation:games-orbit-e 36s ease-in-out infinite; animation-delay:2.4s; }
            .games-orbit-11{ width:5px; height:5px; left:62%; top:72%; background:radial-gradient(circle,rgba(245,158,177,0.8)  0%,rgba(245,158,177,0)  70%); box-shadow:0 0 8px  rgba(245,158,177,0.2);  animation:games-orbit-a 30s ease-in-out infinite; animation-delay:4s; }
            .games-orbit-12{ width:8px; height:8px; left:84%; top:80%; background:radial-gradient(circle,rgba(232,131,148,0.8)  0%,rgba(232,131,148,0)  70%); box-shadow:0 0 10px rgba(232,131,148,0.22); animation:games-orbit-b 32s ease-in-out infinite; animation-delay:.5s; }
            .games-orbit-13{ width:7px; height:7px; left:14%; top:86%; background:radial-gradient(circle,rgba(184,60,77,0.8)   0%,rgba(184,60,77,0)   70%); box-shadow:0 0 10px rgba(184,60,77,0.22);   animation:games-orbit-c 38s ease-in-out infinite; animation-delay:2s; }
            .games-orbit-14{ width:6px; height:6px; left:42%; top:90%; background:radial-gradient(circle,rgba(139,38,56,0.85)  0%,rgba(139,38,56,0)  70%); box-shadow:0 0 8px  rgba(139,38,56,0.22);   animation:games-orbit-d 34s ease-in-out infinite; animation-delay:3s; }
            .games-orbit-15{ width:9px; height:9px; left:68%; top:94%; background:radial-gradient(circle,rgba(245,158,177,0.85) 0%,rgba(245,158,177,0) 70%); box-shadow:0 0 12px rgba(245,158,177,0.22); animation:games-orbit-e 32s ease-in-out infinite; animation-delay:.8s; }
            .games-orbit-16{ width:8px; height:8px; left:90%; top:48%; background:radial-gradient(circle,rgba(232,131,148,0.85) 0%,rgba(232,131,148,0) 70%); box-shadow:0 0 10px rgba(232,131,148,0.25); animation:games-orbit-a 36s ease-in-out infinite; animation-delay:1.4s; }

            @keyframes games-orbit-a{ 0%,100%{transform:translate(0,0);opacity:.25} 50%{transform:translate(30px,-40px); opacity:.65} }
            @keyframes games-orbit-b{ 0%,100%{transform:translate(0,0);opacity:.25} 50%{transform:translate(-40px,30px);opacity:.65} }
            @keyframes games-orbit-c{ 0%,100%{transform:translate(0,0);opacity:.2}  33%{transform:translate(40px,18px);  opacity:.55} 66%{transform:translate(-25px,-30px);opacity:.7} }
            @keyframes games-orbit-d{ 0%,100%{transform:translate(0,0);opacity:.25} 50%{transform:translate(-30px,-45px);opacity:.65} }
            @keyframes games-orbit-e{ 0%,100%{transform:translate(0,0);opacity:.25} 50%{transform:translate(45px,35px);  opacity:.65} }

            @media (max-width:640px){
              .games-blob-3,
              .games-blob-4,
              .games-floating-circle-2,
              .games-orbit-7,
              .games-orbit-9,
              .games-orbit-11,
              .games-orbit-13,
              .games-orbit-15,
              .games-orbit-16{display:none}
            }

            @media (prefers-reduced-motion:reduce){
              .games-blob,
              .games-floating-circle,
              .games-orbit{animation:none !important}
            }
          `,
        }}
      />
    </>
  );
}
