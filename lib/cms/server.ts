import "server-only";

import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CmsTextRow, CmsPage } from "./types";
import { normalizeRowsForRender } from "./render";

/**
 * CMS — server-only loader.
 *
 * Returns every CMS row tagged with the given `page`, e.g.
 * `homepage` for the marketing index. Wrapped in `unstable_cache` so
 * the database is hit at most once per `revalidate` window per page
 * key — except the public site reads from the cache, and every save
 * server action in lib/cms/actions.ts calls `revalidateTag('cms-texts')`
 * to clear it explicitly.
 *
 * History — Phase 2 we tried `unstable_cache` first and the cache
 * served stale forever because we had no publish path to call
 * `revalidateTag`. With Sprint 2 we DO have the action, so the
 * revalidation contract works as documented. The 60s TTL is a
 * background safety net; the primary refresh mechanism is the tag
 * invalidation from saves.
 *
 * If Supabase fails (network blip, table missing, RLS denial) the
 * inner fn returns `[]` — the cache stores the empty array, the
 * public site silently falls back to next-intl via the JSON files
 * and never breaks because of CMS issues.
 */
async function loadCmsTextsForPageUncached(
  page: CmsPage,
): Promise<CmsTextRow[]> {
  try {
    const sb = await createServerSupabaseClient();
    const { data, error } = await sb
      .from("cms_texts")
      .select(
        [
          "id",
          "key",
          "page",
          "section",
          "he_text",
          "en_text",
          "he_font_size",
          "he_font_weight",
          "he_line_height",
          "en_font_size",
          "en_font_weight",
          "en_line_height",
          "needs_review",
          "updated_at",
          "updated_by",
        ].join(","),
      )
      .eq("page", page);

    if (error) {
      console.warn("[cms] loadCmsTextsForPage failed:", error.message);
      return [];
    }
    return normalizeRowsForRender((data ?? []) as unknown as CmsTextRow[]);
  } catch (err) {
    console.warn("[cms] loadCmsTextsForPage threw:", err);
    return [];
  }
}

export const loadCmsTextsForPage = unstable_cache(
  loadCmsTextsForPageUncached,
  ["cms-texts-by-page"],
  {
    revalidate: 60,
    tags: ["cms-texts"],
  },
);

/**
 * Same loader but for the entire CMS at once. Used by the admin
 * dashboard which paints every page in a single screen. Bypasses the
 * cache — admins want to see their just-saved edits immediately, and
 * the cost of refetching ~800 rows once per admin pageview is
 * negligible.
 */
export async function loadAllCmsTexts(): Promise<CmsTextRow[]> {
  try {
    const sb = await createServerSupabaseClient();
    const { data, error } = await sb.from("cms_texts").select("*");
    if (error) {
      console.warn("[cms] loadAllCmsTexts failed:", error.message);
      return [];
    }
    return normalizeRowsForRender((data ?? []) as CmsTextRow[]);
  } catch (err) {
    console.warn("[cms] loadAllCmsTexts threw:", err);
    return [];
  }
}
