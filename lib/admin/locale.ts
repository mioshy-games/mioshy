/**
 * lib/admin/locale.ts
 *
 * Phase 11A — admin locale (Hebrew/English) cookie + helpers.
 *
 * Distinct from the user-facing site's locale (next-intl handles that).
 * The admin runs at /dashboard/* without a locale segment, so we keep
 * the preference in a separate cookie and read it server-side.
 *
 * Cookie: 'mioshy_admin_locale' = 'he' | 'en'. Defaults to 'en' when
 * unset so existing admins (English-first) see no change unless they
 * explicitly toggle.
 */

import { cookies } from "next/headers";

export type AdminLocale = "he" | "en";

const COOKIE_NAME = "mioshy_admin_locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Server-side reader. Returns 'en' when no cookie is set or the value
 * is malformed.
 */
export function getAdminLocale(): AdminLocale {
  const c = cookies().get(COOKIE_NAME)?.value;
  return c === "he" ? "he" : "en";
}

export function isRtl(locale: AdminLocale): boolean {
  return locale === "he";
}

/**
 * Server action — toggle the admin locale. Bound to the language
 * toggle button in the sidebar.
 */
export async function setAdminLocaleAction(formData: FormData): Promise<void> {
  "use server";
  const next = formData.get("locale");
  const value: AdminLocale = next === "he" ? "he" : "en";
  cookies().set({
    name:     COOKIE_NAME,
    value,
    path:     "/",
    maxAge:   COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
