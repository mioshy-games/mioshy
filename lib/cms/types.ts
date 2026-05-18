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
  /**
   * Sprint 4 #1 — false means plain text only. Sanitiser rejects
   * any HTML tag on save; renderer outputs as a text node. True
   * enables the rich-text toolbar (em / strong / br / p / ul / li
   * / s) in the CMS UI; sanitiser accepts that 7-tag allow-list;
   * renderer outputs via dangerouslySetInnerHTML.
   */
  is_rich: boolean;
  /**
   * Sprint 5 — per-row text colour override. NULL = no override,
   * the component's existing CSS class wins. Two non-null shapes
   * (enforced by the DB CHECK constraint in migration 084):
   *   "preset:<name>" → resolved via lib/cms/colors.ts COLOR_PRESETS
   *   "#XXXXXX"       → 6-digit HEX, used verbatim
   * Use `resolveColorOverride()` from lib/cms/colors.ts to turn this
   * into a CSS-ready colour string.
   */
  color_override: string | null;
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
  "about",
  "shared",
] as const;

export type CmsPage = (typeof CMS_PAGES)[number];

export function isCmsPage(value: string): value is CmsPage {
  return (CMS_PAGES as readonly string[]).includes(value);
}

/**
 * The shape returned by `useCmsText(key)`:
 *
 *   text    — resolved string (CMS row → JSON fallback)
 *   isRich  — whether the row is_rich = true. JSON-fallback rows
 *             (i.e. no CMS row exists yet) default to false (plain).
 *             Consumers rendering to the DOM use this to decide
 *             between text-node vs dangerouslySetInnerHTML.
 *   style   — optional inline-style object built from the row's
 *             per-language typography columns. undefined when no
 *             overrides are set, so a `style={x}` prop doesn't emit
 *             an empty style attribute.
 */
export type CmsTextResult = {
  text: string;
  isRich: boolean;
  style?: {
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    /**
     * Sprint 5 — resolved colour from `cms_texts.color_override`.
     * Already mapped from preset name to HEX/rgba by the hook, so
     * consumers can apply this directly without re-resolving.
     */
    color?: string;
  };
};
