/**
 * POST /api/admin/locale
 *
 * Phase 11A — sets the admin locale cookie ('he' | 'en'). Called from
 * the AdminLocaleToggle button in the sidebar.
 *
 * Auth: any authenticated dashboard role (admin or expert) can change
 * their own preference. Cookie is per-browser, not per-user.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireExpert } from "@/lib/auth/expert";

export async function POST(req: Request) {
  await requireExpert(); // any expert/admin role
  let body: { locale?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const value = body.locale === "he" ? "he" : "en";
  cookies().set({
    name:     "mioshy_admin_locale",
    value,
    path:     "/",
    maxAge:   60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true, locale: value });
}
