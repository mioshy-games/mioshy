# i18n Audit Report — mioshy.com

**Date:** 2026-05-17
**Scope:** Read-only audit of the i18n infrastructure before redesigning the root-redirect / canonical / hreflang strategy.
**Worktree:** `affectionate-bartik-fa0d23` (branch `claude/affectionate-bartik-fa0d23`, parent `game`).

---

## TL;DR

The site **already has** a real i18n stack: Next.js 14 App Router + `next-intl` v4 + a custom `middleware.ts` that does `x-vercel-ip-country` + `Accept-Language` detection and 302-redirects `/` to `/he` or `/en`. **The `mioshy.com` / `mioshy.com/he` "duplicate content" you described should not happen in the user's browser** — the middleware 302s root every time. What is actually missing:

1. **No locale cookie.** The redirect is recomputed on every visit. The user's last manual pick is never remembered.
2. **Inconsistent `alternates`.** Only ~12 out of ~38 locale routes emit canonical + hreflang. The other ~26 (including `/he`, `/en`, `/contact`, `/privacy`, `/terms`, `/how-it-works`, `/about/founder`, all `/my/*`, `/journey/timeline*`, `/invite/[token]`, `/paywall`, `/billing/*`, etc.) inherit only `metadataBase` and have no `<link rel="alternate" hreflang>` and no explicit canonical.
3. **`og:locale` / `og:locale:alternate` is never emitted anywhere.**
4. **`LocaleSwitcher.tsx` exists but is dead code** — the live switcher is inline in `SiteFooter.tsx`. Both use `<Link locale="...">` from next-intl; neither writes a cookie.
5. **Default locale is `he` even for non-IL, non-Hebrew users.** Line 31 of `middleware.ts`: `return "he";` is the fallback for everyone else. SEO-wise that funnels every non-IL non-`he` Accept-Language to Hebrew, which is probably not what we want.

---

## A. Framework & Dependencies

### Framework

- **Next.js 14.2.35**, **App Router** (`app/` directory present, no `pages/` directory).
- React 18.
- Bundler: `next dev --turbo` for dev, default webpack for `next build`.

### Hosting

Confirmed by file presence + code references:

| Signal | Result |
|---|---|
| `vercel.json` | ✅ Present (crons config only) |
| `netlify.toml` | ❌ Not present |
| `wrangler.toml` (Cloudflare Workers) | ❌ Not present |
| `Dockerfile` / `docker-compose.yml` | ❌ Not present |
| `fly.toml`, `render.yaml`, `railway.toml` | ❌ Not present |
| `.github/workflows/*.yml` | ❌ Not present (no `.github/` dir) |
| `process.env.VERCEL_ENV` in code | ✅ `next.config.mjs:49` |
| `x-vercel-ip-country` header read | ✅ `middleware.ts:21` |
| `@vercel/*` npm packages | ❌ None installed |

**Verdict: Vercel-only.** No Cloudflare proxy in front, no CI workflows, no containerised deploy. The build/deploy pipeline is whatever Git push → Vercel auto-deploys.

### Existing Geo-IP signals in code

| Pattern | Where | Notes |
|---|---|---|
| `request.headers.get("x-vercel-ip-country")` | `middleware.ts:21` | Used for the root-path locale redirect — **this is the live geo signal.** |
| `request.geo` / `req.geo` (Next.js convenience) | **Not used anywhere** | Code prefers the header form. Equivalent data; header is more portable. |
| `cf-ipcountry` / `CF-IPCountry` | **Not used anywhere** | Confirms no Cloudflare proxy. |
| `cf-connecting-ip` | `lib/rate-limit.ts:73` | Defensive IP extraction fallback after `x-forwarded-for` and `x-real-ip`. **Not** evidence of CF in front — just a belt-and-braces for future. |
| External Geo-IP APIs (ipapi.co, ip-api.com, MaxMind) | **Not used anywhere** | No HTTP calls to geo services. |

### i18n libraries

```json
// package.json:40
"next-intl": "^4.9.1",
```

That's the only i18n library. No `next-i18next`, no `react-i18next`, no `lingui`.

### Wiring

- [next.config.mjs:1-3](../next.config.mjs:1) wires the `next-intl` plugin:
  ```ts
  import createNextIntlPlugin from "next-intl/plugin";
  const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
  ```
