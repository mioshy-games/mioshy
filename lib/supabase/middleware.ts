import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session from cookies and returns a `NextResponse`
 * that may include updated `Set-Cookie` headers. Call `getUser()` once so
 * tokens refresh on every matched middleware request.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}

/** Append refreshed auth cookies onto another middleware response (e.g. next-intl). */
export function copyAuthCookiesToResponse(
  from: NextResponse,
  to: NextResponse,
) {
  const headersWithGetSetCookie = from.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const list =
    typeof headersWithGetSetCookie.getSetCookie === "function"
      ? headersWithGetSetCookie.getSetCookie()
      : null;
  if (list?.length) {
    for (const line of list) {
      to.headers.append("Set-Cookie", line);
    }
    return;
  }
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("Set-Cookie", single);
  }
}
