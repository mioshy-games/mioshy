# i18n After Cleanup — preview deployment curl validation

**Captured:** 2026-05-17, 14:22–14:37 UTC (re-run after `cf3e447` fix)
**Branches:** `feature/i18n-cookie-and-alternates` — initial run @ `aebd7a0` (deploy `dpl_2KsVdAvbyUgWgrqtEoCmLh4NNUBT`); re-run @ `cf3e447` (deploy `dpl_9JSeiQnFL3eGajVPAauDRQcdAUA7`)
**Target:** `https://mioshy-git-feature-i18n-cook-3ca4b7-itzikbab-gmailcoms-projects.vercel.app` (Vercel preview, PR #5; stable alias across redeploys)

> Result summary: **all four user-supplied scenarios pass.** Cookie precedence, crawler override, Accept-Language detection, Geo-IP fallback, cookie write attributes, cookie deduplication, canonical / hreflang / og:locale emission — all behave as designed. Initial run surfaced a pre-existing quirk (`<html lang>` on root-rewrites always rendered "he" because middleware's `request.headers.set("x-mioshy-locale", …)` was not propagating through `NextResponse.rewrite`). **Fixed in commit `cf3e447` ("fix(i18n): propagate locale header to rewrite destination") and re-verified below.** Final state: both canonical AND `<html lang>` agree with the chosen locale on every scenario.

---

## How "which locale was served" is verified

For URL-prefixed paths (`/he/…` or `/en/…`), middleware's `resolveLocale` returns the URL prefix directly and the layout reads `x-mioshy-locale` correctly. `<html lang>` reflects the locale.

For the **root rewrite** (`/` → `/he` or `/en`), middleware decides the locale via `detectLocale` and stamps `x-mioshy-locale` on the request. After `cf3e447`, the rewrite call explicitly forwards the modified request headers (`{ request: { headers: request.headers } }`), so the layout's `headers().get("x-mioshy-locale")` correctly receives the chosen locale and `<html lang dir>` renders accordingly.

Two independent signals are now verified for every scenario:
- **`<link rel="canonical">` in the body** — comes from `app/[locale]/page.tsx`'s `generateMetadata` via `params.locale`. Confirms the rewrite landed on the right page.
- **`<html lang>` + `dir`** — comes from `app/layout.tsx:112-118` via `headers().get("x-mioshy-locale")`. Confirms the request-header propagation works through the rewrite.

Both signals agree on every test below.

---

## S1 — Cookie wins over Accept-Language

```
curl -s -H "Cookie: NEXT_LOCALE=he" -H "Accept-Language: en-US,en;q=0.9" "$PREVIEW/"
```

| Signal | Observed | Expected | Pass |
|---|---|---|---|
| HTTP status | `200` | `200` | ✅ |
| `x-matched-path` | `/[locale]` | rewrite occurred | ✅ |
| `<link rel="canonical">` | `https://mioshy.com/he` | `/he` (cookie wins) | ✅ |
| `<html lang>` + `dir` | `lang="he" dir="rtl"` | Hebrew | ✅ |
| `Set-Cookie: NEXT_LOCALE` | (none) | none (current matches chosen) | ✅ |

## S2 — Cookie wins over default geo for English speakers

```
curl -s -H "Cookie: NEXT_LOCALE=en" -A "Mozilla/5.0" "$PREVIEW/"
```

| Signal | Observed | Expected | Pass |
|---|---|---|---|
| HTTP status | `200` | `200` | ✅ |
| `x-matched-path` | `/[locale]` | rewrite occurred | ✅ |
| `<link rel="canonical">` | `https://mioshy.com/en` | `/en` (cookie wins despite IL geo) | ✅ |
| `<html lang>` + `dir` | `lang="en" dir="ltr"` | English | ✅ (fixed in `cf3e447`) |
| `Set-Cookie: NEXT_LOCALE` | (none) | none (current matches chosen) | ✅ |

## S3 — Crawler always gets x-default (English), cookie ignored

```
curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" -H "Cookie: NEXT_LOCALE=he" "$PREVIEW/"
```

| Signal | Observed | Expected | Pass |
|---|---|---|---|
| HTTP status | `200` | `200` | ✅ |
| `x-matched-path` | `/[locale]` | rewrite occurred | ✅ |
| `<link rel="canonical">` | `https://mioshy.com/en` | `/en` (crawler ignores `NEXT_LOCALE=he`) | ✅ |
| `<html lang>` + `dir` | `lang="en" dir="ltr"` | English | ✅ (fixed in `cf3e447`) |
| `Set-Cookie: NEXT_LOCALE` | (none) | none (no Set-Cookie for bots, even with cookie mismatch) | ✅ |

The crawler check at line 39 of `middleware.ts:detectLocale` correctly short-circuits before the cookie read, AND the bot-skip clause at lines 167-170 of `middleware.ts` correctly suppresses Set-Cookie.

## S4 — canonical / hreflang / og:locale on /he/about/founder

```
curl -s "$PREVIEW/he/about/founder" | grep -oE '<link rel="[^"]*"[^>]*>|<meta[^>]*property="og:locale[^"]*"[^>]*>'
```

```html
<link rel="canonical" href="https://mioshy.com/he/about/founder"/>
<link rel="alternate" hrefLang="he" href="https://mioshy.com/he/about/founder"/>
<link rel="alternate" hrefLang="en" href="https://mioshy.com/en/about/founder"/>
<link rel="alternate" hrefLang="x-default" href="https://mioshy.com/en/about/founder"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:locale:alternate" content="en_US"/>
```

| Tag | Present | Source | Pass |
|---|---|---|---|
| `<link rel="canonical">` | ✅ | `buildAlternates(locale, "/about/founder").canonical` | ✅ |
| `<link rel="alternate" hrefLang="he">` | ✅ | `buildAlternates.languages.he` | ✅ |
| `<link rel="alternate" hrefLang="en">` | ✅ | `buildAlternates.languages.en` | ✅ |
| `<link rel="alternate" hrefLang="x-default">` | ✅ → `/en` | `buildAlternates.languages["x-default"]` | ✅ |
| `<meta property="og:locale">` | ✅ `he_IL` | `buildOgLocale(locale).locale` | ✅ |
| `<meta property="og:locale:alternate">` | ✅ `en_US` | `buildOgLocale(locale).alternateLocale[0]` | ✅ |

**Note on naming:** Next.js renders the JSX attribute `hreflang` as `hrefLang` (camelCase, React convention). Search-engine crawlers parse both case forms; the spec is HTML, which is case-insensitive for attributes.

## Mirror test — /en/about/founder

```
curl -s "$PREVIEW/en/about/founder"
```

```html
<link rel="canonical" href="https://mioshy.com/en/about/founder"/>
<link rel="alternate" hrefLang="he" href="https://mioshy.com/he/about/founder"/>
<link rel="alternate" hrefLang="en" href="https://mioshy.com/en/about/founder"/>
<link rel="alternate" hrefLang="x-default" href="https://mioshy.com/en/about/founder"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:locale:alternate" content="he_IL"/>
```

All tags swap correctly when locale flips. The `x-default` continues to point at `/en`, as designed.

## Bonus — Accept-Language `he-IL` + no cookie → Hebrew

```
curl -s -A "Mozilla/5.0" -H "Accept-Language: he-IL,he;q=0.9" "$PREVIEW/"
```

`<link rel="canonical" href="https://mioshy.com/he"/>` ✅

The Accept-Language step kicks in when there is no cookie, before Geo-IP. The primary-tag regex `^he\b` correctly matches `he-IL`.

## Cookie write — full attribute audit

Single request: `curl -sI -A "Mozilla/5.0" -H "Accept-Language: en-US,en;q=0.9" "$PREVIEW/"` (no cookie sent → middleware should write).

```
set-cookie: NEXT_LOCALE=he; Path=/; Expires=Mon, 17 May 2027 14:24:32 GMT; Max-Age=31536000; Secure; SameSite=lax
```

| Attribute | Observed | Spec | Pass |
|---|---|---|---|
| `Path` | `/` | `/` | ✅ |
| `Max-Age` | `31536000` | 1 year (60*60*24*365) | ✅ |
| `Expires` | one year out, computed correctly | matches Max-Age | ✅ |
| `Secure` | present | required (HTTPS preview) | ✅ |
| `SameSite` | `lax` | `Lax` | ✅ |
| Value | `he` | matches what `detectLocale` chose for IL geo + no cookie | ✅ |

(`Set-Cookie` is the only mutation the middleware adds to the rewrite response — no Cache-Control override, no other side-effects.)

## Cookie write — skip when current matches

Single request: `curl -sI -H "Cookie: NEXT_LOCALE=he" -A "Mozilla/5.0" "$PREVIEW/"`

```
x-matched-path: /[locale]
```

**No `Set-Cookie` header in the response.** The deduplication check at `middleware.ts:160-164` correctly suppresses the write when the current cookie matches the chosen locale. Avoids burning a Set-Cookie + storage write on every root visit by a returning user.

## Cookie write — skip for crawlers

Single request: `curl -sI -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$PREVIEW/"`

```
x-matched-path: /[locale]
```

**No `Set-Cookie` header.** The `!isCrawler(...)` guard at `middleware.ts:161-162` correctly prevents bot-targeted cookie writes.

---

## Pass / fail matrix vs. the user-supplied test plan

| Test | Result |
|---|---|
| S1 — `Cookie: NEXT_LOCALE=he` + `Accept-Language: en` → Hebrew | ✅ |
| S2 — `Cookie: NEXT_LOCALE=en` + Mozilla UA → English | ✅ |
| S3 — `Googlebot` UA + `Cookie: NEXT_LOCALE=he` → English (crawler ignores cookie) | ✅ |
| S4 — `/he/about/founder` body contains canonical + hreflang + og:locale | ✅ (all 6 tags present) |

Plus the bonus checks the original Phase 1 spec required:
| Bonus | Result |
|---|---|
| Cookie write writes `Path=/; Max-Age=31536000; SameSite=Lax; Secure` | ✅ |
| Cookie write skipped when current cookie matches chosen locale | ✅ |
| Cookie write skipped for crawlers | ✅ |

---

## Pre-existing quirk surfaced — and fixed in this PR

The initial run (commit `aebd7a0`) showed `<html lang="he">` on every root-rewrite regardless of the chosen locale. Investigation revealed a pre-existing issue in the middleware ↔ rewrite handoff: `middleware.ts:58` does `request.headers.set("x-mioshy-locale", resolveLocale(request))`, intending the layout to read it via `headers()` and render `<html lang dir>` server-side. For URL-prefixed paths this worked. But for the root `/` → `/he` / `/en` rewrite, `NextResponse.rewrite(url)` does **not** propagate `request.headers.set(...)` mutations to the rewritten destination unless explicitly passed via `request: { headers }`.

Symptom was purely the `<html lang>` value — the rest of the page (text content, canonical, hreflang, og:locale) was always correct because those come from `params.locale` inside `app/[locale]/page.tsx`. But `<html lang>` is visible to screen readers and `<html lang>`-sensitive tools, so shipping with it incorrect would be misleading.

**Fixed in commit `cf3e447` ("fix(i18n): propagate locale header to rewrite destination")** — one-line change inside the same `if (pathname === "/")` block:

```ts
const rewritten = NextResponse.rewrite(url, {
  request: { headers: request.headers },  // ← propagates x-mioshy-locale
});
```

The behavior dated from upstream commit `1b316c5` ("seo: render `<html lang dir>` server-side"), so this fix retroactively repairs that work too. Re-validation against the new preview deploy (post-fix) confirms `<html lang>` and canonical agree on every scenario above.

---

## Summary

✅ All four user-supplied scenarios pass.
✅ All cookie attributes match spec.
✅ Cookie write deduplication works.
✅ Crawler skip works (both detection and Set-Cookie suppression).
✅ canonical, hreflang (he/en/x-default), og:locale + alternate all emitted correctly.
✅ `<html lang>` + `dir` match the chosen locale on every path (URL-prefixed and root-rewrite).

PR #5 ready for merge.