- [i18n/routing.ts:1-10](../i18n/routing.ts:1):
  ```ts
  export const routing = defineRouting({
    locales: ["he", "en"],
    defaultLocale: "he",
    localePrefix: "always",   // every URL must start with /he or /en
  });
  ```
- [i18n/request.ts](../i18n/request.ts) — loads `messages/{locale}.json` for each request.
- [navigation.ts:1-5](../navigation.ts:1) — exports `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `createNavigation(routing)`.

### `next.config.mjs` — i18n-relevant excerpts

- **No built-in `i18n` block** (which is correct for App Router + next-intl).
- One `redirects()` rule, www → apex:
  ```js
  // next.config.mjs:35-46
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mioshy.com" }],
        destination: "https://mioshy.com/:path*",
        permanent: true,
      },
      // TODO(old-urls): Add 301 mappings from the legacy site once exported …
    ];
  }
  ```
- Preview deployments are noindexed via `X-Robots-Tag` header (`next.config.mjs:48-62`).
- Webpack cache disabled in dev only.
- No `trailingSlash`, no `output: "export"`, no static-export mode.

### `vercel.json`

Pure cron config (billing renewals, journey cadence, etc.). **No** rewrites / headers / redirects in `vercel.json`. Safe to add middleware logic without it interfering.

### Middleware

[middleware.ts](../middleware.ts) — present and substantive. Three jobs:

1. **Supabase auth refresh** (`updateSession`, all routes that match).
2. **Admin gate** for `/dashboard/*` (requires `profiles.role === 'admin'`).
3. **Single-session enforcement** for `/(en|he)/account` and `/(en|he)/billing`.
4. **Root-path locale redirect** (lines 93-100):
   ```ts
   if (request.nextUrl.pathname === "/") {
     const locale = detectLocale(request);
     const url = request.nextUrl.clone();
     url.pathname = `/${locale}`;
     const redirect = NextResponse.redirect(url, { status: 302 });
     copyAuthCookiesToResponse(supabaseResponse, redirect);
     return redirect;
   }
   ```
5. **Hands off to** `intlMiddleware = createIntlMiddleware(routing)` for everything else.

`detectLocale` priority (`middleware.ts:19-32`):

1. `x-vercel-ip-country === "IL"` → `he`.
2. `accept-language` contains `\bhe\b` → `he`.
3. `accept-language` contains `\ben\b` AND we have a `country` header → `en`.
4. Default → `he`.

Matcher: `["/((?!api|_next|_vercel|.*\\..*).*)"]` — skips api, internal, and static files.

---

## B. Route Structure

### Tree (i18n-relevant only)

```
app/
├── layout.tsx                    # ROOT layout — sets <html> (no lang/dir), site metadata
├── not-found.tsx                 # 404, noindex
├── sitemap.ts                    # dynamic sitemap, both locales emitted
├── api/                          # NOT under [locale] — locale-agnostic
├── dashboard/                    # NOT under [locale] — admin tool, locale-agnostic
└── [locale]/
    ├── layout.tsx                # generateMetadata(title,description) only; sets up NextIntlClientProvider, Chrome
    ├── page.tsx                  # marketing home (HomepageV2 default; ?old=1 legacy)
    ├── about/founder/page.tsx
    ├── account/                  # /account, /account/profile (auth-protected)
    ├── adults/                   # /adults, /adults/[slug], /adults/[slug]/play
    ├── articles/                 # /articles, /articles/[slug]
    ├── auth/                     # /auth, /auth/signup
    ├── between-us/               # /between-us, /between-us/[slug]
    ├── billing/                  # /billing, /billing/success, /billing/error
    ├── contact/page.tsx
    ├── dashboard/page.tsx        # NOTE: also a [locale]/dashboard — see "Surprises" below
    ├── game/                     # /game, /game/local, /game/[roomCode], /game/[roomCode]/snakes
    ├── games/                    # /games, /games/[slug], /games/truth-or-dare
    ├── how-it-works/page.tsx
    ├── invite/[token]/page.tsx
    ├── journey/                  # /journey, /journey/assessment, /journey/timeline, /journey/timeline/[scheduledId]
    ├── my/                       # /my, /my/games, /my/journey, /my/adults
    ├── paywall/page.tsx
    ├── pricing/page.tsx
    ├── privacy/page.tsx
    ├── products/page.tsx
    └── terms/page.tsx
```

### How `/he` and `/en` are served

- One single `app/[locale]/...` tree → both languages share components and pages.
- `app/[locale]/layout.tsx:13-15` statically generates both locales:
  ```ts
  export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
  }
  ```
- Language-specific copy lives in `messages/he.json` (52 KB) and `messages/en.json` (42 KB). Both also have stale `.bak` files in the repo (housekeeping flag).
- The layout sets `setRequestLocale(locale)` and wraps children in `NextIntlClientProvider`. **It does not set `<html lang>` / `<html dir>`** — that is done client-side by `LocaleAttributes.tsx` in a `useEffect`.

### What happens at `mioshy.com/`

[middleware.ts:93-100](../middleware.ts:93) intercepts `pathname === "/"` and 302-redirects to `/{detectLocale}`. **So `mioshy.com` should never be served as content.** If you observed both `mioshy.com` and `mioshy.com/he` returning Hebrew content with no redirect, that points at one of:
- A cached response in a CDN / browser.
- A previous deployment that did not have the middleware (the redirect logic is in code now, but you may be seeing it from before the change shipped, or from a route that bypasses the matcher).
- Crawler-cached state (Google's cached version).

The matcher excludes static files and `_next` / `_vercel`, so it does not get accidentally skipped for `/`.

### Coverage parity (he vs en)

All routes under `app/[locale]/...` are served at both `/he/<route>` and `/en/<route>` by the build's `generateStaticParams`. Page bodies pick between Hebrew and English content from `messages/*.json`. **No route is locale-exclusive in code** — i.e., there is no `app/he-only/...` or `app/en-only/...`. Any user-visible asymmetry is content-level (one language's translation may be empty / placeholder), not route-level.

---

## C. Existing Meta Tags

### Root metadata (`app/layout.tsx`)

[app/layout.tsx:22-60](../app/layout.tsx:22):
```ts
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Mioshy - Couples games that warm up the connection", template: "%s · Mioshy" },
  description: "Mioshy is a platform for couples - games, an online couple-therapy track …",
  applicationName: "Mioshy",
  openGraph: {
    type: "website",
    siteName: "Mioshy",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "Mioshy - Couples games" }],
  },
  twitter: { card: "summary_large_image", images: ["/images/og-default.png"] },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};
```

- `metadataBase` is set — so per-page relative URLs resolve.
- **No site-wide `alternates.languages` or `openGraph.locale`** here.

### Locale layout (`app/[locale]/layout.tsx`)

[app/[locale]/layout.tsx:17-28](../app/[locale]/layout.tsx:17):
```ts
export async function generateMetadata({ params }) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("title"), description: t("description") };
}
```

**No** canonical, **no** alternates.languages, **no** openGraph.locale. So every child page that does NOT itself emit `alternates` gets nothing for hreflang.

### Per-page alternates (canonical + hreflang)

`alternates` is emitted on **12 of ~38** locale-aware routes:

| Route | Canonical | hreflang | x-default |
|---|---|---|---|
| `/[locale]` | ✅ | ✅ | en |
| `/[locale]/products` | ✅ | ✅ | en |
| `/[locale]/articles` | ✅ | ✅ | en |
| `/[locale]/articles/[slug]` | DB-driven (`a.canonical_url`) or default | ✅ | en |
| `/[locale]/adults` | ✅ | ✅ | en |
| `/[locale]/adults/[slug]` | ✅ | ✅ | en |
| `/[locale]/game` | ✅ | ✅ | en |
| `/[locale]/game/local` | ✅ | ✅ | en |
| `/[locale]/journey` | ✅ | ✅ | en |
| `/[locale]/games` | ✅ | ✅ | en |
| `/[locale]/games/[slug]` | ✅ | ✅ | en |
| `/[locale]/pricing` | ✅ | ✅ | en |

Example shape (from [app/[locale]/page.tsx:46-53](../app/%5Blocale%5D/page.tsx:46)):
```ts
alternates: {
  canonical: `${base}/${locale}`,
  languages: {
    en: `${base}/en`,
    he: `${base}/he`,
    "x-default": `${base}/en`,
  },
},
```

**Missing `alternates` on (26 routes):** `/how-it-works`, `/contact`, `/privacy`, `/terms`, `/about/founder`, `/my`, `/my/games`, `/my/journey`, `/my/adults`, `/account`, `/account/profile`, `/auth`, `/auth/signup`, `/journey/timeline`, `/journey/timeline/[scheduledId]`, `/journey/assessment`, `/invite/[token]`, `/paywall`, `/billing`, `/billing/success`, `/billing/error`, `/dashboard` (inside `[locale]`), `/between-us`, `/between-us/[slug]`, `/adults/[slug]/play`, `/game/[roomCode]`, `/game/[roomCode]/snakes`, `/games/truth-or-dare`.

Some of those *should* be noindexed (`/account/*`, `/billing/*`, `/auth/*`, `/paywall`, `/dashboard`, `/game/[roomCode]*`, `/adults/[slug]/play`) but currently none of them set `robots: { index: false }` either — robots.txt blocks them (see section F).

### Open Graph locale

`grep -rn "og:locale\|openGraph.*locale"` in `app/` and `components/` returns **only one match**, and it's a `siteName` line (false positive). **No page emits `og:locale` or `og:locale:alternate`.** That is missed SEO/social-share metadata.

### `<html lang>` / `<html dir>`

[app/layout.tsx:127](../app/layout.tsx:127) renders `<html suppressHydrationWarning className={…}>` with **no `lang` / `dir`**. They are written in `LocaleAttributes` client-side:
```tsx
// components/LocaleAttributes.tsx:9-12
useEffect(() => {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
}, [locale]);
```

**Risk:** the HTML stream delivered by SSR has no `lang` / `dir`. Search crawlers and screen readers read the HTML before JS runs. Setting `lang` / `dir` in `app/[locale]/layout.tsx`'s `<html>` (or via a server component returning a wrapper) would be cleaner.

---

## D. Cookie / Language State

### Cookie

**There is NO locale cookie anywhere in the code.** `grep -rn "NEXT_LOCALE\|locale.*cookie\|cookie.*locale" app/ components/ lib/ i18n/ middleware.ts` returns nothing.

`next-intl` v4 supports an optional `localeDetection` cookie when `localePrefix` is `"as-needed"` — but our config is `localePrefix: "always"`, so even if we enabled it, every URL has the locale in the path and the cookie is largely informational. We'd need to wire one ourselves.

The only cookies the middleware touches:
- Supabase auth cookies (`updateSession` / `copyAuthCookiesToResponse`).
- `SESSION_COOKIE` from `lib/auth/session-enforcement.ts` (single-session enforcement) — not a locale cookie.

### State management

- No Redux / Zustand store holds locale. The single source of truth is the URL segment `/he` vs `/en`, surfaced via `useLocale()` from next-intl.
- `next-intl`'s `NextIntlClientProvider` (`app/[locale]/layout.tsx:85`) exposes `messages` and `locale` to client components.

### Language switcher

Two pieces exist; only one is used.

**(a) Dead code:** [components/LocaleSwitcher.tsx](../components/LocaleSwitcher.tsx)
```tsx
import { Link, usePathname } from "@/navigation";
…
<Link key={loc} href={pathname} locale={loc} className={…}>{loc.toUpperCase()}</Link>
```
`grep -rn "LocaleSwitcher" app/ components/` shows it's never imported. ⚠️ orphaned component.

**(b) Live switcher:** inline in [components/SiteFooter.tsx:100-125](../components/SiteFooter.tsx:100)
```tsx
<Link href={pathname} locale="he" className={…}>{t("hebrew")}</Link>
<span aria-hidden …>/</span>
<Link href={pathname} locale="en" className={…}>{t("english")}</Link>
```
Same mechanism (next-intl `Link` with `locale` prop). Navigates to the same pathname in the chosen language. **No cookie is set on click.** Subsequent visits to `/` re-detect from IP/Accept-Language.

---

## E. Geo-IP

### Today

- The middleware reads `request.headers.get("x-vercel-ip-country")` (`middleware.ts:21`). This header is set automatically by Vercel's edge on every request — **zero latency, zero cost, no external dependency**.
- It only consults the country code; no city / region / lat-lon usage anywhere relevant to i18n.
- `request.geo` (the higher-level object on Vercel's `NextRequest`) is **not** used. Header-based reading is equivalent and slightly more portable.

### Options matrix (per your preference order)

| Priority | Option | Available here? | Latency | Cost | Verdict |
|---|---|---|---|---|---|
| 1 | **`request.geo` (Vercel)** or equivalently the `x-vercel-ip-country` header | ✅ Hosting is Vercel; header is already populated and **already in use** at `middleware.ts:21` | 0 ms | Free | **This is the right one.** |
| 2 | `cf-ipcountry` (Cloudflare) | ❌ Site is **not** behind Cloudflare (no `wrangler.toml`, no CF-IPCountry reads in code, only a defensive `cf-connecting-ip` fallback in `lib/rate-limit.ts:73` that never fires on Vercel) | 0 ms | Free | Not applicable. |
| 3 | ipapi.co / ip-api.com (HTTP fallback) | n/a | 50–300 ms per call | Free up to 1k/day; rate-limited | **Not needed**, because option 1 already works on every request. |
| 4 | MaxMind GeoLite2 (self-hosted DB) | n/a | <1 ms after warm load | Free, but monthly DB refresh required | **Excluded per your preference.** |

### Cost / quality / latency

`x-vercel-ip-country` is essentially free (just a header read on the existing function invocation) and adds **0 ms latency**. Vercel's geo data is MaxMind GeoLite-grade, so accuracy is the same as option 4 without the DB-refresh cron. For "is this user in Israel?" — and that's the only question we ask — it is more than sufficient.

### Recommendation

**Keep using `x-vercel-ip-country` as it is today.** Specifically:

- Do not switch to `request.geo` — it returns the same data, requires the type-juggling `NextRequest` cast, and is marked deprecated in Next.js 15 in favour of `@vercel/functions geolocation()`. The header read is the most stable form.
- Do not add `@vercel/functions geolocation()` — it would be a new dependency for zero new capability.
- Do not add an HTTP fallback (ipapi.co / ip-api.com) — that 50–300 ms hit on every middleware run would be a regression. On Vercel the header is **always** populated for real visitor traffic; the only time it's missing is local dev (`pnpm dev`), and the existing code's `country && /\ben\b/` branch + final `return "he"` already handles that gracefully.
- Do not add MaxMind — excluded per your preference, and unnecessary given option 1 works.

---

## F. Existing SEO Surface

### `robots.txt` ([public/robots.txt](../public/robots.txt))

```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /api/
Disallow: /auth/
Disallow: /paywall/
Disallow: /account/
Disallow: /billing/
Disallow: /game/local
Disallow: /game/*/snakes
Disallow: /*?preview=
Disallow: /*?debug=

User-agent: Googlebot-Image
Allow: /

Sitemap: https://mioshy.com/sitemap.xml
```

**Note:** these `Disallow` rules are written **without** the locale prefix. e.g. `Disallow: /auth/` does NOT block `/he/auth/`. Need to verify whether Google honours this as a wildcard or not — strict robots syntax would block only literal `/auth/...`, leaving `/he/auth/...` and `/en/auth/...` crawlable. The pages don't set `robots: { index: false }` in their metadata either, so this is a real gap.

### `sitemap.xml` ([app/sitemap.ts](../app/sitemap.ts))

Dynamic, generates at build/request time. ✅ Includes both `/en/*` and `/he/*` variants for every URL, with cross-linked `alternates.languages` per entry (xml `<xhtml:link rel="alternate" hreflang>` annotations). Includes static pages plus DB-driven `articles`, `games`, and `experience_games` (`/adults/...`).

```ts
// app/sitemap.ts:38-44
function langAlternates(site: string, path: string) {
  return {
    en: `${site}/en${path}`,
    he: `${site}/he${path}`,
    "x-default": `${site}/en${path}`,
  };
}
```

**Gap:** static path list at `app/sitemap.ts:50-60` includes only marketing pages. `/how-it-works`, `/contact`, `/privacy`, `/terms`, `/about/founder` are **not** in the sitemap — they're indexable but not advertised.

### `metadataBase`

Defaults to `https://mioshy.com` (`app/layout.tsx:22-24`), overridable via `NEXT_PUBLIC_SITE_URL`. So OG / canonical absolute URL resolution is handled correctly site-wide.

### Preview deployment hygiene

[next.config.mjs:48-62](../next.config.mjs:48) injects `X-Robots-Tag: noindex, nofollow` on every response when `VERCEL_ENV === "preview"`. ✅ Good — preview URLs won't be indexed.

### Visible SEO bugs

- **`<html>` is missing `lang` and `dir`** in SSR output (see Section C). Currently only set client-side. Fix: pass `locale` into the root layout (move `<html>` into `[locale]/layout.tsx`, which is the canonical App Router pattern when every page is locale-prefixed).
- **Default locale = `he` for non-IL, non-Hebrew users.** The current `detectLocale` returns `he` as the catch-all for every visitor whose `Accept-Language` lists neither `he` nor `en` AND who isn't from Israel. That sends global traffic to Hebrew. Likely should default to `en` (matching `x-default: en` already declared in `alternates`).
- **No locale cookie.** A user who manually picks `en` on `/he` lands at `/en`; on next visit, they re-hit `mioshy.com/`, the middleware ignores their previous pick, and they may be sent to `/he` again. Friction.
- **`og:locale` missing everywhere.** Facebook / WhatsApp unfurlers default to `en_US` and won't switch locale per page.
- **26 pages lack `alternates`** — they will inherit no hreflang. For internal pages (`/account`, `/billing`, `/auth`, `/paywall`, etc.) this is fine; for marketing-adjacent pages (`/how-it-works`, `/contact`, `/privacy`, `/terms`, `/about/founder`) it's a real gap.
- **`messages/*.json.bak` files** are checked in (`messages/en.json.bak`, `messages/he.json.bak`). Minor housekeeping; remove or `.gitignore`.

---

## G. Risks Before Touching i18n

### 1. Middleware that does an IP-based redirect on `/`

**Already exists.** Any rewrite should be an *enhancement* of the existing block at `middleware.ts:93-100`, not a replacement. Specific risks:

- **Cookie-precedence ordering.** If we add a `mio_locale` cookie, the precedence has to be (a) cookie → (b) Geo-IP → (c) Accept-Language → (d) default. Today the code goes straight to Geo-IP. Easy to wire, but make sure the cookie check happens **before** the Geo-IP check.
- **The middleware also redirects auth-protected paths**. Lines 47-67 redirect `/dashboard/*` for non-admins to `/` — which then bounces through the locale redirect. Two-hop redirects are fine but worth knowing.
- **Single-session enforcement at lines 70-88** issues a redirect to `/${locale}/auth?kicked=1` based on a path-sniff (`pathname.startsWith("/he")`). If you ever stop including the locale prefix in some URLs that path-sniff breaks. Today `localePrefix: "always"` keeps it safe.
- **No locale cookie should be set on the bot path.** Many crawlers send no cookie and identify only by user-agent. Setting a cookie is fine, but we want to avoid serving them a 302 to a non-`x-default` page that contradicts canonical/hreflang on the target.

### 2. Changing canonical / hreflang tags

- **Articles already use a DB-driven canonical** (`a.canonical_url`, `app/[locale]/articles/[slug]/page.tsx:80-81`). If we standardise the format we must respect the DB override path — some legacy articles point canonical to a foreign URL on purpose.
- All 12 existing pages use `${base}/${locale}/...` with `x-default: en`. If we want `x-default` to point to `/` (which lets the middleware resolve language for the bot) we'd need to update every page individually OR centralise via a helper. Today there is no shared helper — each page hand-rolls the `alternates` object.

### 3. Adding a locale cookie

- We're behind Vercel. Cookies survive across edge regions transparently. No infra risk.
- `path=/` + `max-age=31536000` is what we want. Note: `next-intl` reads URL only and never reads a cookie — so we set it ourselves and read it only in `middleware.ts`.
- Avoid setting it on **every** request; only set / refresh on (a) entry to a locale path the user has explicitly navigated to via the switcher, or (b) when middleware detects the cookie missing and is about to do a Geo-IP redirect. Otherwise SSR caching for crawlers becomes hard.
- The cookie should not be `httpOnly` if we ever want client JS to read it. Probably we don't need client access — middleware-only is enough.
- **Anonymity / privacy:** a locale cookie is not personal data, but it does survive logout. Document it in the privacy page if your privacy policy enumerates cookies (it should).

### Next.js config interactions

- ❌ No `i18n` block in `next.config.mjs` — good. Adding one would conflict with `next-intl`.
- ❌ No `trailingSlash: true` — good. Trailing-slash mode complicates middleware path comparisons.
- ❌ No `output: "export"` — good. Static export would break the middleware entirely.
- ❌ No `experimental.middlewarePrefetch` tweaks.
- The `redirects()` block in `next.config.mjs` runs **before** middleware. The only entry is www → apex. Safe.
- `headers()` only injects `X-Robots-Tag` in preview. Won't conflict.

---

## H. Strategy Recommendation

Given the architecture, the cheapest correct path is to **extend the existing middleware** (not replace it) and **fill the metadata gaps**, not to introduce a new library.

### Concrete plan (do not execute yet)

1. **Add a `mio_locale` cookie + read it first in `detectLocale`.**
   ```ts
   function detectLocale(request): "he" | "en" {
     const cookie = request.cookies.get("mio_locale")?.value;
     if (cookie === "he" || cookie === "en") return cookie;
     const country = request.headers.get("x-vercel-ip-country");
     if (country === "IL") return "he";
     const accept = request.headers.get("accept-language") ?? "";
     if (/\bhe\b/i.test(accept)) return "he";
     if (/\ben\b/i.test(accept)) return "en";
     return "en";   // NB: flip default to en (today it's he)
   }
   ```

2. **Write the cookie when:**
   - The middleware just decided the locale on `/` → set cookie on the redirect response with `path=/`, `max-age=31_536_000`, `sameSite=Lax`.
   - The user navigates a locale-prefixed URL that disagrees with the current cookie → refresh the cookie. (Easiest: detect locale from `pathname.startsWith("/he")` and set if differs.)

3. **Flip default locale to `en`** in `detectLocale` (last `return`) so global traffic doesn't land in Hebrew by mistake. Keep `defaultLocale: "he"` in `routing.ts` for next-intl's internal needs.

4. **Move `<html lang>` / `<html dir>` to SSR.** Either (a) move `<html>` into `app/[locale]/layout.tsx` and drop it from `app/layout.tsx` (standard App Router pattern); or (b) pass `locale` into the root layout via headers/cookies. Option (a) is cleaner and matches every next-intl example.

5. **Backfill `alternates` on the 5 missing public pages** (`/how-it-works`, `/contact`, `/privacy`, `/terms`, `/about/founder`). Internal pages (`/account*`, `/billing*`, `/auth*`, `/paywall`, `/dashboard`) should get `robots: { index: false }` instead.

6. **Add `og:locale` + `og:locale:alternate`** to the alternates helper. One-line addition.
   ```ts
   openGraph: {
     locale: locale === "he" ? "he_IL" : "en_US",
     alternateLocale: locale === "he" ? ["en_US"] : ["he_IL"],
     …
   }
   ```

7. **Centralise the alternates shape** in `lib/seo/alternates.ts` so every `generateMetadata` call uses the same helper. Today every page hand-rolls it — easy to drift.

8. **Add `/how-it-works`, `/contact`, `/privacy`, `/terms`, `/about/founder` to the sitemap** static paths array (`app/sitemap.ts:50-60`).

9. **Delete `components/LocaleSwitcher.tsx`** (dead code) **and `messages/*.json.bak`**.

10. **Consider** whether `/games/truth-or-dare` is a legit route or a slug collision (`/games/[slug]` also exists). Quick check at `app/[locale]/games/truth-or-dare/page.tsx` — looks like a special-case override.

### Geo-IP service to use — definitive answer

**Use option 1: `x-vercel-ip-country` (the header you're already reading).**

Why:
- **The hosting check forces this answer.** `vercel.json` is the only deploy config in the repo; there is no `wrangler.toml`, no Netlify, no Docker, no GitHub Actions. The site lives on Vercel exclusively. Option 2 (`cf-ipcountry`) would require putting Cloudflare in front of Vercel, which is real infra work for zero benefit.
- **It's already wired and working.** `middleware.ts:21` reads it. The site has been shipping with this for some time. Switching to anything else is regression risk for no gain.
- **0 ms latency, 0 cost, 0 dependencies.** Option 3 (ipapi.co) would add 50–300 ms per request; option 4 (MaxMind) would add a monthly DB-refresh cron. Both are excluded by your own criteria ("חינמיים וקלים שלא מכבידים על השירות").
- **One small hardening worth doing**: in local dev the header is missing, so `detectLocale` falls into the Accept-Language path. That already works. No fallback service needed.

If we ever move off Vercel — switch to `cf-ipcountry` only **if** we then sit behind Cloudflare. Until that day, the answer is unambiguous.

### Why this is cheaper than any alternative

- We do **not** need a new lib; `next-intl` already does messages + routing.
- We do **not** need a new Geo-IP service; Vercel's header is already populated on every request at zero cost.
- We do **not** need Edge Config / KV / external API — locale detection is one synchronous decision per request from headers + cookie.
- We do **not** need a workflow / queue — locale detection is one synchronous decision per request.
- The expensive work is metadata coverage (~26 routes × small block), which an LLM can do mechanically once the helper is centralised.

---

## Surprises / Half-Done Things Found

These are not part of the brief but I saw them while looking:

- **`components/LocaleSwitcher.tsx` is unreferenced** (dead code).
- **`messages/en.json.bak` and `messages/he.json.bak`** are checked in. The `.bak` strongly implies an in-progress migration that was never cleaned up.
- **`app/[locale]/dashboard/page.tsx` exists** but the real admin dashboard is at `app/dashboard/...` (not under `[locale]`). The `[locale]/dashboard` is probably either a user-facing "my dashboard" page or a leftover stub — worth confirming.
- **TODO in `next.config.mjs:43-45`:**
  ```
  // TODO(old-urls): Add 301 mappings from the legacy site once exported
  // from GSC/Ahrefs/ScreamingFrog. Map high-value URLs to the closest
  // new equivalent; otherwise redirect to "/".
  ```
  Existing technical debt. May overlap with the upcoming i18n work — worth doing the 301 mapping in the same PR if the data is in hand.
- **`robots.txt` blocks `/account/` etc. without the locale prefix**, so `/he/account/` may still be crawlable depending on robots interpretation. Belt-and-braces fix: add `robots: { index: false }` to those pages.
- The `journey-content-system-design.md` etc. in `docs/` are unrelated to i18n.

---

## Open Questions for You

1. **Default locale for non-IL, non-`he`/`en` Accept-Language users.** Today it's `he`. I assume you want `en`. Confirm?
2. **`x-default` target.** Today it's `${base}/en`. Should it stay `/en`, or change to `/` (which would let the middleware re-resolve based on the requester)? Industry practice splits both ways.
3. **Cookie name.** `mio_locale`? `NEXT_LOCALE`? Anything else? (avoid `locale` which is too generic).
4. **Cookie write moment.** Should we set the cookie:
   - (a) only on the manual switcher click, or
   - (b) every time middleware decides at `/`?
   Option (b) means the second visit is exactly the same as the first — no surprise. Option (a) is more privacy-respecting.
5. **Are `/he/account/...` and `/en/account/...` indexed today?** If yes (because robots.txt only blocks `/account/` literally), do you want them blocked by adding `robots: { index: false }` per-page, or by tightening `robots.txt` to `/*/account/`?
6. **`app/[locale]/dashboard/page.tsx`** — keep, rename, or delete? (Mentioned under Surprises.)
7. **Articles `canonical_url` DB column** — keep DB override semantics intact when we centralise canonical / hreflang. Confirm we should keep DB-provided value when present, fallback to URL pattern otherwise. (My read: yes.)
8. **`messages/*.json.bak`** — safe to delete?
9. **`components/LocaleSwitcher.tsx`** — safe to delete (the live one is the inline footer)? Or do you want to *replace* the inline footer code with the component and use the component?
10. **Is `mioshy.com/` actually still showing Hebrew without a redirect?** Per the code it should always 302 → `/he` or `/en`. If you're seeing both URLs return identical content with `200 OK` and no redirect, that's either a stale cache or a deployment issue worth verifying with `curl -I` against production before we change anything.
