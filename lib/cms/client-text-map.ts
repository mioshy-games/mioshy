import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Client-side reader for CRM-managed strings (cms_texts is public-readable).
 * Returns a map of key → localized text, containing ONLY non-blank values — so
 * callers resolve each string as `map[key] ?? codeDefault`, and a missing OR
 * blank CMS row always falls back to the in-code default (never an empty UI).
 *
 * Used by components that live outside a per-page CmsTextProvider (e.g. the
 * lead-capture modal, which renders inside game pages of other CMS "pages").
 */
export async function fetchCmsTextMap(
  keys: string[],
  locale: "he" | "en",
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (keys.length === 0) return out;
  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("cms_texts")
      .select("key, he_text, en_text")
      .in("key", keys);
    for (const r of (data ?? []) as {
      key: string;
      he_text: string | null;
      en_text: string | null;
    }[]) {
      const v = (locale === "he" ? r.he_text : r.en_text)?.trim();
      if (v && v.length > 0) out[r.key] = v;
    }
  } catch {
    /* ignore — empty map → callers use their code defaults */
  }
  return out;
}
