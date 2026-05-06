# Mioshy mobile performance — Phase 2 (Claude Code)

## Context

You're working on a Next.js 14 (App Router) site at `/Users/uxellent/mioshy`. It serves Hebrew (RTL) + English. The marketing homepage is `HomepageV2` at `/[locale]` and uses scoped CSS at `components/marketing/v2/styles.css` plus a global `app/globals.css`. A separate Lighthouse audit was just run on mobile and the surgical fixes below are **already shipped** — don't redo them. Focus on the remaining items, profile before changing, and target **mobile** specifically (`<640px` is the breakpoint already used in `styles.css`).

Per project memory: pre-launch (no backwards-compat needed, no 301 redirects). Premium product quality, not MVPs. Don't break desktop without explicit prior approval — but mobile is fair game.

## Already shipped — do NOT redo

1. **Composited animations** — `hero-cta-shift` and `mio-nav-cta-shift` were converted from `background-position` to `transform: translateX` on a 220%-wide `::after` layer (or 220%-wide span). See commits/diff in `components/marketing/v2/styles.css` and `components/SiteHeader.tsx`.
2. **Unused Supabase preconnect** removed — `app/layout.tsx` now only `dns-prefetch`s the Supabase origin.
3. **Mobile DOM diet for hero ambience** — half of the orbits/sparkles/blobs are `display:none` under `@media (max-width:640px)` in `styles.css`. ~22 ambient nodes saved.
4. **Modern browserslist** added to `package.json` (Chrome 93+/Safari 15.4+/Firefox 92+/iOS 15.4+) so SWC drops the `Array.prototype.at`/`flat`/`flatMap`/`Object.fromEntries`/`Object.hasOwn`/`String.prototype.trimStart/End` polyfills.

## Remaining Lighthouse findings (priority order)

### P0 — Render-blocking CSS (1,010 ms savings, 55.6 KiB)

Three CSS chunks block initial render:
- `css/9bb638…f226.css` — 9.6 KiB, 150 ms
- `css/0adef8375573b248.css` — 13.8 KiB, 600 ms
- `css/145174c7585f78a1.css` — 32.2 KiB, 1,050 ms

**Investigate**: which CSS file is what? Map each chunk to its source — likely `app/globals.css` (Tailwind base + tokens), `components/marketing/v2/styles.css`, and one of the editor stylesheets (`@uiw/react-md-editor` is imported in `globals.css` lines 1–2, which is wild for a marketing page).

**Hypotheses to test**:
- The MD editor + markdown preview CSS is being bundled into the marketing route even though only `/dashboard/articles/[id]/edit` uses it. Move those imports into the markdown-editor component itself (side-effect import in the component file) so they only ship on routes that actually render the editor.
- `components/marketing/v2/styles.css` may be 32 KiB and importing into routes that don't use `.home-v2`. Check which pages import it. Consider scoping by side-effect import only inside `HomepageV2` and the few `/games`/`/journey` pages that use it.
- Try `experimental.optimizeCss: true` in `next.config.mjs` (uses `critters` to inline critical CSS and async-load the rest). Validate it doesn't FOUC on Hebrew RTL.

**Verify**: `next build` then check `.next/static/css` — file sizes should drop. Re-run Lighthouse mobile and check the "Render blocking requests" panel.

### P0 — Unused CSS (30 KiB savings)

Same `css/145174c7585f78a1.css` has 30 KiB of unused rules. After fixing P0 above, run `next build` and inspect with the Coverage tab in Chrome DevTools. If still bloated, audit `styles.css` — there may be sections from earlier homepage iterations that aren't referenced in the current `HomepageV2` component tree.

### P1 — Unused JavaScript (24 KiB savings)

`chunks/1635-2b42…` has 24 KiB unused. Common culprits in this codebase:
- `framer-motion` (only the v2 marketing components and a few admin/play screens use it). Check if it's pulled into the marketing chunk unintentionally.
- `react-markdown` / `@uiw/react-md-editor` (admin-only) leaking into public routes.
- `canvas-confetti` (game-end celebration) leaking onto marketing.
- `recharts`, `mathjs`, etc. — make sure none are root-bundled.

