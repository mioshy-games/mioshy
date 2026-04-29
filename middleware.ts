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
 *  1. Vercel geolocation header (x-vercel-ip-country) — set automatically
 *     on Vercel deployments; Israeli IP → Hebrew.
 *  2. Browser Accept-Language header — if Hebrew is listed, use Hebrew;
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

/** Routes where a valid single-session token is required */
function isSessionProtected(pathname: string) {
  return (
    /^\/(en|he)\/account(\/|$)/.test(pathname) ||
    /^\/(en|he)\/billing(\/|$)/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { supabase, response: supabaseResponse, user } =
    await updateSession(request);

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

  // ── Root path: redirect to /he or /en based on location / language ───────
  // With localePrefix:"always" next-intl would also handle this, but we want
  // geolocation to take priority over the default locale setting.
  if (request.nextUrl.pathname === "/") {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    const redirect = NextResponse.redirect(url, { status: 302 });
    copyAuthCookiesToResponse(supabaseResponse, redirect);
    return redirect;
  }

  const intlResponse = intlMiddleware(request);
  copyAuthCookiesToResponse(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
