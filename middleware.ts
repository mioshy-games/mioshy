import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { copyAuthCookiesToResponse, updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session-enforcement";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Search bots and SEO crawlers that should always be served the
 * x-default locale (English) without consulting cookie or geo signals.
 * Narrow list kept as one case-insensitive regex so the middleware
 * hot path stays cheap.
 */
const CRAWLER_REGEX =
  /googlebot|bingbot|duckduckbot|yandexbot|baiduspider|slurp|applebot|twitterbot|facebookexternalhit|ahrefsbot|semrushbot/i;

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_REGEX.test(userAgent);
}

/**
 * Detect the preferred locale for an incoming request.
 *
 * Priority:
 *  1. Crawler UA → always "en" (= x-default). No cookie / geo read,
 *     so the bot sees deterministic content that matches what its
 *     hreflang x-default link advertises.
 *  2. NEXT_LOCALE cookie ("he" or "en") — the user's explicit choice
 *     wins over geo/lang for every subsequent root visit.
 *  3. Accept-Language — primary tag only; "he" or "he-*" → Hebrew.
 *     "en,he;q=0.5" stays English; "he-IL,en" goes Hebrew.
 *  4. Vercel geolocation header (x-vercel-ip-country) — IL → Hebrew.
 *  5. Default: "en" (matches the x-default canonical we advertise).
 */
function detectLocale(request: NextRequest): "he" | "en" {
  // ── 1. Crawlers ──────────────────────────────────────────────────────────
  if (isCrawler(request.headers.get("user-agent"))) return "en";

  // ── 2. Cookie (explicit user choice) ─────────────────────────────────────
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale === "he" || cookieLocale === "en") return cookieLocale;

  // ── 3. Browser language (primary tag only) ───────────────────────────────
  const acceptLang = request.headers.get("accept-language") ?? "";
  const primary = acceptLang.split(",")[0] ?? "";
  if (/^he\b/i.test(primary)) return "he";

  // ── 4. IP geolocation ────────────────────────────────────────────────────
  if (request.headers.get("x-vercel-ip-country") === "IL") return "he";

  // ── 5. Default ───────────────────────────────────────────────────────────
  return "en";
}

/**
 * Resolve the locale for an incoming request. URL prefix wins over geo/lang
 * detection so once we're inside `/en/...` or `/he/...` the choice is stable.
 * The result is exposed to server components as the `x-mioshy-locale` request
 * header so the root layout can render `<html lang dir>` server-side
 * (without it the HTML is shipped lang-less and Lighthouse / SEO rules fail).
 */
function resolveLocale(request: NextRequest): "he" | "en" {
  const m = /^\/(en|he)(?:\/|$)/.exec(request.nextUrl.pathname);
  if (m) return m[1] as "he" | "en";
  return detectLocale(request);
}

/** Routes where a valid single-session token is required */
function isSessionProtected(pathname: string) {
  return (
    /^\/(en|he)\/account(\/|$)/.test(pathname) ||
    /^\/(en|he)\/billing(\/|$)/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  // Stamp the resolved locale on the request so the root layout can read it
  // via `headers()` and emit `<html lang dir>` server-side.
  request.headers.set("x-mioshy-locale", resolveLocale(request));

  const { supabase, response: supabaseResponse, user } =
    await updateSession(request);

  // ── /admin/*: bypass i18n routing entirely ──────────────────────────────
  // The internal CMS lives at /admin/content (not /[locale]/admin/...).
  // Without this early return, intlMiddleware below adds a locale prefix
  // and redirects /admin/content → /he/admin/content, which doesn't exist
  // as a route and 404s. Auth gating happens at the page level via
  // getAdminSession() (returns 404 on miss, not redirect — keeps the
  // route invisible to non-admins).
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return supabaseResponse;
  }

  // ── Post-login landing: /{locale}/my → /{locale}/my/lessons ────────────
  // 2026-05-29 — go-live of the AppShell.
  // 2026-05-31 — /my/today was merged into /my/lessons (single landing).
  // Old /my/today still resolves via the route's own 307 redirect, so
  // bookmarks pointing at it stay alive.
  //
  // Matches EXACT /{locale}/my and /{locale}/my/ only — anything deeper
  // falls through untouched.
  const myExact = /^\/(en|he)\/my\/?$/.exec(request.nextUrl.pathname);
  if (myExact) {
    const locale = myExact[1];
    const target = new URL(`/${locale}/my/lessons`, request.url);
    target.search = request.nextUrl.search;
    const redirect = NextResponse.redirect(target);
    copyAuthCookiesToResponse(supabaseResponse, redirect);
    return redirect;
  }

  // ── Dashboard: admin-only ────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user) {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      copyAuthCookiesToResponse(supabaseResponse, redirect);
      return redirect;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      copyAuthCookiesToResponse(supabaseResponse, redirect);
      return redirect;
    }

    return supabaseResponse;
  }

  // ── Single-session enforcement for account / billing pages ───────────────
  if (user && isSessionProtected(request.nextUrl.pathname)) {
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionToken) {
      // No session cookie → possibly pre-enforcement session; let through
      // (they'll lose access after next login on another device)
    } else {
      const check = await validateSession(sessionToken);
      if (!check.valid) {
        // Session was invalidated by a login on another device
        const locale = request.nextUrl.pathname.startsWith("/he") ? "he" : "en";
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/auth?kicked=1`, request.url),
        );
        copyAuthCookiesToResponse(supabaseResponse, redirect);
        return redirect;
      }
    }
  }

  // ── Root path: REWRITE to /he or /en (no extra hop) ──────────────────────
  // Previously this was a 302 redirect, which combined with the
  // www → apex redirect produced a two-hop chain on the very first
  // request and tanked PSI's `redirects` audit. A rewrite renders the
  // localized page directly under "/" — same SEO surface (the per-page
  // metadata canonicals already point at /he or /en explicitly), zero
  // extra round-trip.
  //
  // On the rewrite we also pin the chosen locale to NEXT_LOCALE so the
  // next visit to "/" returns to the same language without re-running
  // geo/lang detection. Skipped for crawlers (their Set-Cookie would be
  // wasted) and when the cookie already matches the chosen locale.
  if (request.nextUrl.pathname === "/") {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    // Pass `request.headers` explicitly so the `x-mioshy-locale` header
    // stamped at line 58 propagates to the rewritten destination's
    // `headers()` call in app/layout.tsx, which is what renders
    // `<html lang dir>` server-side. Without this, NextResponse.rewrite
    // forwards only the original (unmodified) request headers, and the
    // root path ("/") always renders `<html lang="he">` regardless of
    // which locale detectLocale chose.
    const rewritten = NextResponse.rewrite(url, {
      request: { headers: request.headers },
    });
    copyAuthCookiesToResponse(supabaseResponse, rewritten);

    const currentCookie = request.cookies.get("NEXT_LOCALE")?.value;
    if (
      !isCrawler(request.headers.get("user-agent")) &&
      currentCookie !== locale
    ) {
      rewritten.cookies.set("NEXT_LOCALE", locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: true,
      });
    }
    return rewritten;
  }

  const intlResponse = intlMiddleware(request);
  copyAuthCookiesToResponse(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|ingest|_next|_vercel|.*\\..*).*)"],
};
