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
 * BUG TIMELINE
 * ────────────
 * 2026-05-13 (9bda9ba) — Supabase JS client defaults every PostgREST
 *   request to a max of 1000 rows. We crossed that threshold after
 *   Sprint 4 #3 Phase 2 (1184 rows then), so the admin UI was silently
 *   dropping ~184 keys. Added `.range(0, 9999)` which fixed it at the
 *   time because PostgREST `db-max-rows` was unset on the project.
 *
 * 2026-05-14 — Itzik reports the admin showing 1000/1424 rows: tabs
 *   spectacularly under-count (Mioshy Sex 1/103, Games 20/141, My 36/156).
 *   `.range(0, 9999)` is still in place but the request comes back capped
 *   at exactly 1000. That's the telltale of a server-side
 *   `db-max-rows = 1000` PostgREST setting binding our client-side range
 *   — PostgREST silently truncates a Range request that exceeds the
 *   server cap. We can't unset that from the app side.
 *
 *   Mitigation: paginate explicitly with multiple .range() calls of
 *   PAGE_SIZE each, looping until a page comes back short. Each
 *   individual request stays at or below the server cap, and we stitch
 *   the pages back together client-side. We order by `id` so successive
 *   windows don't overlap or skip rows (PostgREST default order is
 *   unspecified — historically ctid / insertion order, but the API
 *   doesn't guarantee that).
 *
 *   Safety: SAFETY_CAP = 50_000 stops a runaway misconfiguration. The
 *   UI mounts one editor per row, so well before 50k we'd need real
 *   UI-side pagination anyway.
 */
export async function loadAllCmsTexts(): Promise<CmsTextRow[]> {
  try {
    const sb = await createServerSupabaseClient();
    const PAGE_SIZE = 1000;
    const SAFETY_CAP = 50_000;
    const all: CmsTextRow[] = [];
    let offset = 0;

    while (offset < SAFETY_CAP) {
      const { data, error } = await sb
        .from("cms_texts")
        .select("*")
        // Deterministic ordering by id so consecutive .range() windows
        // don't overlap or skip rows. Without this, two pages could in
        // principle return the same row twice or skip one across the
        // window boundary.
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.warn(
          "[cms] loadAllCmsTexts page failed:",
          error.message,
          "offset=" + offset,
        );
        // Return what we've gathered so far rather than zero — partial
        // data beats a blank-screen for an admin trying to edit.
        return normalizeRowsForRender(all);
      }

      const pageRows = (data ?? []) as CmsTextRow[];
      all.push(...pageRows);

      // Canonical "no more data" signal in offset-pagination — when a
      // page comes back shorter than PAGE_SIZE the table is exhausted.
      // We can't rely on `count` because the Supabase client doesn't
      // compute it unless explicitly asked, and asking incurs a
      // meaningful per-request cost on large tables.
      if (pageRows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // eslint-disable-next-line no-console
    console.log("[cms] loadAllCmsTexts loaded", all.length, "rows");

    return normalizeRowsForRender(all);
  } catch (err) {
    console.warn("[cms] loadAllCmsTexts threw:", err);
    return [];
  }
}
