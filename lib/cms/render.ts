/**
 * CMS — shared rich-text normalizer.
 *
 * The translation files (and therefore the seeded cms_texts rows) carry
 * a few markup idioms that originated from next-intl's `t.rich(...)`
 * placeholder syntax — most notably `<br></br>` for a forced line
 * break. ICU/Intl needs every placeholder to have a closing tag, even
 * for void HTML elements; t.rich understood that as a single <br>.
 *
 * When the same string is rendered via `dangerouslySetInnerHTML`, the
 * HTML parser doesn't know about ICU. It sees `</br>` as an UNCLOSED
 * second `<br>` (the spec says a closing tag for a void element starts
 * a new void element), producing a DOUBLE line break on screen.
 *
 * This helper rewrites every `<br></br>` (with any whitespace variants)
 * into a single `<br />` so DOM rendering matches the original t.rich
 * shape — one line break per JSON occurrence.
 *
 * Applied in two places for defense in depth:
 *   1. `loadCmsTextsForPage` — server-side, so CMS rows arrive at the
 *      client pre-normalized.
 *   2. `<CmsText>` — client-side last-mile, covers the JSON fallback
 *      path (which sources text from messages/*.json via next-intl
 *      and never passes through the server loader).
 */
const BROKEN_BR_RE = /<br\s*\/?\s*><\/br\s*>/gi;

export function normalizeRichText(html: string): string {
  if (!html) return html;
  return html.replace(BROKEN_BR_RE, "<br />");
}

/**
 * Same as `normalizeRichText` but applied to every `he_text` / `en_text`
 * field of a row collection. Used by the server loader so the data
 * crossing the server→client boundary is already clean.
 */
export function normalizeRowsForRender<
  T extends {
    he_text: string | null;
    en_text: string | null;
  },
>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    he_text: row.he_text == null ? row.he_text : normalizeRichText(row.he_text),
    en_text: row.en_text == null ? row.en_text : normalizeRichText(row.en_text),
  }));
}