**Tools**: `npx @next/bundle-analyzer` or set `ANALYZE=true` and view the visualization. The fix is usually a dynamic `import()` for the heavy lib, or moving it behind a route boundary.

### P1 — Network dependency tree (1,280 ms critical path)

Three woff2 files at the end of the critical chain (each ~14–24 KiB, all reach 1,279–1,280 ms):
- `806aa40678b0153b-s.woff2`
- `70b9b96e99f02a56-s.woff2`
- `1ac0814e481b39bc-s.woff2`

These are next/font outputs. **Hypothesis**: too many fonts loaded eagerly. The site loads Inter, Playfair Display, IBM Plex Sans Hebrew, Assistant, Heebo, Frank Ruhl Libre, Noto Serif Hebrew (see `app/layout.tsx` 60–110). The above-the-fold hero only needs Heebo (body) + Frank Ruhl Libre (display em). The rest can be deferred.

**Action**: keep eager `display: "swap"` on Heebo + Frank Ruhl Libre. For the other 5 fonts, switch to `display: "optional"` and/or remove `preload: true`. Better: add `preload: false` to all fonts that aren't on the homepage hero, and let the page that needs them request on demand.

After: critical chain should drop below 800 ms on mobile.

### P2 — Long main-thread tasks (288 + 213 ms)

288 ms on the document itself and 213 ms on `/en` suggest server-rendered HTML is heavy or a chunk hydrates expensively. Likely tied to `HomepageV2` doing too much synchronous work in one chunk. Use `next/dynamic` (with `ssr: true` + `loading: () => null`) for sections below the hero (`Problem`, `Authority`, `MediaSlider`, `Founder`, `Journey`, `CouplesGames`, `AdultGames`, `Education`, `ForWhom`, `Pricing`, `FinalCTA`, `FAQ`) so the main bundle ships only the hero. They can hydrate in idle.

### P2 — DOM size (823 elements)

Hero `.hero-bg` has 19 children (was higher before mobile diet). Below-the-fold sections add the rest. After P2 long-task fix (dynamic import below-the-fold), DOM count should drop because some sections won't render until visible. If it's still above 1,500, audit `Education` and `Pricing` for repeated card structure that can flatten.

### P3 — Forced reflow (453 ms unattributed + 42 ms in `chunks/4222-601e…`)

Needs profiling. Open Chrome DevTools → Performance, throttle to "Slow 4G" + 4× CPU, record a fresh load. Find the violating function. Likely candidates: `Counter` (animates a number from 0 to N — does it read `offsetWidth` per frame?), `ParallaxImage` (scroll handler reading geometry), or `RevealOnScroll` (IntersectionObserver should be fine; if it's reading bounding rects, that's the bug).

The `[unattributed]` 453 ms is usually next-intl or framer-motion measuring on first hydration. Check if `useReducedMotion()` from framer-motion is being called pre-hydration.

## Constraints

- **Don't touch desktop CSS** — homepage desktop is "approved". Mobile fixes go in `@media (max-width: 640px)` blocks. `/games` is fair game (no per-breakpoint freeze).
- **Don't add backwards-compat** — drop dead imports, don't keep them around.
- **Hebrew RTL must keep working** — verify with `?locale=he` after each change.
- **Run `next build`** after each P0/P1 fix to confirm no regressions and get fresh chunk sizes.
- **Re-run Lighthouse mobile** after each priority bucket. Expected before-→-after deltas:
  - P0 done: TBT drops by ~700 ms, FCP drops by ~600 ms.
  - P1 done: LCP drops by ~400 ms.
  - P2 done: TBT drops by another ~200 ms.

## Deliverable

A short report in chat with:
1. What you changed and why (file by file).
2. Bundle size diff (before/after) from `next build` output.
3. Lighthouse mobile score delta (perf only — Best Practices/SEO/Accessibility don't matter here).
4. Any items you couldn't fix and why.

Don't ask permission for the items above — they're approved. Do ask if you discover a structural change (e.g. converting `HomepageV2` from a server component to a streaming layout) before doing it.
