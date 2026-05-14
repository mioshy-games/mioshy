/**
 * CMS — server-side rich-text sanitisation.
 *
 * Mode-aware allow-list (Sprint 4 #1, migration 083; Sprint 5 added <mark>):
 *
 *   "plain"  → ZERO tags allowed. Any `<…>` in the input is reported
 *              as disallowed, the save is rejected, the admin sees a
 *              clear toast.
 *   "rich"   → 8-tag allow-list: <em>, <strong>, <mark>, <br>, <p>,
 *              <ul>, <li>, <s>. Attributes are still stripped from
 *              every allowed tag (no <em style="…">, no
 *              <strong onclick="…">). Any other tag is disallowed and
 *              rejects the save.
 *
 *              <mark> renders as inline highlighting — colour only,
 *              no font change. Default colour is brand-rose (#B83C4D);
 *              when a row has color_override the same resolved colour
 *              is forwarded via --cms-mark-color so <mark> picks it up.
 *
 * The mode flows from `cms_texts.is_rich`. Plain rows can never be
 * "promoted" by accident — the admin has to flip the toggle in the
 * editor first, which sends `is_rich=true` along with the save.
 *
 * Implementation is pure regex (replaced the original
 * isomorphic-dompurify dependency after it crashed at module load
 * on Vercel's serverless runtime — see commit a88cd11). No JSDOM,
 * no third-party deps, no serverless surprises.
 */

import "server-only";

// 8-tag allow-list for rich mode. All semantic, all safe, all
// attribute-free after sanitisation. Sprint 5 added <mark>.
const RICH_ALLOWED_TAGS = [
  "em",
  "strong",
  "mark",
  "br",
  "p",
  "ul",
  "li",
  "s",
] as const;
const RICH_ALLOWED_SET = new Set<string>(RICH_ALLOWED_TAGS);

// Matches any tag-like token: `<`, optional `/`, tag name, anything
// until the next `>`. Captures the leading-slash group and the tag
// name. Used by both screening (findDisallowedTags) and rewriting
// (sanitizeRichText).
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

export type SanitizeMode = "plain" | "rich";

/**
 * Returns a list of tag names in `html` that are NOT permitted under
 * the given mode. Empty array means the input is acceptable.
 *
 *   - In "plain" mode every tag is disallowed.
 *   - In "rich" mode only tags outside the 7-tag allow-list are.
 */
export function findDisallowedTags(
  html: string,
  mode: SanitizeMode,
): string[] {
  if (!html) return [];
  // Reset regex state — RE objects with /g carry lastIndex across
  // invocations and we don't want a previous call to skip a leading
  // match.
  TAG_RE.lastIndex = 0;
  const allowed = mode === "rich" ? RICH_ALLOWED_SET : null;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html)) !== null) {
    const tag = m[2]!.toLowerCase();
    if (allowed === null || !allowed.has(tag)) {
      found.add(tag);
    }
  }
  return Array.from(found);
}

export type SanitizeResult =
  | { ok: true; html: string }
  | { ok: false; disallowed: string[] };

/**
 * Validate + clean a CMS text value before persisting.
 *
 *   ok: true   → `result.html` is the cleaned input (attributes
 *               stripped on rich-mode tags; plain input pass-through)
 *   ok: false  → save is rejected; `result.disallowed` lists the
 *               tag names to surface in the error toast.
 *
 * Empty / null input returns ok:true with empty string — admins may
 * legitimately blank a value to fall back to messages/*.json.
 *
 * Rewriting (rich mode only):
 *   - `<em onclick="…">` → `<em>` (attributes stripped)
 *   - `<br>` / `<br/>` / `<br />` → `<br />` (normalised)
 *   - `</br>` (illegal in HTML) → dropped (matches HTML5 spec — a
 *     closing tag on a void element would create a phantom second
 *     <br> in the DOM)
 */
export function sanitizeRichText(
  html: string,
  mode: SanitizeMode,
): SanitizeResult {
  if (!html) return { ok: true, html: "" };

  const disallowed = findDisallowedTags(html, mode);
  if (disallowed.length > 0) {
    return { ok: false, disallowed };
  }

  // Plain mode passed the screen — meaning there are NO tags in the
  // input — so the cleaned output is identical to the input.
  if (mode === "plain") {
    return { ok: true, html };
  }

  // Rich mode — rewrite each allowed tag to its bare form.
  TAG_RE.lastIndex = 0;
  const clean = html.replace(TAG_RE, (_match, slash: string, name: string) => {
    const tag = name.toLowerCase();
    if (slash === "/") {
      // <br> is void — drop any phantom </br>.
      if (tag === "br") return "";
      return `</${tag}>`;
    }
    // Opening / self-closing. <br> always becomes <br /> so the
    // server-rendered HTML matches the dangerouslySetInnerHTML
    // re-parse on the client.
    if (tag === "br") return "<br />";
    return `<${tag}>`;
  });

  return { ok: true, html: clean };
}
