# mioshy.com — SEO / Performance / Security Audit Plan

_Generated 2026-05-10 from initial scan + independent security review._

This is the agreed work plan. The implementation log lives in `AUDIT_REPORT.md`.

## Inputs

- **Initial audit brief** — pasted in the original request. Crawled 10 pages, mobile/desktop PSI scores, schema/AI/tracking checks.
- **Independent security scan** — codebase grep for secrets, env files, service-role exposure, admin auth gates, payment webhook validation, CSP/headers, RLS coverage.

## Site Profile

- Stack: Next.js 14 App Router · TypeScript · Tailwind · Framer Motion · Supabase · `next-intl` (he/en, RTL/LTR) · Vercel
- Payments: **Cardcom** (Israeli provider) — _not_ Stripe, despite the audit brief mentioning Stripe.
- Pre-launch — no real customers. Aggressive changes are safe; correctness is the constraint.

## Performance Targets

| Metric | Mobile | Desktop | Target |
|---|---|---|---|
| Performance | 84 | 99 | ≥ 85 |
| LCP | 4107 ms | 880 ms | < 2500 ms |
| CLS | 0.024 | 0.000 | < 0.1 |
| FCP | 2103 ms | 483 ms | < 1800 ms |
| TBT | 21 ms | 38 ms | < 200 ms |

## Independent security scan — closed items

- ✅ No hardcoded secrets in code
- ✅ No `.env*` files tracked in git
- ✅ Service-role Supabase client used only in server components / route handlers
- ✅ Every `app/api/admin/*` route gated by `getAdminSession()` (verified one by one)
- ✅ `/dashboard/*` gated server-side in `middleware.ts`
- ✅ Cardcom payment indicator route verifies authenticity by **server-pulling** the indicator back from Cardcom (`pullLowProfileIndicator`), so spoofed callbacks cannot grant entitlements
- ✅ HTTPS enforced, robots.txt + sitemap present, OG/Twitter meta present
- ✅ FAQ/Article schema already passes on article pages

## Work plan — sorted by severity × low risk first

