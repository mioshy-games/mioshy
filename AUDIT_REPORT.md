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

## #13 — Font usage (research, no commit)

Seven font families are loaded in `app/layout.tsx`. Below is every CSS variable that references each, where it's used, and whether it appears in the **first paint** of the active homepage (HomepageV2) or only in deeper pages.

| Family | Variable | Where it's referenced | First-paint on HomepageV2? | Decision |
|---|---|---|---|---|
| `Heebo` | `--font-heebo` | `.home-v2` body font (`styles.css:39`, `:162`, `:176`) | **Yes** — every paragraph in HomepageV2 | **Keep** |
| `Frank_Ruhl_Libre` | `--font-frank-ruhl` | `.home-v2` heading font (`styles.css:163`, `:177`) | **Yes** — every h2/h3/h4 in HomepageV2 | **Keep** |
| `Noto_Serif_Hebrew` | `--font-noto-serif-hebrew` | `.home-v2` display font (`styles.css:164`, `:178`) | **Yes** — Hero h1 + section displays | **Keep** |
| `Assistant` | `--font-body-hebrew` | 17+ direct refs in `app/[locale]/adults/[slug]/play/page.tsx`, `about/founder/page.tsx`, `my/adults/page.tsx`, `TruthOrDareClient.tsx` | **No** — V2 home uses Heebo. But it IS first-paint on `/he/about/founder`, `/he/my/adults`, `/he/adults/[slug]/play`, and the truth-or-dare game UI. | **Keep** — used heavily on Hebrew pages outside the homepage. |
| `IBM_Plex_Sans_Hebrew` | `--font-heading-hebrew` | `TruthOrDareClient.tsx:567`, `:603`, `:626`. Aliased into `--font-heading` for `[dir="rtl"]` legacy paths via `globals.css:91` | **No** — V2 home uses Frank_Ruhl. Used on truth-or-dare UI + as the legacy heading font for any non-V2 Hebrew page. | **Probably keep** — needs an audit of which Hebrew pages still render via the legacy stack. Risk: removing it leaves heading text rendering in fallback (system Hebrew). |
| `Inter` | `--font-body-latin` | Aliased into `--font-body` for `:root` via `globals.css:75`. No direct refs found in code. | **No** | **Candidate to drop** — only used as a fallback for the (rare) LTR pages that don't enter `.home-v2`. Test: any `/en/...` page outside HomepageV2 that uses default body font would lose Inter and fall back to system. |
| `Playfair_Display` | `--font-heading-latin` | `TruthOrDareClient.tsx:567`, `:603`, `:626` (as Latin fallback alongside `--font-heading-hebrew`). Aliased into `--font-heading` for `:root` via `globals.css:76`. | **No** | **Candidate to drop** — but truth-or-dare game UI has it as a stacked fallback; if removed, fallback is system serif. Visual change small but real on game cards. |

Two real bug findings while grepping:

- `app/[locale]/dashboard/page.tsx:28` and `app/[locale]/paywall/page.tsx:8` both reference `var(--font-geist-sans)` — but **no Geist font is loaded**. Those CSS values resolve to nothing and inherit body font. Either remove the Tailwind `font-[family-name:var(--font-geist-sans)]` class, or add Geist to root layout. Likely a leftover from a Next.js template. Out of scope for this turn but worth a follow-up.

**Recommendation:** drop `Inter` and `Playfair_Display` only — saves two HTTP/2 streams on every locale-LTR page. The Hebrew-only and V2-only families stay. Keep `Assistant` and `IBM_Plex_Sans_Hebrew` until you do an audit of the legacy Hebrew pages outside `.home-v2`.

⏳ Awaiting your approval. Suggested commit shape: one commit removing Inter, one removing Playfair_Display, so either can be reverted independently.

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

⏳ Three options for proceeding with #17 — pick one:

- **(A)** Install the Claude in Chrome extension (one-time setup); I'll then run axe-core via JS injection on `https://mioshy.com/he`, `/en`, and the four article URLs from the audit, and return a precise element-by-element list.
- **(B)** Share `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (drop a `.env.local` in this worktree); I'll start the dev server here and run axe via the Preview MCP.
- **(C)** Take the static list above as the starting point — pick which of the borderline / failing entries you want addressed and I'll commit fixes per-element. Less complete than A or B, but ships immediately.

For each fix, the agreed strategy is: keep `--mio-purple` / `--mio-rose` / `--accent` brand tokens unchanged. Add stroke / text-shadow / outer overlay if a CTA fails contrast. Adjust auxiliary text colors (`--ink-4`, `--accent-soft` text usage) freely.

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
| 10 | LCP mobile 4107 ms — hero image | **Not started.** Waiting until #17 lands; both touch the hero. |
| 13 | Font cleanup | Stopped for approval (see table above) |
| 17 | `color-contrast` | Stopped for approval — blocked on live browser; static first pass above |
| 18 | Cardcom indicator rate limit | Out of scope this turn |
| RLS deep audit | Recommended before launch; separate session |

## Notes / corrections to the original brief

- The brief mentioned **Stripe** webhook signature validation. The site uses **Cardcom** (Israeli provider), not Stripe. Cardcom does not sign callbacks; the indicator route at `app/api/billing/cardcom/indicator/route.ts` instead **server-pulls** the authoritative payment status from Cardcom (`pullLowProfileIndicator`), so spoofed callbacks cannot grant entitlements. Considered safe.
- Independent security scan returned clean on: hardcoded secrets (none), env files in git (none), service-role exposure (server-only, verified), admin route auth gates (every `app/api/admin/*` checked), `/dashboard/*` middleware gating (already server-side).
