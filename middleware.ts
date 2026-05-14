import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { copyAuthCookiesToResponse, updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session-enforcement";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Detect the preferred locale for an incoming request.
 *
 * Priority:
 *  1. Vercel geolocation header (x-vercel-ip-country) - set automatically
 *     on Vercel deployments; Israeli IP → Hebrew.
 *  2. Browser Accept-Language header - if Hebrew is listed, use Hebrew;
 *     if English is listed (and Hebrew isn't), use English.
 *  3. Default: Hebrew (Israel-first product).
 */
function detectLocale(request: NextRequest): "he" | "en" {
  // ── 1. IP geolocation ────────────────────────────────────────────────────
  const country = request.headers.get("x-vercel-ip-country");
  if (country === "IL") return "he";
  // Non-IL country but still check language preference before deciding

  // ── 2. Browser language ──────────────────────────────────────────────────
  const acceptLang = request.headers.get("accept-language") ?? "";
  if (/\bhe\b/i.test(acceptLang)) return "he";
  if (country && /\ben\b/i.test(acceptLang)) return "en";

  // ── 3. Default ───────────────────────────────────────────────────────────
  return "he";
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
  if (request.nextUrl.pathname === "/") {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    const rewritten = NextResponse.rewrite(url);
    copyAuthCookiesToResponse(supabaseResponse, rewritten);
    return rewritten;
  }

  const intlResponse = intlMiddleware(request);
  copyAuthCookiesToResponse(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
