import "server-only";

import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CmsTextRow, CmsPage } from "./types";

/**
 * CMS — server-only loader.
 *
 * Returns every CMS row tagged with the given `page`, e.g.
 * `homepage` for the marketing index. Wrapped in `unstable_cache`
 * so the database is hit at most once per `revalidate` window per
 * page key, regardless of how many components read from it.
 *
 * Cache tag `cms-texts` lets the admin app invalidate every page
 * at once with `revalidateTag('cms-texts')` after a publish action.
 *
 * If Supabase fails (network blip, table missing, RLS denial), this
 * returns `[]` and the public site silently falls back to next-intl
 * via the JSON files — the site never breaks because of CMS issues.
 */
export const loadCmsTextsForPage = unstable_cache(
  async (page: CmsPage): Promise<CmsTextRow[]> => {
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
        // Don't throw — let next-intl JSON fallback take over.
        // The admin app surfaces these errors separately.
        console.warn("[cms] loadCmsTextsForPage failed:", error.message);
        return [];
      }
      return (data ?? []) as unknown as CmsTextRow[];
    } catch (err) {
      console.warn("[cms] loadCmsTextsForPage threw:", err);
      return [];
    }
  },
  ["cms-texts-by-page"],
  {
    revalidate: 60,
    tags: ["cms-texts"],
  },
);

/**
 * Same loader but for the entire CMS at once. Used by the admin
 * dashboard which paints every page in a single screen.
 */
export const loadAllCmsTexts = unstable_cache(
  async (): Promise<CmsTextRow[]> => {
    try {
      const sb = await createServerSupabaseClient();
      const { data, error } = await sb.from("cms_texts").select("*");
      if (error) {
        console.warn("[cms] loadAllCmsTexts failed:", error.message);
        return [];
      }
      return (data ?? []) as CmsTextRow[];
    } catch (err) {
      console.warn("[cms] loadAllCmsTexts threw:", err);
      return [];
    }
  },
  ["cms-texts-all"],
  {
    revalidate: 60,
    tags: ["cms-texts"],
  },
);
