import "server-only";

import { cache } from "react";

import { getTranslations } from "next-intl/server";
import { loadCmsTextsForPage } from "./server";
import type { CmsPage } from "./types";

/**
 * Server-side drop-in replacement for next-intl's `getTranslations`.
 *
 * Resolution order matches `useCmsText` on the client:
 *   1. cms_texts row for the namespaced key (live admin edits)
 *   2. messages/<locale>.json via next-intl (the seed source of truth)
 *
 * Designed so a migration is literally:
 *     - const t = await getTranslations({ locale, namespace: "ns" });
 *     + const t = await getCmsTranslations({ locale, namespace: "ns", page: "pp" });
 * No other code in the calling component needs to change. `t("key")`
 * still returns a string. Dynamic keys (`t(\`trust.\${i}\`)`) work
 * unchanged because the returned function is a real lookup, not a
 * compile-time substitution.
 *
 * Caveats:
 *   • Doesn't support t.rich / t.raw. None of the Path-A migration
 *     targets (journey/page.tsx, games/page.tsx) use those — we'll
 *     add the methods if a future migration needs them.
 *   • Empty string or whitespace-only CMS values fall through to
 *     JSON (same rule as useCmsText). Lets an admin "blank" a row
 *     without breaking the site.
 *   • Failures inside loadCmsTextsForPage (network, RLS, missing
 *     table) silently fall back to JSON — the public site never
 *     breaks because of a CMS issue.
 */
// 2026-05-31 — share the Map construction across namespace lookups.
//
// The (shell) layout calls `getCmsTranslations` 3-4 times with the SAME
// `page` value but different `namespace`s. Pre-change, each call:
//   1. Re-awaited `loadCmsTextsForPage(page)` — already React.cache'd, free.
//   2. Re-built a fresh Map<string, …> from the row array — same data, 5×.
//
// Wrapping `getCmsTranslations` itself in React.cache wouldn't help —
// React.cache keys on argument identity, and every callsite passes a new
// object literal. So we cache the heavy step (the Map) by primitive
// `page` key, and let the outer function rebuild only the namespace-
// scoped closure each call (which is cheap).
type RowEntry = { he: string | null; en: string | null };

const getPageMap = cache(async (page: CmsPage): Promise<Map<string, RowEntry>> => {
  const rows = await loadCmsTextsForPage(page);
  const map = new Map<string, RowEntry>();
  for (const row of rows) {
    map.set(row.key, { he: row.he_text, en: row.en_text });
  }
  return map;
});

export async function getCmsTranslations(opts: {
  locale: "he" | "en";
  namespace: string;
  page: CmsPage;
}): Promise<(key: string) => string> {
  // getTranslations is internally memoized by next-intl per locale +
  // namespace; getPageMap is React.cache'd per page. Both calls are
  // effectively free after the first request-scoped invocation.
  const [t, map] = await Promise.all([
    getTranslations({ locale: opts.locale, namespace: opts.namespace }),
    getPageMap(opts.page),
  ]);

  return (key: string) => {
    const fullKey = `${opts.namespace}.${key}`;
    const row = map.get(fullKey);
    const cmsValue = opts.locale === "he" ? row?.he : row?.en;
    if (cmsValue && cmsValue.trim().length > 0) return cmsValue;
    // Belt to i18n/request.ts's braces. That config makes next-intl fall back
    // instead of throwing; this catch means even a future misconfiguration of
    // it cannot turn one absent string into a dead page. A missing string is
    // always a logged warning and a rendered fallback, never an exception.
    try {
      return t(key);
    } catch (err) {
      console.warn("[cms] translation lookup failed — falling back", {
        namespace: opts.namespace,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return key.split(".").pop() ?? key;
    }
  };
}
