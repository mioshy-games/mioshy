# i18n Baseline — production curl tests

**Captured:** 2026-05-17, 11:00 UTC
**Target:** `https://mioshy.com` (Vercel production)
**Branch under test:** `feature/i18n-cookie-and-alternates` (renamed from `claude/affectionate-bartik-fa0d23`)

> ⚠️ **STOP CONDITION TRIGGERED.** Phase 0 was meant to validate that production redirects `/` to `/he` or `/en`. **It does not — it uses a `rewrite` instead.** And the worktree's source code is behind `origin/game` (the deployed branch) by ~10 commits. See the "Findings & divergence" section at the bottom before proceeding with Phase 1.

---

## T1 — `GET /` with browser UA

```
$ curl -sI -A "Mozilla/5.0" https://mioshy.com/
HTTP/2 200
server: Vercel
content-type: text/html; charset=utf-8
x-matched-path: /[locale]
x-vercel-cache: MISS
x-vercel-id: fra1::iad1::s6dq7-1779015619084-c054792af468
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch
(no Location header)
(no Set-Cookie for locale)
(no hreflang Link headers)
```

**Reading:** root path returns **200 OK** with the localized page body inline. Next.js logs `x-matched-path: /[locale]` — i.e. a **rewrite** happened from `/` → `/<locale>`. No `Location` header, so no redirect; no `Set-Cookie: NEXT_LOCALE` because the URL the user sees is `/`, not `/he`.

## T2 — `GET /he`

```
$ curl -sI -A "Mozilla/5.0" https://mioshy.com/he
HTTP/2 200
server: Vercel
link: <https://mioshy.com/he>; rel="alternate"; hreflang="he",
      <https://mioshy.com/en>; rel="alternate"; hreflang="en",
      <https://mioshy.com/>;   rel="alternate"; hreflang="x-default"
set-cookie: NEXT_LOCALE=he; Path=/; SameSite=lax
x-matched-path: /[locale]
```

**Reading:**
- 200 OK with full HTML.
- HTTP `Link` header emits `hreflang` annotations. `x-default` points to `/` (NOT `/en` — that contradicts the page-level `alternates.languages` which has `"x-default": ${base}/en`).
- next-intl's middleware **already sets a `NEXT_LOCALE` cookie** automatically when serving a locale-prefixed path. ⚠️ This contradicts the audit's claim that "no locale cookie exists." The cookie exists (set by `intlMiddleware` from `createIntlMiddleware(routing)`), it's just not set on the root rewrite.

## T3 — `GET /en`

```
$ curl -sI -A "Mozilla/5.0" https://mioshy.com/en
HTTP/2 200
server: Vercel
link: <https://mioshy.com/he>; rel="alternate"; hreflang="he",
      <https://mioshy.com/en>; rel="alternate"; hreflang="en",
      <https://mioshy.com/>;   rel="alternate"; hreflang="x-default"
set-cookie: NEXT_LOCALE=en; Path=/; SameSite=lax
x-matched-path: /[locale]
```

**Reading:** mirror of T2 with `NEXT_LOCALE=en`. Same hreflang Link header (which is locale-agnostic — same on every page).

## T4 — `GET /` with Googlebot UA

```
$ curl -sI -A "Googlebot/2.1 (+http://www.google.com/bot.html)" https://mioshy.com/
HTTP/2 200
x-matched-path: /[locale]
(no Location, no Set-Cookie, no Link with hreflang)
```

**Reading:** identical to T1 — Googlebot is treated like any other client. The rewrite picks a locale (likely `he` since the request has no `x-vercel-ip-country` for a US-origin curl call to `vercel.com`'s edge) and serves it inline at `/`.

⚠️ Googlebot indexing `/` will see **content that lives at the `/[locale]` route, with no hreflang Link header at the URL `/` itself**. The page-level metadata's `alternates` block lives in the HTML `<head>`, not in HTTP headers, so it does still emit `<link rel="alternate" hreflang>` tags inside the body — but the URL-level Link header is missing for `/`.

## T5 — `GET /` with `Accept-Language: en`

```
$ curl -sI -H "Accept-Language: en-US,en;q=0.9" https://mioshy.com/
HTTP/2 200
x-matched-path: /[locale]
(no Location)
```

**Reading:** 200 OK. We can't tell from the HEAD response which locale was selected (no Content-Language header), only that a rewrite happened. The `detectLocale()` priority (geo → accept-language → default `he`) would, for an `en` Accept-Language with no IL geo, return `he` because the fallback at line 31 of the prod `middleware.ts` is `return "he"`. To verify, would need to fetch the body and check `<html lang>` — out of scope for HEAD-only baseline.

## T6 — `GET /` with `Accept-Language: he`

```
$ curl -sI -H "Accept-Language: he-IL,he;q=0.9" https://mioshy.com/
HTTP/2 200
x-matched-path: /[locale]
```

**Reading:** identical 200 OK. Hebrew Accept-Language returns the same rewrite as everything else. No way to distinguish T5 from T6 at the HTTP-headers level.

---

# Findings & divergence (CODE vs PRODUCTION)

The audit report ([docs/i18n-audit-report.md](i18n-audit-report.md)) was written against the **stale** worktree branch. Production diverges in important ways. **Phase 1 of the implementation plan, as written, would regress production.**

## Branch divergence

- Worktree was on `claude/affectionate-bartik-fa0d23`, now renamed to `feature/i18n-cookie-and-alternates`.
- Worktree's git status says `Your branch is up to date with 'origin/main'`. But Vercel deploys from **`origin/game`** (the repo's default branch — `origin/HEAD -> origin/game`).
- `git log HEAD..origin/game` shows the worktree is missing ≥10 commits, including three that materially affect this i18n work:

