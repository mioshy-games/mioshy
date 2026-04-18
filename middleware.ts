import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { copyAuthCookiesToResponse, updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session-enforcement";

const intlMiddleware = createIntlMiddleware(routing);

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

  const intlResponse = intlMiddleware(request);
  copyAuthCookiesToResponse(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
