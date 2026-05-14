"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CmsTextRow } from "@/lib/cms/types";

/**
 * Provider that exposes the CMS rows for the current page to every
 * descendant client component via `useCmsText(key)`.
 *
 * The pattern: a server component (typically `app/[locale]/page.tsx`
 * or each page's layout) calls `loadCmsTextsForPage("homepage")` and
 * passes the rows into this provider. Every component below it can
 * then read by key without triggering its own database query.
 *
 * When this provider is missing, `useCmsText` returns `null` for the
 * row and the hook falls back to the next-intl JSON value — i.e. the
 * site renders normally on pages we haven't migrated yet.
 */

const CmsTextContext = createContext<Map<string, CmsTextRow> | null>(null);

export function CmsTextProvider({
  rows,
  children,
}: {
  rows: CmsTextRow[];
  children: ReactNode;
}) {
  // Map for O(1) lookups by key. Memoised on the rows reference so
  // the map is rebuilt only when a publish event invalidates the
  // page-level loader.
  const map = useMemo(() => {
    const m = new Map<string, CmsTextRow>();
    for (const row of rows) m.set(row.key, row);
    return m;
  }, [rows]);

  return (
    <CmsTextContext.Provider value={map}>{children}</CmsTextContext.Provider>
  );
}

/**
 * Internal — not exported from the module index. Components should
 * use `useCmsText(key)` from `hooks/useCmsText` instead.
 */
export function useCmsTextContext(): Map<string, CmsTextRow> | null {
  return useContext(CmsTextContext);
}
