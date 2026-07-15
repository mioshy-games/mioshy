import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Best-effort UI locale for a notification recipient, read from
 * profiles.preferred_language (default "he"). Used to build localized deep-link
 * hrefs so English users don't land on /he/... routes. Never throws — a lookup
 * miss/error just falls back to Hebrew (Itzik 2026-07-15).
 */
export async function resolveUserLocale(
  userId: string | null | undefined,
): Promise<"he" | "en"> {
  if (!userId) return "he";
  try {
    const admin = createServiceRoleClient();
    if (!admin) return "he";
    const { data } = await admin
      .from("profiles")
      .select("preferred_language")
      .eq("id", userId)
      .maybeSingle();
    const lang = (data as { preferred_language?: string | null } | null)
      ?.preferred_language;
    return lang === "en" ? "en" : "he";
  } catch {
    return "he";
  }
}
