import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CmsTextRow, CmsPage } from "./types";
import { normalizeRowsForRender } from "./render";

/**
 * CMS — server-only loader.
 *
 * Returns every CMS row tagged with the given `page`, e.g.
 * `homepage` for the marketing index. NO caching layer — every page
 * render does one Supabase query keyed on `page` (indexed via
 * `cms_texts_page_idx`, sub-100ms in practice).
 *
 * History (this is the SECOND time we've dropped the cache):
 *   Phase 2 — wrapped in unstable_cache(... revalidate: 60). Vercel's
 *     Data Cache served stale for 5+ minutes even past the TTL.
 *     Dropped to read-on-every-render and it worked.
 *   Sprint 2 — added Save server action that calls
 *     revalidateTag('cms-texts'), and re-introduced unstable_cache
 *     with the matching tag. Per the Next.js contract, save +
 *     revalidateTag should clear the cache. In practice Itzik
 *     observed Save updating the DB but /he still serving the OLD
 *     copy ~5+ minutes later. The tag invalidation isn't propagating
 *     to Vercel's Data Cache reliably for unstable_cache fns.
 *
 *   Verdict — `unstable_cache` + `revalidateTag` is unreliable for
 *   our use case. Dropping it again. The DB query is fast enough; if
 *   we ever need caching we'll use Supabase's PostgREST built-in
 *   cache or a Redis layer with explicit invalidation we control.
 *
 * If Supabase fails (network blip, table missing, RLS denial) this
 * returns `[]` — the public site silently falls back to next-intl
 * via the JSON files and never breaks because of CMS issues.
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
          "is_rich",
          "updated_at",
          "updated_by",
        ].join(","),
      )
      .eq("page", page);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[cms] loadCmsTextsForPage failed:", error.message);
      return [];
    }

    const rows = normalizeRowsForRender((data ?? []) as unknown as CmsTextRow[]);

    // Diagnostic — verify which value the loader actually got from
    // the DB on each render. Picks the hero.tag key for a stable
    // probe across HE/EN. Visible in Vercel runtime logs. Retire
    // after the cache story stabilises.
    const probe = rows.find((r) => r.key === "homeV2.hero.tag");
    // eslint-disable-next-line no-console
    console.log("[cms-load] page=" + page, {
      rowCount: rows.length,
      heroTagHe: probe?.he_text?.slice(0, 50),
      heroTagUpdatedAt: probe?.updated_at,
    });

    return rows;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[cms] loadCmsTextsForPage threw:", err);
    return [];
  }
}

/**
 * Same loader but for the entire CMS at once. Used by the admin
 * dashboard which paints every page in a single screen. Bypasses the
 * cache — admins want to see their just-saved edits immediately, and
 * the cost of refetching all rows once per admin pageview is
 * negligible.
 *
 * BUG FIX 2026-05-13 — Supabase JS client defaults every PostgREST
 * request to a max of 1000 rows. We crossed that threshold after
 * Sprint 4 #3 Phase 2 (1184 rows as of writing), so the admin UI was
 * silently dropping ~184 keys from the back of the alphabet — entire
 * sections invisible, "0 keys" tabs that actually had dozens. Adding
 * an explicit `.range(0, 9999)` raises the ceiling well past anything
 * we'll hit before Sprint 6. If we ever exceed 10k rows the admin
 * needs pagination anyway (the UI mounts one editor per row).
 */
export async function loadAllCmsTexts(): Promise<CmsTextRow[]> {
  try {
    const sb = await createServerSupabaseClient();
    const { data, error } = await sb
      .from("cms_texts")
      .select("*")
      .range(0, 9999);
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