| SHA | Message | Impact |
|---|---|---|
| `1f86767` | **perf: rewrite root to localized path instead of redirecting** | Replaces the 302 redirect at `/` with `NextResponse.rewrite()`. Stated reason: "redirect combined with the www → apex redirect produced a two-hop chain on the very first request and tanked PSI's `redirects` audit." |
| `1b316c5` | **seo: render `<html lang dir>` server-side** | Middleware now stamps `x-mioshy-locale` header on the request; root layout reads it via `headers()` and renders `<html lang dir>` SSR. **`components/LocaleAttributes.tsx` was deleted on prod** but still exists on the worktree. |
| `f14ad3a` | **fix(cms): bypass i18n middleware for /admin/*** | Adds early-return for `/admin` so it doesn't 404 via locale prefix injection. |

## What the audit got wrong

| Audit claim | Reality (on `origin/game`) |
|---|---|
| "middleware does 302 redirect at `/`" | It does a **rewrite**, not a redirect. See `middleware.ts:127-133` on `origin/game`: `NextResponse.rewrite(url)`. The 302 form only exists on the worktree's stale code. |
| "no locale cookie exists" | next-intl's `intlMiddleware` **already sets `NEXT_LOCALE=<locale>; Path=/; SameSite=lax`** on every response that serves a locale path. Confirmed in T2/T3. The audit missed this because it only `grep`-ed source — it didn't observe runtime behavior. |
| "`<html lang>`/`<html dir>` only set client-side via `LocaleAttributes`" | Already SSR on prod (commit `1b316c5`). Prod reads `x-mioshy-locale` header in `app/layout.tsx:108-118`. |
| "`LocaleAttributes.tsx` is dead code via separate path" | The file no longer exists on `origin/game` (deleted in commit `1b316c5`). It exists on the worktree because the worktree is stale. |
| "`/dashboard` and `/admin` are not specially handled in middleware" | `/admin/*` has its own early-return (commit `f14ad3a`). |

## What this means for the implementation plan

1. **Phase 1 must be redesigned.** The user-supplied plan says: "החזר 302 ל-/en". Production runs a **rewrite** explicitly to avoid a two-hop redirect chain (documented PSI regression). Switching back to 302 would re-introduce that regression. We need to decide:
   - **(A)** Stay with rewrite. Cookie can still be set (rewrites can attach Set-Cookie headers via `NextResponse.rewrite()` → `.cookies.set()`). The cookie is read on the NEXT visit's middleware run. Crawlers see content at `/` directly, no extra hop.
   - **(B)** Revert to 302 redirect. Re-accept the PSI hit. Probably not what we want.
   - **(C)** Hybrid: rewrite when no cookie is present (first visit, crawler), 302 when cookie disagrees with default (subsequent user visit on a different language preference). More complex; unclear win.

   My recommendation: **(A)**, with the cookie set on the rewrite response. This keeps PSI happy and gives us the "remember choice" behavior.

2. **Phase 3 is largely already done.** Production has SSR `<html lang dir>`. We do not need to "move logic from `LocaleAttributes.tsx`" — that file no longer exists on prod. On the worktree it still exists because the worktree is behind. The right move is to rebase the worktree onto `origin/game` so the local code matches what's deployed, then proceed.

3. **Phase 4 / 5 (helper + 26 pages):** these are still valid. The list of pages missing `alternates` should be re-audited against `origin/game` to be sure, but the architectural gap is real.

4. **Phase 6 cleanup** is partially obsolete: `LocaleAttributes.tsx` cleanup is already done on prod; deleting it from the local worktree happens automatically once we rebase.

5. **The cookie name to use** needs revisiting. We have two options:
   - **Re-use `NEXT_LOCALE`** (already set by next-intl). Pro: no new cookie, fewer cookies overall. Con: behavior is partly out of our hands (next-intl writes it on locale-path hits; we'd write it on root rewrites and switcher clicks).
   - **Use our own `mio_locale`** (the audit/plan name). Pro: full control of when it's set. Con: two cookies, slight confusion.

   My recommendation: **use the existing `NEXT_LOCALE` cookie**. It's already wired into next-intl's read path (next-intl has a `localeDetection` option that reads it; right now we have `localePrefix: "always"` so it doesn't drive routing, but reading it in our `detectLocale` is one line). Don't introduce a second cookie if the first does the job.

## Required next step

**Rebase `feature/i18n-cookie-and-alternates` onto `origin/game`** before any code changes. Otherwise we'd:
- Re-introduce the deleted `LocaleAttributes.tsx`.
- Lose the rewrite optimization (commit `1f86767`).
- Possibly conflict with the `/admin/*` bypass (commit `f14ad3a`).

The rebase needs your approval per the working rules (destructive-ish on the local branch even though no remote is touched). **Awaiting your call before any further code change.**

---

## Open questions raised by these findings

1. The audit had stale info about cookies, SSR `<html>`, and the redirect mechanism. **Do you want me to also update [docs/i18n-audit-report.md](i18n-audit-report.md) to reflect production reality**, before we revise the plan?
2. Phase 1 design: option A (rewrite + cookie write), option B (revert to redirect), or option C (hybrid)?
3. Cookie name: `NEXT_LOCALE` (existing) or new `mio_locale`?
4. Rebase: approve a rebase of `feature/i18n-cookie-and-alternates` onto `origin/game`? Alternative is to fresh-branch off `origin/game` and re-do the analysis there.
5. The audit/plan said "default locale → `en`". On `origin/game`, `detectLocale` still returns `he` as the fallback. The fix is still in scope, but worth confirming after we see prod code clearly.
