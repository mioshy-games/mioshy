# mioshy.com — Audit Implementation Report

_Implementation log for the work plan in `AUDIT_PLAN.md`._
_Run started 2026-05-10. Branch: `claude/optimistic-rubin-687c12`._

## Status

- **Batch A (Critical / Low Risk) — complete.** 8 commits landed, `next build` exited 0.
- **Batch B (Med Risk) — partially complete.** #8, #9, #12 landed. #13 and #17 stop here for per-element approval.

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
| `52f68d8` | #12 `noStore()` on homepage | Replaced with `export const revalidate = 60`. Verified beforehand: HomepageV2 + every child component contains zero `cookies()` / `headers()` / Supabase / fetch calls — safe to cache. |
| `081973a` | #10 LCP first pass | `next.config.mjs` sets `images.formats: ["image/avif","image/webp"]` so the optimizer prefers AVIF (25-35% smaller than WebP at same visual quality). `ParallaxImage` accepts a `sizes` prop forwarded to `next/image`; Hero passes `sizes="(max-width: 1024px) 100vw, 720px"` matching the `.hero-grid` breakpoint. **Not yet observable in preview** — visual / Lighthouse verification deferred until either deploy preview or local dev is unblocked. |

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

**Decided: path B.** Awaiting `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the user (these are public values already shipped in the production client bundle). Once dropped into `.env.local`, the plan is:

1. `npm run dev` from this worktree
2. Inject axe-core via the Preview MCP on the four pages:
   - `localhost:3000/he` (HE homepage)
   - `localhost:3000/en` (EN homepage — important after the font analysis above)
   - `localhost:3000/he/articles/truth-or-dare-questions-couples`
   - `localhost:3000/en/articles/truth-or-dare-questions-couples`
3. Return a unified table: element selector, actual contrast ratio, WCAG target, fail / borderline / pass.
4. Per-element approval before any commit.

For each approved fix, the agreed strategy is: keep `--mio-purple` / `--mio-rose` / `--accent` brand tokens unchanged. Add stroke / text-shadow / outer overlay if a CTA fails contrast. Adjust auxiliary text colors (`--ink-4`, `--accent-soft` text usage) freely.

## Manual follow-ups post-launch

- **Move `www → apex` redirect to Vercel domains panel.** The redirect currently lives in `next.config.mjs:35-46` and runs as a Next.js Function invocation, which keeps the (smaller) part of the redirects-audit penalty alive. Configuring `www.mioshy.com` as an alias of `mioshy.com` in Vercel's Domains settings makes that redirect happen at the edge with no compute. Once done, delete the redirect block from `next.config.mjs`.
- **Add a consent banner.** Once a UI design is ready, call `gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ... })` from the new component. The GTM container does not need any change — the Consent Mode v2 defaults are already in place.
- **Drop `--font-geist-sans` references** in `app/[locale]/dashboard/page.tsx:28` and `app/[locale]/paywall/page.tsx:8` (no font is loaded for that variable).
- **Verify Cardcom CSP frame in dev.** Run a real checkout against `secure.cardcom.solutions` once with browser devtools open and confirm the iframe loads. If a different subdomain shows up, add it to `frame-src` / `connect-src` / `form-action`.
- **Re-run PSI** on `https://mioshy.com` (mobile + desktop) and re-run the **VOW Auditor** scan after deploy. Verify the rules in the Verification table flip to `pass`.
- **Wipe Supabase test data** before launch.
- **Tighten CSP**: separate commit to introduce request-scoped nonces, drop `'unsafe-inline'` from `script-src`, and revisit whether `'unsafe-eval'` can be dropped after the Framer Motion / md-editor audit.

## Items NOT yet touched

| # | Issue | Status |
|---|---|---|
| 5 | `/.well-known/ai.json` | Out of scope this turn |
| 6 | `/brand.json` | Out of scope this turn |
| 10 | LCP mobile — hero image | **First pass landed (`081973a`).** AVIF + responsive sizes. Verification pending preview. |
| 13 | Font cleanup | **Closed — no drop.** Bilingual analysis showed both Latin fonts are live on every `/en/*` non-V2 page. |
| 17 | `color-contrast` | **Path B chosen.** Waiting on `NEXT_PUBLIC_SUPABASE_*` values from user. |
| 18 | Cardcom indicator rate limit | Out of scope this turn |
| RLS deep audit | Recommended before launch; separate session |

## Notes / corrections to the original brief

- The brief mentioned **Stripe** webhook signature validation. The site uses **Cardcom** (Israeli provider), not Stripe. Cardcom does not sign callbacks; the indicator route at `app/api/billing/cardcom/indicator/route.ts` instead **server-pulls** the authoritative payment status from Cardcom (`pullLowProfileIndicator`), so spoofed callbacks cannot grant entitlements. Considered safe.
- Independent security scan returned clean on: hardcoded secrets (none), env files in git (none), service-role exposure (server-only, verified), admin route auth gates (every `app/api/admin/*` checked), `/dashboard/*` middleware gating (already server-side).
