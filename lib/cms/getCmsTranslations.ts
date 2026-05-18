import "server-only";

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
export async function getCmsTranslations(opts: {
  locale: "he" | "en";
  namespace: string;
  page: CmsPage;
}): Promise<(key: string) => string> {
  // Load both sources in parallel — same cost as a single
  // getTranslations call because they're independent.
  const [t, rows] = await Promise.all([
    getTranslations({ locale: opts.locale, namespace: opts.namespace }),
    loadCmsTextsForPage(opts.page),
  ]);

  // Build a Map for O(1) lookups by fully-qualified key.
  const map = new Map<
    string,
    { he: string | null; en: string | null }
  >();
  for (const row of rows) {
    map.set(row.key, { he: row.he_text, en: row.en_text });
  }

  return (key: string) => {
    const fullKey = `${opts.namespace}.${key}`;
    const row = map.get(fullKey);
    const cmsValue = opts.locale === "he" ? row?.he : row?.en;
    if (cmsValue && cmsValue.trim().length > 0) return cmsValue;
    // next-intl returns the key itself for missing translations in
    // production; we preserve that contract by delegating to t().
    return t(key);
  };
}
