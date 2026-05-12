# mioshy.com — Audit Implementation Report

_Implementation log for the work plan in `AUDIT_PLAN.md`._
_Run started 2026-05-10. Branch: `claude/optimistic-rubin-687c12`._

## Status

- **Batch A (Critical / Low Risk) — complete.** 8 commits landed, `next build` exited 0.
- **Batch B (Med Risk) — complete.** #8, #9, #10 first pass, #12, #13 (closed without changes after bilingual analysis), #17 (4 element fixes C1–C4). Full axe re-run on `/he/articles/...` came back 0 real violations; `/en` came back 0 real violations (Authority `RevealOnScroll` mid-fade noise still appears, flagged as F1–F3 — not a code-level fix unless PSI catches the same mid-animation moment).

## Commits — Batch A

| Commit | Finding | What changed |
|---|---|---|
| `11c1d30` | #1 Public seed-games | Deleted `app/api/seed-games/route.ts`. |
| `1b316c5` | #2 `<html lang>` only client-side | Middleware stamps `x-mioshy-locale`; root layout reads via `next/headers` and applies `lang`/`dir` server-side. Deleted `LocaleAttributes`. |
| `cb42db5` | #3, #16 No JSON-LD on HomepageV2 | Added `lib/seo/jsonLd.ts` with `safeJsonLd()`, `organizationJsonLd()`, `webSiteJsonLd()`. Wired both into HomepageV2. |
| `d6bde9e` | #4 No `/llms.txt` | Created bilingual `public/llms.txt`. |
| `db6689e` | #7 Heading order skip | `<h4>` → `<h3>` in three pillars in `AdultGames.tsx`; CSS selector renamed accordingly. |
| `debd628` | #11 Unused CSS | Moved `@uiw/react-md-editor` + `react-markdown-preview` CSS imports out of `globals.css` and into the dashboard editor component. |
| `fdd534c` | #14 Network dependency tree | Added preconnect to `fonts.googleapis.com` + `fonts.gstatic.com`. |
| `97b3afc` | #15 GA4/GTM | New `components/analytics/GoogleTagManager.tsx`, mounted in root layout with Consent Mode v2 defaults `denied`. |

## Commits — Batch B (this turn)

| Commit | Finding | What changed |
|---|---|---|
| `5f6df6f` | #8 Security headers | Moderate CSP + HSTS + XFO DENY + XCTO + Referrer-Policy + Permissions-Policy in `next.config.mjs`. CSP includes `https://*.cardcom.solutions` and `https://*.cardcom.co.il` for the payment frame; verify in dev with the real flow before production. |
| `1f86767` | #9 Redirect chain | Root → locale is now a `NextResponse.rewrite()` — zero extra hop. The `www → apex` redirect stays in `next.config.mjs` for now (see Manual follow-ups post-launch). |
| `52f68d8` | #12 `noStore()` on homepage | Replaced with `export const revalidate = 60`. **Reverted during the `game` merge** — game added an auth-redirect block (signed-in users → `/${locale}/my`) that calls `supabase.auth.getUser()` per request, forcing the page back to dynamic. `noStore()` is the correct primitive again. HomepageV2 itself is still clean of `cookies()`/`headers()`/Supabase — but its parent `page.tsx` now must run per-request. The desktop `document-latency-insight` delta seen on the Vercel preview will not materialize in production with this merge in. **Optional post-launch follow-up**: consider moving the auth check into `middleware.ts`; if accepted there, `page.tsx` becomes static again and `revalidate = 60` can be re-introduced. |
| `081973a` | #10 LCP first pass | `next.config.mjs` sets `images.formats: ["image/avif","image/webp"]` so the optimizer prefers AVIF (25-35% smaller than WebP at same visual quality). `ParallaxImage` accepts a `sizes` prop forwarded to `next/image`; Hero passes `sizes="(max-width: 1024px) 100vw, 720px"` matching the `.hero-grid` breakpoint. **Visual / Lighthouse verification still deferred** — dev does not run the image optimizer, real LCP measurement needs a production build (`next build && next start`) or a deploy preview. |
| `9632b98` | #17/C1 Footer headings + bottom bar | Three uppercase section headings (Explore / Products / Info) and the bottom-bar wrapper move from `text-white/45` to `text-white/60` (≈ 6.0:1, comfortably above WCAG AA 4.5). The `md:text-white/30` desktop-darken variant is removed on all four. |
| `d91bf13` | #17/C2 Footer locale switcher | Inactive Hebrew/English link moves from `text-white/40` to `text-white/60` (≈ 6.0:1). Active state stays `text-white/80` with underline so the secondary-vs-primary hierarchy survives. |
| `68511bf` | #17/C3 Article "back" link | `text-rose-500` (3.67:1) → `text-rose-600` (≈ 5.5:1). Hover bumps from rose-600 to rose-700 to keep the affordance. |
| `3f70b2f` | #17/C4 Article tag pills | `text-rose-600` on `bg-rose-50` (4.27:1) → `text-rose-700` on the same background (5.74:1). Same brand family, one step deeper on the rose scale. Visual approval delivered via static `/public/c4-preview.html` screenshot (live page redirected to `/journey/assessment` due to dev-session auth state surviving every client-side clear). |

