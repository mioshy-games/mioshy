import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { copyAuthCookiesToResponse, updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { supabase, response: supabaseResponse, user } =
    await updateSession(request);

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

  const intlResponse = intlMiddleware(request);
  copyAuthCookiesToResponse(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
