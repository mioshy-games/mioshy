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

// 2026-05-20 — Detect whether the admin used proper block-level HTML
// structure (<p>, <ul>, <li>) to organise paragraphs. If they DID, we
// leave raw `\n` alone — the block tags handle visible spacing, and
// extra `<br />` between blocks would add awkward double gaps.
// If they DIDN'T (most cases — short prose with maybe a <mark> or
// <em>), we treat `\n` as the admin's line-break intent and convert
// each one to `<br />` so the visual output matches what they typed
// in the editor.
//
// Why this matters: when the admin types Enter in the plain-mode
// editor it inserts `\n`. As long as `is_rich=false`, the CmsText
// plain path renders with `whitespace-pre-line` and the newline
// becomes a visible line break. The moment they add `<mark>` or
// any rich markup, the row gets treated as rich and the renderer
// switches to `dangerouslySetInnerHTML` — and HTML collapses raw
// `\n` to a single space by default. The user reports this as
// "adding <mark> killed my line break".
const BLOCK_TAG_RE = /<\/?(?:p|ul|ol|li|div|h[1-6])\b/i;
const PLAIN_NEWLINE_RE = /\n/g;

export function normalizeRichText(html: string): string {
  if (!html) return html;
  // Step 1 — repair legacy `<br></br>` (ICU artefact) to a single
  // self-closing `<br />`.
  let result = html.replace(BROKEN_BR_RE, "<br />");
  // Step 2 — if the admin didn't structure with block tags, lift
  // `\n` into `<br />` so plain-mode line breaks survive after the
  // row gets promoted to rich (e.g. by adding <mark>). Skipped when
  // block tags exist so we don't double-space structured content.
  if (!BLOCK_TAG_RE.test(result)) {
    result = result.replace(PLAIN_NEWLINE_RE, "<br />");
  }
  return result;
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

// Sanitization (DOMPurify-backed) lives in lib/cms/sanitize.ts. It's
// server-only because isomorphic-dompurify pulls JSDOM into the build,
// which the client bundle can't tolerate. Keep this file safe for
// both client + server consumers.

/**
 * normalizePlainText — render-time clean-up for PLAIN-mode CMS strings.
 *
 * 2026-05-20 — Itzik wants Enter key in the CMS plain-text editor to
 * produce a visible line break in the UI, without forcing admins to
 * switch to rich mode and type `<br>`. The CmsText component now sets
 * `white-space: pre-line` on plain rows, which makes the browser
 * honour `\n` characters as line breaks. This helper does the safety
 * pass right before render so accidental admin typos don't leak into
 * the public site:
 *
 *   • Trim leading/trailing whitespace (including blank lines at
 *     start or end of the string).
 *   • Collapse 3 or more consecutive newlines to exactly 2 — this
 *     means at most ONE blank line between paragraphs. Two-newline
 *     gaps (paragraph break) are preserved; four-newline accidents
 *     are normalised down.
 *   • Collapse multiple horizontal whitespace inside a single line
 *     (tabs + spaces) to a single space.
 *
 * NOT applied at save time — the DB keeps whatever the admin typed
 * verbatim. Normalisation lives strictly at the render boundary, so
 * we can tweak the rules later without re-saving every row.
 */
const MULTI_NEWLINE_RE = /\n{3,}/g;
const TRAILING_WS_PER_LINE_RE = /[ \t]+$/gm;
const MULTI_HSPACE_RE = /[ \t]{2,}/g;

export function normalizePlainText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    // Normalise CRLF to LF first so the multi-newline regex behaves
    // identically on data that came from a Windows admin browser.
    .replace(/\r\n?/g, "\n")
    // Trim spaces/tabs at the END of each line — these are almost
    // always invisible-to-the-admin typos and don't change meaning.
    .replace(TRAILING_WS_PER_LINE_RE, "")
    // Collapse runs of 3+ newlines to 2 (= one blank line max).
    .replace(MULTI_NEWLINE_RE, "\n\n")
    // Collapse multiple spaces/tabs INSIDE a line to a single space.
    .replace(MULTI_HSPACE_RE, " ")
    // Final outer trim so whole-string leading/trailing blank lines
    // (or whitespace) don't show up as empty lines in the UI.
    .trim();
}