| # | Issue | File(s) | Category | Severity | Risk | Effort | Proposed fix |
|---|---|---|---|---|---|---|---|
| 1 | Public unauthenticated `GET /api/seed-games` uses service role to delete + reseed wheels | `app/api/seed-games/route.ts` | Security | 🔴 Critical | None — file marked "DELETE after use", was already removed once (commit `d7c0728`) and resurfaced. No script/doc references it. | 5m | Delete the file. Use `seed_runner.mjs` for ad-hoc seeding (already uses service role). |
| 2 | `<html lang>` set only client-side via `useEffect` — initial server HTML has no `lang` | `components/LocaleAttributes.tsx`, `app/layout.tsx`, `middleware.ts` | SEO/A11y | 🟠 High | Low | 15m | Middleware sets `x-mioshy-locale` request header; root layout reads it via `next/headers` and applies `lang`/`dir` server-side. Delete `LocaleAttributes`. |
| 3 | No `Organization` / `WebSite` JSON-LD on the active homepage (HomepageV2) | `components/marketing/v2/HomepageV2.tsx`, `lib/seo/jsonLd.ts` (new) | SEO/AEO | 🟠 High | None | 20m | Add JSON-LD inside HomepageV2 using a `safeJsonLd()` helper that escapes `</` to `<\/` (also covers finding #16 hardening). |
| 4 | No `/llms.txt` | `public/llms.txt` (new) | SEO/AEO | 🟠 High | None | 10m | Bilingual llms.txt listing brand description + key pages. |
| 5 | No `/.well-known/ai.json` | `public/.well-known/ai.json` (new) | SEO/AEO | 🟡 Med | None | 5m | Brand metadata + AI policy. |
| 6 | No `/brand.json` | `public/brand.json` (new) | SEO/AEO | 🟡 Med | None | 5m | Logo, colors, links. |
| 7 | Heading order: `<h2>` → `<h4>` skip in AdultGames | `components/marketing/v2/AdultGames.tsx:46-56` | A11y/SEO | 🔴 Critical | Low | 5m | Replace three `<h4>` with `<h3>`; verify CSS targets via class, not tag. |
| 8 | No security headers (CSP, HSTS, XFO, XCTO, Referrer, Permissions) | `next.config.mjs:42-58` | Security | 🟠 High | Med — strict CSP can break framer-motion / Supabase realtime / inline JSON-LD | 30m | **Moderate first** (`'unsafe-inline'` for scripts), nonce migration in a separate commit. Stop for approval before this. |
| 9 | Redirect chain `www → apex (301) → /he (302)` from `https://www.mioshy.com/` | `next.config.mjs:30-40`, `middleware.ts:90-96` | Perf (mobile) | 🔴 Critical | Med | 20m | Convert root → locale to a **rewrite** (no extra hop); decision: rewrite (preferred) or 308. Stop for approval before this. |
| 10 | LCP mobile 4107ms — hero image | `components/marketing/v2/Hero.tsx:111-119`, `public/images/hero.webp` | Perf | 🔴 Critical | Low | 30m | Add AVIF source, set `fetchPriority="high"`, enforce realistic `sizes`, downsize physical to ≤ 720×900, drop parallax until after first paint. |
| 11 | `@uiw/react-md-editor` CSS imported globally — pulled in on every page | `app/globals.css:1-2` | Perf | 🔴 Critical | Low | 20m | Move both `@import` lines into the dashboard editor component(s). |
| 12 | `noStore()` on HomepageV2 forces SSR-per-request | `app/[locale]/page.tsx:71` | Perf (TTFB) | 🟠 High | Med | 15m | Replace with `export const revalidate = 60` so site_settings updates propagate within 60s, but the page is otherwise statically cached. Stop for approval before this. |
| 13 | 8 font families loaded in root layout | `app/layout.tsx:62-109` | Perf | 🟡 Med | Med — each `--font-*` may be referenced somewhere | 30m | Audit and remove unused families (Inter, Playfair_Display, Assistant likely unused after the V2 redesign). Stop for approval — will produce a usage list first. |
| 14 | No preconnect to `fonts.gstatic.com` | `app/layout.tsx:140-149` | Perf | 🟡 Med | None | 5m | Add `<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="">`. |
| 15 | No GA4 + GTM | `components/analytics/GTMScript.tsx` (new), `app/layout.tsx` | Tracking | 🟡 Med | Low | 30m | GTM container script in `<head>`, `<noscript>` iframe in `<body>`. IDs: `GTM-5WQQB3R` (GTM), `G-E7LRXB8XN0` (GA4), `AW-457802965` (Google Ads — already inside the GTM container). Consent Mode v2 defaults `denied` for future banner. |
| 16 | JSON-LD `dangerouslySetInnerHTML` does not escape `</script>` | 11 sites (`app/[locale]/page.tsx:288`, articles, games, etc.) | Security (hardening) | 🟢 Low | Low | 10m | `safeJsonLd()` helper used by all sites — bundled with #3. |
| 17 | `color-contrast` failing | TBD (browser-driven) | A11y | 🔴 Critical | Med — contrast affects neon brand language | 45m | Run axe + Lighthouse locally, produce element list with current/target ratios. **Pre-decided fallback**: if a primary CTA fails, add stroke/shadow/text-shadow overlay rather than changing brand colors. Stop for approval — will produce list first. |
| 18 | No rate limit on Cardcom indicator (DoS to Cardcom API possible) | `app/api/billing/cardcom/indicator/route.ts` | Security | 🟢 Low | Low | 10m | Per-IP `checkRateLimit` (10/min). _Not in this batch — out of scope for current run._ |

## Execution batches

**Batch A — auto-approved (Critical/Low Risk):**
1, 2, 3, 4, 7, 11, 14, 15. Small commits, run in order, no further approval needed inside this batch.

**Batch B — Med Risk, stop for approval:**
8 (CSP moderate), 9 (redirects), 12 (revalidate=60), 13 (font cleanup — list first), 17 (color contrast — list first).

**Out of scope for this engagement:**
5, 6 — low-priority AEO files. Will be added with #4.
18 — Cardcom rate limit. Track for future.
RLS deep audit — defer to a separate session before launch.

## Manual handoffs after Phase 3

- Add the GTM/GA env vars in Vercel (preview + production) — already provided in this session, will be wired as constants in code per user instruction.
- In Vercel domains panel: confirm `www.mioshy.com → mioshy.com` is handled at the edge (so the `next.config.mjs` redirect can be removed, eliminating one hop in the chain).
- Re-run PSI on https://mioshy.com after deploy.
- Re-run initial scan to verify SEO/AEO rule statuses flip to `pass`.
- Wipe pre-launch test data in Supabase (separate task, before go-live).

## Decisions captured pre-execution

- **#9 redirects:** rewrite preferred (zero hop). 308 only if rewrite is incompatible with locale-segment routing.
- **#12 noStore:** `revalidate = 60`, not full removal — preserves freshness for site_settings.
- **#13 fonts:** present usage list before any removal.
- **#15 tracking:** real IDs ship in code (GTM-5WQQB3R, G-E7LRXB8XN0, AW-457802965 inside GTM); user will register them as a manual checklist item rather than env vars.
- **#8 CSP:** moderate first (`'unsafe-inline'` allowed), nonce migration in a separate commit.
- **#17 contrast:** keep `--mio-purple` / `--mio-rose` brand tokens unchanged; if a CTA fails, add stroke/shadow/overlay rather than swap colors.
- **#1 seed-games:** delete the route. Codebase has zero references; `seed_runner.mjs` covers ad-hoc seeding.
