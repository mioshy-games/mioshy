"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCmsTextContext } from "@/components/cms/CmsTextProvider";
import type { CmsTextResult } from "@/lib/cms/types";

/**
 * useCmsText — single point of truth for reading editable copy.
 *
 * Resolution order, in order of precedence:
 *
 *   1. CMS row from the page-level provider, for the active locale,
 *      iff the value is set AND non-empty. Per-language typography
 *      overrides on the same row turn into an inline-style return.
 *
 *   2. next-intl JSON fallback via `useTranslations()`. This means
 *      pages that haven't been wrapped in <CmsTextProvider> yet —
 *      or keys that haven't been seeded into cms_texts — continue
 *      to render the legacy translation as if nothing changed.
 *
 * Never throws. If the key doesn't exist in either source, returns
 * the key itself (next-intl's default missing-message behaviour).
 *
 * The returned `style` is `undefined` when no typography is set on
 * the active locale — so consumers can render `<span style={style}>`
 * without polluting the DOM with an empty style attribute.
 */
export function useCmsText(key: string): CmsTextResult {
  const ctx = useCmsTextContext();
  const locale = useLocale();
  // Empty namespace so the key is treated as fully-qualified, e.g.
  // `useCmsText("homeV2.hero.tag")` resolves the root-relative path.
  const t = useTranslations();

  const row = ctx?.get(key);

  const cmsValue = locale === "he" ? row?.he_text : row?.en_text;
  const trimmed = cmsValue?.trim();

  // The CMS value wins ONLY if it's a non-empty string. Empty or
  // NULL flows to JSON fallback — by design, so an admin who blanks
  // a row doesn't break the site.
  const text =
    trimmed && trimmed.length > 0
      ? cmsValue!
      : safeT(t, key);

  const fontSize = locale === "he" ? row?.he_font_size : row?.en_font_size;
  const fontWeight =
    locale === "he" ? row?.he_font_weight : row?.en_font_weight;
  const lineHeight =
    locale === "he" ? row?.he_line_height : row?.en_line_height;

  const style: CmsTextResult["style"] = {};
  if (fontSize) style.fontSize = fontSize;
  if (fontWeight) style.fontWeight = fontWeight;
  if (lineHeight) style.lineHeight = lineHeight;

  // JSON-fallback rows (no CMS row exists yet) default to plain.
  // Once we eventually re-seed missing keys this default becomes
  // moot — the migration set is_rich correctly on every existing
  // row, and the toggle in CmsTextRow promotes plain → rich on save.
  const isRich = row?.is_rich ?? false;

  return {
    text,
    isRich,
    style: Object.keys(style).length > 0 ? style : undefined,
  };
}

/**
 * Calls `t(key)` but catches the IntlError next-intl throws when the
 * key is missing. We log to console (so the admin notices the orphan)
 * and return the key string itself, matching next-intl's prod default.
 */
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return t(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[cms] missing translation for key "${key}"`, err);
    }
    return key;
  }
}
