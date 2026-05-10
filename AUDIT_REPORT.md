# mioshy.com — Audit Implementation Report

_Implementation log for the work plan in `AUDIT_PLAN.md`._
_Run started 2026-05-10. Branch: `claude/optimistic-rubin-687c12`._

## Status

**Batch A (Critical / Low Risk) — complete.** 8 commits landed, `next build` exited 0.
**Batch B (Med Risk) — pending approval before any of #8, #9, #12, #13, #17 starts.**

## Commits in this batch (Batch A)

| Commit | Finding | What changed | Why it's safe |
|---|---|---|---|
| `11c1d30` | #1 Public seed-games | Deleted `app/api/seed-games/route.ts` | Codebase has zero references; an earlier commit (`d7c0728`) had already removed it once; `seed_runner.mjs` is the supported seeding path. |
| `1b316c5` | #2 `<html lang>` only client-side | Middleware stamps `x-mioshy-locale`; root layout reads via `next/headers` and applies `lang`/`dir` server-side; deleted `LocaleAttributes` | Middleware already mutates request headers for Supabase; adding one more is an additive change. URL prefix wins, with detectLocale fallback so behavior is unchanged for users. |
| `cb42db5` | #3, #16 No JSON-LD on HomepageV2 | Added `lib/seo/jsonLd.ts` with `safeJsonLd()` (escapes `<` to `<`), `organizationJsonLd()`, `webSiteJsonLd()`. Wired both into HomepageV2. | HomepageV2 is a server component, so JSON-LD ships in initial HTML. The escape helper hardens against `</script>` breakouts. |
| `d6bde9e` | #4 No `/llms.txt` | Created `public/llms.txt` (bilingual) | Static file in `public/` — zero runtime impact. |
| `db6689e` | #7 Heading order skip | `<h4>` → `<h3>` in three pillars in `AdultGames.tsx`; updated `.ag-pillar h4` → `.ag-pillar h3` in `styles.css` | Visual styling preserved (CSS selector renamed, properties identical). Heading order now reads h2 → h3 → h3. |
| `debd628` | #11 Unused CSS | Moved `@uiw/react-md-editor` and `react-markdown-preview` `@import` from `app/globals.css` to `components/dashboard/ArticleForm.tsx` | Editor is dynamically imported (`ssr: false`) and the only consumer; CSS imported alongside a "use client" component is bundled with that component's chunk, so the dashboard editor still gets its styles, but every public page stops shipping ~37 KB of editor CSS. |
| `fdd534c` | #14 Network dependency tree | Added `<link rel="preconnect">` for `fonts.googleapis.com` and `fonts.gstatic.com` to root layout `<head>` | Pure hint — browsers without preconnect support ignore it. Existing Supabase preconnect untouched. |
| `97b3afc` | #15 GA4/GTM | New `components/analytics/GoogleTagManager.tsx`, mounted in root layout. Includes Consent Mode v2 defaults set to `denied` for ad/analytics storage. | GTM container `GTM-5WQQB3R` wraps GA4 (`G-E7LRXB8XN0`) and Google Ads (`AW-457802965`); script uses Next's `<Script strategy="afterInteractive">` so first paint isn't blocked. Consent defaults are denied, so until a banner ships the page is in the privacy-safe state. |

## Verification

- `next build` — exit 0, no new warnings. Route count unchanged except for the deleted `/api/seed-games`.
- All 8 commits visible via `git log --oneline game..HEAD`.
- Audit rules expected to flip from `fail` → `pass` after deploy:
  - `tech.html_lang_present` (#2)
  - `schema.jsonld_present` (#3)
  - `schema.org_or_website_type` (#3)
  - `ai.llms_txt_present` (#4)
  - `tracking.gtm_present` (#15)
  - `tracking.ga4_present` (#15)
  - PSI `heading-order` should rise from 0/100 (#7)
  - PSI `unused-css-rules` should rise from 0/100 (#11) — public-page bundles drop the md-editor CSS
  - PSI `network-dependency-tree-insight` should improve (#14)

## Items NOT yet touched — awaiting your approval

These are **Med Risk** and the agreed protocol is to stop for explicit approval before each:

| # | Issue | Why it needs a separate decision |
|---|---|---|
| 8 | Security headers (CSP, HSTS, XFO, XCTO, Referrer, Permissions) | CSP can break framer-motion / Supabase realtime / inline JSON-LD / GTM. Plan: moderate first (`'unsafe-inline'` allowed in `script-src`), nonce migration in a separate commit. |
| 9 | Redirect chain `www → apex → /he` | User selected: rewrite (preferred) or 308. Need final pick. Recommendation: rewrite, since it eliminates the hop entirely and Vercel's CDN can still cache. |
| 12 | `noStore()` on HomepageV2 | User pre-approved approach: replace with `export const revalidate = 60`. Confirmation to execute. |
| 13 | 8 font families in root layout | Need usage list before any removal — will produce when approved. |
| 17 | `color-contrast` 0/100 | Need to run axe + Lighthouse locally and produce element list with current/target ratios. Pre-decided fallback: stroke/shadow/overlay rather than swap brand colors. |

## Out of scope (acknowledged)

- #5 `/.well-known/ai.json`, #6 `/brand.json` — low-priority AEO files, can land in a tiny follow-up commit.
- #18 Cardcom indicator rate limit — DoS hardening; not in this engagement.
- RLS policy deep audit — recommended before launch; separate session.

## Manual handoffs (you, not me)

- ✅ GTM `GTM-5WQQB3R`, GA4 `G-E7LRXB8XN0`, Google Ads `AW-457802965` are wired in code.
- ⏳ In Vercel domains panel, confirm `www.mioshy.com → mioshy.com` is configured. Once that's done at the edge, the redirect block in `next.config.mjs` can be removed (#9 will revisit this).
- ⏳ After deploy: re-run PSI on `https://mioshy.com` (mobile + desktop), and re-run the VOW Auditor scan, to verify the rule statuses listed above.
- ⏳ Wipe Supabase test data before launch (separate task).
- ⏳ When ready to add a consent banner, call `gtag('consent', 'update', {...})` from a new component — no GTM container changes needed.

## Notes / corrections to the original brief

- The brief mentioned **Stripe** webhook signature validation. The site uses **Cardcom** (Israeli provider), not Stripe. Cardcom does not sign callbacks; the indicator route at `app/api/billing/cardcom/indicator/route.ts` instead **server-pulls** the authoritative payment status from Cardcom (`pullLowProfileIndicator`) so spoofed callbacks cannot grant entitlements. Considered safe.
- Independent security scan returned clean on: hardcoded secrets (none), env files in git (none), service-role exposure (server-only, verified), admin route auth gates (every `app/api/admin/*` checked), `/dashboard/*` middleware gating (already server-side).
