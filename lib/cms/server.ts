import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CmsTextRow, CmsPage } from "./types";
import { normalizeRowsForRender } from "./render";

/**
 * CMS — server-only loader.
 *
 * Returns every CMS row tagged with the given `page`, e.g.
 * `homepage` for the marketing index.
 *
 * IMPLEMENTATION NOTE — Phase 2 (2026-05-12): we DELIBERATELY do not
 * wrap this loader in `unstable_cache(... , { revalidate: 60 })` even
 * though that was the original Phase-1 plan. In live testing the cache
 * served stale rows for 5+ minutes after a DB write — `revalidate: 60`
 * in Vercel's Data Cache appears to require an explicit
 * `revalidateTag(...)` call to actually clear, not just a TTL.
 *
 * Phase 4 (admin UI) will introduce a publish server action that
 * writes new rows AND immediately calls `revalidateTag('cms-texts')`
 * inside the same action — at that point we can safely re-enable
 * unstable_cache here. Until then, every page render does one
 * Supabase query keyed on `page` (indexed via `cms_texts_page_idx`,
 * sub-100ms in practice) and the read path is always fresh.
 *
 * If Supabase fails (network blip, table missing, RLS denial), this
 * returns `[]` and the public site silently falls back to next-intl
 * via the JSON files — the site never breaks because of CMS issues.
 */
export async function loadCmsTextsForPage(
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

/**
 * Same loader but for the entire CMS at once. Used by the admin
 * dashboard which paints every page in a single screen.
 *
 * Same caching caveat as `loadCmsTextsForPage` above.
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