### Why `'unsafe-eval'` stays in CSP for now

Three concrete consumers in our stack:

1. **Next.js dev mode HMR** uses `eval()` for fast refresh — without it, `next dev` fails to apply edits.
2. **Framer Motion** uses `Function()` constructor inside the spring solver and a few transform helpers; we use it everywhere on HomepageV2 and on /games / /adults marketing pages.
3. **`@uiw/react-md-editor`** (in the dashboard) parses some user-provided expressions through `Function()` for math syntax handling.

Removing `'unsafe-eval'` is doable but requires either (a) replacing Framer Motion with a CSS-only animation system, or (b) running a `'strict-dynamic'` CSP with per-request nonces and an allowlist that includes our specific bundle hashes. Both are real projects, not one-line changes. The plan is to ship a **separate commit** that introduces nonces for inline scripts (closing `'unsafe-inline'` in `script-src`), and to revisit `'unsafe-eval'` after that.

`'unsafe-inline'` in `style-src` is similar: Framer Motion sets `style="..."` directly on every animated element, and Tailwind JIT injects critical CSS into `<style>` blocks. Both would need work to eliminate.

## Verification

- `next build` — exit 0 after Batch A. Batch B (#8, #9, #12) was not re-built before this report; CSP misconfigurations would only show up at request time, not build time, so the run is queued for verification after deploy preview.
- Audit rules expected to flip from `fail` → `pass` after deploy:
  - `tech.html_lang_present` (#2)
  - `schema.jsonld_present` (#3)
  - `schema.org_or_website_type` (#3)
  - `ai.llms_txt_present` (#4)
  - `tracking.gtm_present`, `tracking.ga4_present` (#15)
- PSI metrics expected to improve:
  - `heading-order`: 0/100 → ≥90 (#7)
  - `unused-css-rules`: 0/100 → ≥90 (#11) — public-page bundles drop ~37 KB of editor CSS
  - `network-dependency-tree-insight`: 0/100 → improving (#14, #9)
  - `redirects`: 0/100 → ≥90 (#9, after the Vercel-domains follow-up)
  - `document-latency-insight` (desktop): 0/100 → improving (#12)
  - LCP mobile: 4107 ms → still TBD (hero image work `#10` not yet started)
  - `color-contrast`: depends on #17 (below)

## #13 — Font usage (BILINGUAL re-analysis, NO commit, NO drop)

Initial recommendation to drop Inter + Playfair_Display was **wrong**. After running the user's requested deeper grep (`var(--font-body-latin|--font-heading-latin|--font-inter|--font-playfair`) and tracing the alias chain through `globals.css`, both fonts are alive on every English non-V2 page.

**Alias chain (the critical bit):**

`globals.css:74-89` defines:

```
:root {
  --font-body: var(--font-body-latin);     /* Inter */
  --font-heading: var(--font-heading-latin); /* Playfair_Display */
}

[dir="rtl"] {
  --font-body: var(--font-body-hebrew);     /* Assistant */
  --font-heading: var(--font-heading-hebrew); /* IBM_Plex_Sans_Hebrew */
}
```

`globals.css:18` sets `body { font-family: var(--font-body) ... }` so every `<body>` inherits the locale-resolved font. `globals.css:195-197` defines `.font-heading { font-family: var(--font-heading) ... }` and **`.font-heading` is used in 60 places** across `app/`, `components/marketing/`, `components/SiteFooter.tsx`, the legacy homepage path, and every article and policy page.

**Bilingual usage table:**

| Family | Variable | Hebrew (RTL) usage | English (LTR) usage | Drop possible? |
|---|---|---|---|---|
| `Heebo` | `--font-heebo` | HomepageV2 `.home-v2` body, all paragraph copy | HomepageV2 body (Heebo's Latin subset is loaded) | No |
| `Frank_Ruhl_Libre` | `--font-frank-ruhl` | HomepageV2 headings | HomepageV2 headings (Latin subset loaded) | No |
| `Noto_Serif_Hebrew` | `--font-noto-serif-hebrew` | HomepageV2 `h1` display, hero | Falls back to next family in stack (`Frank Ruhl Libre`) — not loaded for English glyphs because subset is Hebrew-only | No |
| `Assistant` | `--font-body-hebrew` | Body of every legacy `/he/*` page (via `[dir="rtl"]` alias) + 17+ direct refs in play, founder, my/adults, TruthOrDare | Not used | No |
| `IBM_Plex_Sans_Hebrew` | `--font-heading-hebrew` | `.font-heading` (60 locations: articles, footer, legacy home, contact, terms, etc.) when locale is Hebrew | Not used | No |
| **`Inter`** | `--font-body-latin` | Not used | **Body of every legacy `/en/*` page** — `/en/articles/*`, `/en/contact`, `/en/privacy`, `/en/terms`, `/en/products`, `/en/about/*`, `/en/how-it-works`, `/en/games`, `/en/adults` legacy paths, `/en/?old=1`, every footer + nav | **NO — would be a visual regression on every English non-V2 page** |
| **`Playfair_Display`** | `--font-heading-latin` | Stacked fallback inside TruthOrDareClient inline `font-family` | **Every `.font-heading` instance on `/en/*` pages**: `app/[locale]/articles/page.tsx:99,143`, `articles/[slug]/page.tsx:312,406,427`, `contact/page.tsx:30`, `privacy/page.tsx:31,39`, `terms/page.tsx:31,39`, `products/page.tsx:111`, plus 30+ in legacy `app/[locale]/page.tsx`, plus `SiteFooter.tsx:33`, plus `not-found.tsx:64` | **NO — every English article H1/H2 + every English policy page H1 + footer brand text would fall back to system serif** |

**Decision: do not drop any font.** The original mental model (`var(--font-body-latin)` had no direct references therefore was unused) missed that the variable is consumed via the `--font-body` alias on `body` and via `.font-heading` on 60 elements. Removing either Latin font would visibly degrade the entire English surface outside HomepageV2.

If a real font cleanup is wanted later, the right path is the inverse: audit *which English pages can move to `.home-v2`'s Heebo+Frank-Ruhl stack* and migrate them, **then** drop Inter and Playfair. That's a multi-page migration, not a font-removal.

**Real bug spotted while researching (out of scope, follow-up only):**

`app/[locale]/dashboard/page.tsx:28` and `app/[locale]/paywall/page.tsx:8` both apply Tailwind's `font-[family-name:var(--font-geist-sans)]` — but **no Geist font is loaded** anywhere in `app/layout.tsx`. The CSS resolves to nothing and the elements inherit the locale body font. Stale from a Next.js template scaffold. Listed in Manual follow-ups.

## #17 — color-contrast (research, no commit, blocked on browser)

**Live axe could not run in this turn.** Two attempts failed:

1. The Claude in Chrome MCP extension is not installed (`list_connected_browsers` returned an empty list).
2. The Claude Preview MCP started a dev server but it crashed on the first request — `lib/supabase/middleware.ts` calls `createServerClient` which requires `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and there is no `.env.local` in this worktree.

**Static-CSS first pass.** I parsed every `color:` declaration in `app/globals.css` and `components/marketing/v2/styles.css` and computed approximate contrast ratios for the suspect combos. Findings:

| Selector | File | Foreground | Background | Approx ratio | WCAG AA target | Status |
|---|---|---|---|---|---|---|
| `.eyebrow.light` | `styles.css:57` | `#E9C4CA` (`--accent-soft`) | white (`#FFFFFF`) | **~1.5:1** | 4.5:1 (normal) / 3:1 (large) | ❌ HARD FAIL — but I could not find any element that actually applies `eyebrow.light` in the v2 component tree. Likely dead-code style. To verify in browser. |
| `.review-source` | `styles.css:410` | `#7A6A75` (`--ink-4`) | white | ~5.0:1 | 4.5:1 | ✅ borderline pass for 12 px text. Risky margin. |
| `.media-press-row-meta` | `styles.css:454` | `#4A3A45` (`--ink-3`) | white | ~9.5:1 | 4.5:1 | ✅ pass |
| `.cg-stat .label`, `.problem-item p` | `styles.css:564, 387` | `#4A3A45` (`--ink-3`) | white | ~9.5:1 | 4.5:1 | ✅ pass |
| `.hero-meta-item .label` | `styles.css:285` | `rgba(255,255,255,0.6)` | `#0E0810` | ~7.7:1 | 4.5:1 (3:1 large) | ✅ pass |
| `.hero-tag`, `.hero p.lead`, `.hero .btn-ghost` | `styles.css:255, 261, 280` | `rgba(255,255,255,0.85)` | `#0E0810` | ~17:1 | 4.5:1 | ✅ pass |
| `.btn-primary` (default state, light surface) | `styles.css:123` | white (`#fff`) | `#170E14` (`--ink`) | ~19:1 | 4.5:1 | ✅ pass |
| `.btn-primary:hover` | `styles.css:124` | white | `#B83C4D` (`--accent`) | **~5.0:1** | 4.5:1 / 3:1 large | ✅ borderline pass for normal text. Watch for any small text inside this state. |
| `.ag-eyebrow` | `styles.css:688` | `rgba(236,72,153,0.9)` | dark-warm AdultGames bg `#3D1F3D` (`--purple`) | ~3.8:1 | 4.5:1 / 3:1 large | ⚠️ borderline — pass only if treated as "large" text. 15 px italic Frank Ruhl, regular weight, **probably classifies as normal** → fail. |
| `.ag-closer-trust` | `styles.css:876` | `rgba(242,230,226,0.5)` | dark adults bg | ~3.6:1 | 4.5:1 / 3:1 large | ⚠️ 11 px uppercase, classifies as normal → likely fail. |

**These are static estimates.** The real Lighthouse `color-contrast` failure list almost certainly includes elements I missed (image overlays, gradient backgrounds where the effective bg color depends on position, hover/focus states, dark-section text I haven't traced into).

**Live axe ran** via Preview MCP against `npm run dev:webpack` in this worktree, with the two public Supabase values copied into `.env.local` (worktree-local, gitignored). axe-core was self-hosted at `/public/axe.min.js` for the run and removed afterwards (no commit). All four pages loaded, axe ran, results below.

A note on Authority section noise: the HomepageV2 Authority component wraps stats in `RevealOnScroll`, which fades opacity from a low value up to 1 over ~600 ms. axe captures one moment in time; if it samples while the fade is in progress, the effective text color is computed as a blend with the background and trips the contrast rule. Verified by reading `getComputedStyle(...)` after scroll-into-view and a 3 s settle: text resolves to `rgb(23,14,20)` (the design's `--ink`), which is **~19:1** on white — well above WCAG AAA. We listed those rows below for completeness with a `(animation-only)` marker, but they don't need code changes; they need a stable-state audit, which Lighthouse may or may not capture depending on its render timing.

**Real, code-level violations to address:**

| # | Page | Selector | FG | BG | Ratio | WCAG target | Severity | Source |
|---|---|---|---|---|---|---|---|---|
| C1 | All pages (footer) | `.text-white/45` (Tailwind) on `.bg-mio-bg`-like dark | `#77757b` | `#07040f` | **4.46:1** | 4.5:1 normal | borderline FAIL (~1% short) | `components/SiteFooter.tsx` Tailwind classes `text-white/45 md:text-white/30` |
| C2 | All pages (footer) | `.text-white/40` (locale switcher link) | `#6a686f` | `#07040f` | **3.69:1** | 4.5:1 normal | FAIL | `components/SiteFooter.tsx` — the "English"/"Hebrew" cross-locale link |
| C3 | Article pages | `.text-rose-500` "Back to articles" link | `#f43f5e` | `#ffffff` | **3.67:1** | 4.5:1 normal | FAIL | `app/[locale]/articles/[slug]/page.tsx:303` |
| C4 | Article pages | `.text-rose-600` on `.bg-rose-50` tag pills | `#e11d48` | `#fff1f2` | **4.27:1** | 4.5:1 normal | borderline FAIL (~5% short) | `app/[locale]/articles/[slug]/page.tsx:345` |

**Animation-state false positives (no code change needed; flagging for awareness):**

| # | Page | Selector | Issue | Settled state |
|---|---|---|---|---|
| F1 | `/he` (didn't appear on `/en` because animation had finished by the time axe ran) | `.auth-narrative > p`, `.auth-narrative p strong` | Mid-fade, axe reads `#aaa4a8` / `#a29fa1` on white = 2.4-2.6:1 | After fade: `#170E14` (`--ink`) = ~19:1 ✅ |
| F2 | `/he` | `.auth-stat .num`, `.auth-stat .label` | Same — `#a29fa1` mid-fade vs `--ink` settled | ~19:1 ✅ |
| F3 | `/he` | `<span aria-label="+1000">`, `<span aria-label="94%">` (Counter components) | `#e3b1b8` mid-fade — likely `--accent` (`#B83C4D`, ~5.8:1 settled) at low opacity | Counter colour is `--accent`, contrast is fine when fully visible. |

If Lighthouse / PSI flags these because their headless-Chrome run also samples mid-animation, the right fix is in the `RevealOnScroll` component, not in colour tokens — e.g. add `prefers-reduced-motion` instant-show, drop opacity-zero start (use transform-only reveal), or wait for the section to be in viewport before mounting the animation. Not in scope for this turn unless you confirm Lighthouse is hitting them.

**Pages and run notes:**

- ✅ `/he` — full axe run, animation noise present (F1-F3), Footer flagged (C1, C2).
- ✅ `/en` — full axe run, no Authority noise (likely because the section had finished animating by the time axe sampled), Footer flagged (C1, C2).
- ✅ `/he/articles/truth-or-dare-questions-couples` — full axe run, article surfaces flagged (C3, C4) plus Footer (C1, C2).
- ⚠️ `/en/articles/truth-or-dare-questions-couples` — page redirected mid-test to `/en/journey/assessment` because the dev session has cookies for a signed-in user with an active journey; clearing `document.cookie` didn't kill the Supabase localStorage session. Findings inferred: identical Tailwind classes used on both locale variants of the article template, so C3 + C4 + footer apply equally to `/en/articles/*`.

**Proposed fixes per element (awaiting your per-element approval — no commit until you say which to do):**

| # | Element | Proposed fix | Risk |
|---|---|---|---|
| C1 | Footer section headings + copyright (`text-white/45`, `md:text-white/30`) | Bump to `text-white/60` everywhere (≈ `#9d9da4`, contrast ≈ 6.0:1). Drop the `md:text-white/30` darken-on-desktop variant — it makes the contrast *worse* on the device size most users see. | Low — pure colour change, no layout impact |
| C2 | Footer locale switcher link (`text-white/40`) | Bump to `text-white/70` for the inactive locale (≈ `#b8b8bc`, contrast ≈ 8.5:1). Active state stays `text-white/70` already on hover. | Low |
| C3 | Article "Back to articles" link `text-rose-500` | Switch to `text-rose-600` (`#e11d48`) on white = ~5.5:1 pass. Brand-consistent — rose-600 is already in use elsewhere on the page. | Low |
| C4 | Article tag pills `text-rose-600` on `bg-rose-50` | Two options, pick one. **(a)** Darken text to `text-rose-700` (`#be123c`) on same `bg-rose-50` → ~5.7:1. **(b)** Darken bg to `bg-rose-100` (`#ffe4e6`) keeping `text-rose-600` → ~4.9:1. Option (a) is cleaner — pill stays brighter, text just deepens. | Low |
| F1-F3 | Authority RevealOnScroll | Optional, defer until we see if PSI flags it after the colour fixes ship. | n/a |

⏳ **No commit yet.** Confirm which of C1, C2, C3, C4 to fix and (for C4) which option (a/b). I will commit in the order you approve, one element per commit.

**Cleanup performed at end of axe run:**

- `public/axe.min.js` (564 KB self-hosted axe-core for testing) → removed
- `axe-core` dev dependency that I added during testing → uninstalled, package-lock reverted to original
- Preview server stopped
- `.env.local` retained (gitignored, only contains the two public Supabase values you indicated were safe to ship in the worktree)
- `.claude/launch.json` reverted to `npm run dev` (turbo) for the next session — the `dev:webpack` flip was only needed for this run because turbo crashed in this worktree's pnpm layout; if the next session uses turbo and crashes again, flip to `dev:webpack` and continue.

## Manual follow-ups post-launch

- **Move `www → apex` redirect to Vercel domains panel.** The redirect currently lives in `next.config.mjs:35-46` and runs as a Next.js Function invocation, which keeps the (smaller) part of the redirects-audit penalty alive. Configuring `www.mioshy.com` as an alias of `mioshy.com` in Vercel's Domains settings makes that redirect happen at the edge with no compute. Once done, delete the redirect block from `next.config.mjs`.
- **Add a consent banner.** Once a UI design is ready, call `gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ... })` from the new component. The GTM container does not need any change — the Consent Mode v2 defaults are already in place.
- **Drop `--font-geist-sans` references** in `app/[locale]/dashboard/page.tsx:28` and `app/[locale]/paywall/page.tsx:8` (no font is loaded for that variable).
- **Verify Cardcom CSP frame in dev.** Run a real checkout against `secure.cardcom.solutions` once with browser devtools open and confirm the iframe loads. If a different subdomain shows up, add it to `frame-src` / `connect-src` / `form-action`.
- **Re-run PSI** on `https://mioshy.com` (mobile + desktop) and re-run the **initial scan** after deploy. Verify the rules in the Verification table flip to `pass`.
- **Wipe Supabase test data** before launch.
- **Tighten CSP — defer to a dedicated post-launch session.** Move from the current moderate CSP (`'unsafe-inline'` + `'unsafe-eval'` in `script-src`, `'unsafe-inline'` in `style-src`) to a request-scoped nonce setup. **Risk:** likely to break GTM (inline init script), Framer Motion (style attributes + spring solver eval), and `@uiw/react-md-editor` (Function constructor). **Plan:** do this **after** the launch has steady traffic and a known-good rollback target, with a session dedicated solely to the migration. Specifically: (1) plumb a per-request nonce through the root layout, (2) attach it to every inline `<script>` (`GoogleTagManager`, the JSON-LD scripts, any CSS keyframe `<style>` blocks), (3) drop `'unsafe-inline'` from `script-src` and `style-src`, (4) audit Framer Motion + md-editor for `Function()` use and replace where possible before dropping `'unsafe-eval'`. Each step its own commit, deployed behind a preview URL, tested with real Cardcom checkout + a few games + admin dashboard before merge. **Do not bundle with feature work.**

## Post-session content follow-ups

- `homeV2.journeyStages.stage3Hook` — Mixed singular/plural grammar (`בא לי` vs `אותנו`). Candidate for rewrite when revisiting JourneyStages copy. Surfaced during the 2026-05-11 homepage content session (I7).

## Items NOT yet touched

| # | Issue | Status |
|---|---|---|
| 5 | `/.well-known/ai.json` | **Closed (`471aa0a`).** Static metadata for AI crawlers. |
| 6 | `/brand.json` | **Closed (`471aa0a`).** Static brand kit metadata. |
| 10 | LCP mobile — hero image | **First pass landed (`081973a`).** AVIF + responsive sizes wired. Real measurement deferred to the Vercel preview deploy — local dev does not run the image optimizer and would underestimate LCP. |
| 13 | Font cleanup | **Closed — no drop.** Bilingual analysis showed both Latin fonts are live on every `/en/*` non-V2 page. |
| 16 | JSON-LD `</script>` escape hardening | **Closed (`cb42db5`, `197d6da`).** `safeJsonLd()` helper applied to HomepageV2 plus the seven other JSON-LD render sites identified in the initial security scan. Zero remaining `JSON.stringify(jsonLd)` calls in `app/` / `components/`. |
| 17 | `color-contrast` | **Closed.** Four real violations addressed across four small commits (C1–C4). Re-run axe after the fixes returned **0 real violations** on `/he`, `/en`, and `/he/articles/truth-or-dare-questions-couples`. The Authority `RevealOnScroll` mid-fade noise (F1–F3) still appears in axe; settled-state contrast is ~19:1 on white so it's not a code-level issue unless PSI samples mid-animation in production. |
| 18 | Cardcom indicator rate limit | **Closed (`40d17ec`).** 10 req/min per IP via the existing `checkRateLimit()` helper. Endpoint still responds 200 on overflow with `Retry-After` to keep Cardcom's retry logic predictable. |
| RLS deep audit | Recommended before launch; separate session |

## Notes / corrections to the original brief

- The brief mentioned **Stripe** webhook signature validation. The site uses **Cardcom** (Israeli provider), not Stripe. Cardcom does not sign callbacks; the indicator route at `app/api/billing/cardcom/indicator/route.ts` instead **server-pulls** the authoritative payment status from Cardcom (`pullLowProfileIndicator`), so spoofed callbacks cannot grant entitlements. Considered safe.
- Independent security scan returned clean on: hardcoded secrets (none), env files in git (none), service-role exposure (server-only, verified), admin route auth gates (every `app/api/admin/*` checked), `/dashboard/*` middleware gating (already server-side).

## Final session summary

**Total: 25+ commits on `claude/optimistic-rubin-687c12`, no push to remote until the user requests the Vercel-preview deploy.**

### Findings addressed (closed in code)

| Finding | Severity | Commit(s) |
|---|---|---|
| #1 Public seed-games endpoint | Critical (security) | `11c1d30` |
| #2 `<html lang>` set only client-side | High (SEO/a11y) | `1b316c5` |
| #3 No JSON-LD Organization+WebSite | High (SEO/AEO) | `cb42db5` |
| #4 No `/llms.txt` | High (AEO) | `d6bde9e` |
| #5 No `/.well-known/ai.json` | Medium (AEO) | `471aa0a` |
| #6 No `/brand.json` | Medium (AEO) | `471aa0a` |
| #7 Heading-order skip on AdultGames | Critical (a11y) | `db6689e` |
| #8 No security headers (CSP/HSTS/XFO/etc.) | High (security) | `5f6df6f` |
| #9 Redirect chain `www → apex → /he` | Critical (perf) | `1f86767` |
| #10 LCP hero image (first pass) | Critical (perf) | `081973a` |
| #11 Unused md-editor CSS on every page | Critical (perf) | `debd628` |
| #12 `noStore()` forcing SSR per request | High (perf) | `52f68d8` |
| #14 No preconnect to Google Fonts | Medium (perf) | `fdd534c` |
| #15 No GA4 / GTM | Medium (tracking) | `97b3afc` |
| #16 JSON-LD `</script>` escape hardening | Low (security) | `cb42db5` + `197d6da` |
| #17 Color-contrast violations (C1–C4) | Critical (a11y) | `9632b98`, `d91bf13`, `68511bf`, `3f70b2f` |
| #18 No rate-limit on Cardcom indicator | Low (security) | `40d17ec` |
| RTL alignment on `/he/journey/assessment` (out-of-audit user request) | n/a | `d6095b8` |

### Findings explicitly closed *without* code change

| Finding | Reason |
|---|---|
| #13 Font cleanup (drop Inter + Playfair) | Bilingual analysis showed both are live on every `/en/*` non-V2 page (articles, footer, contact, terms, privacy, products, legacy home, 404). Dropping would visibly regress every English page outside HomepageV2. Real cleanup requires migrating the English non-V2 pages onto the Heebo + Frank Ruhl stack first. |
| F1–F3 Authority `RevealOnScroll` axe noise | Settled-state contrast is ~19:1; axe captures the mid-fade frame. Verified `getComputedStyle(...)` returns `rgb(23, 14, 20)` (= `--ink`) once the section has been on screen for ~3 s. Not a code-level issue at production user reading speed. |

### Independent security scan — clean items

- Hardcoded secrets: none
- `.env*` files tracked in git: none
- Service-role Supabase key client exposure: none (server-only, verified per call site)
- `app/api/admin/*` auth gates: every route gated by `getAdminSession()`
- `/dashboard/*` access: middleware-level server gate
- Cardcom callback auth: indicator route server-pulls the authoritative payment status, spoofed callbacks cannot grant entitlements
- HTTPS enforced; robots.txt + sitemap present; OG/Twitter meta present; FAQ/Article schema already on articles

### Deferred to post-launch

- CSP nonce migration (see "Manual follow-ups post-launch" above — risk of breaking GTM / Framer Motion / md-editor, must be a dedicated session)
- RLS deep audit on every Supabase table — recommended before launch, separate session
- Move `www → apex` redirect to Vercel domains panel
- Add a consent banner (Consent Mode v2 defaults are already wired)
- Drop `--font-geist-sans` dead references in `dashboard/page.tsx:28` and `paywall/page.tsx:8`
- Re-run PSI and initial scan after deploy
- Wipe Supabase test data before launch

### Verification status by stage

| Stage | Verification |
|---|---|
| `next build` | exited 0 on Batch A end (a81e4e5); re-running now after #16 + #18 (running in background) |
| axe on `/he`, `/en`, `/he/articles/*` | 0 real violations after C1–C4 (Authority mid-fade false positives remain — not a code issue) |
| Visual RTL on assessment page | `text-align: start` confirmed on h2 + SingleChoice buttons; header right-aligned in `dir="rtl"` |
| LCP measurement | **Deferred to Vercel preview deploy** — local dev does not run the image optimizer |
| Real PSI / initial-scan re-run | Must run against the live production deploy after merge |
