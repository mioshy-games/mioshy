/**
 * Shared types for the CMS read path.
 * Mirrors the cms_texts table in supabase/migrations/082_cms_texts.sql.
 */

export type CmsTextRow = {
  id: string;
  key: string;
  page: string;
  section: string;
  he_text: string | null;
  en_text: string | null;
  he_font_size: string | null;
  he_font_weight: string | null;
  he_line_height: string | null;
  en_font_size: string | null;
  en_font_weight: string | null;
  en_line_height: string | null;
  needs_review: boolean;
  updated_at: string;
  updated_by: string | null;
};

/**
 * Buckets the admin UI groups texts into. Free-form strings on the
 * database side, but the public API accepts only the canonical set
 * so a typo in `page` never produces an orphan section.
 */
export const CMS_PAGES = [
  "homepage",
  "journey",
  "games",
  "mioshy-sex",
  "my",
  "shared",
] as const;

export type CmsPage = (typeof CMS_PAGES)[number];

export function isCmsPage(value: string): value is CmsPage {
  return (CMS_PAGES as readonly string[]).includes(value);
}

/**
 * The shape returned by `useCmsText(key)` — text plus an optional
 * inline-style override for the active locale's typography columns.
 * `style` is `undefined` when the row has no typography overrides
 * set, so consumers can spread it without producing an empty
 * `style={}` attribute on the DOM element.
 */
export type CmsTextResult = {
  text: string;
  style?: {
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
  };
};
