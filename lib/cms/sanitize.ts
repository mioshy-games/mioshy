/**
 * CMS — server-side rich-text sanitisation.
 *
 * History — first implementation used isomorphic-dompurify (a
 * DOMPurify wrapper backed by JSDOM in Node). It worked in local
 * dev + `next build`, but on the Vercel serverless runtime the JSDOM
 * bootstrap silently failed at module load. Result: the action
 * module itself wouldn't import, Next.js wrapped that as a generic
 * "Server Components render" error, and even our outer try/catch in
 * saveCmsText never ran (it's INSIDE the failing module).
 *
 * Replacement (2026-05-13) — pure-regex allow-list. Our policy is
 * narrow enough that we don't need a full HTML parser:
 *
 *   • Only <em>, <strong>, <br> are allowed (opening or closing).
 *   • NO attributes are allowed on any tag. <em style="…"> is
 *     rejected even though <em> itself is fine.
 *   • Everything else is rejected with a clear error listing the
 *     disallowed tag names.
 *
 * No external dependencies. No JSDOM. No serverless surprises.
 *
 * Still tagged `import "server-only"` to keep the architectural
 * intent (only saveCmsText calls it, never client code) even though
 * there's nothing dangerous to leak any more.
 */

import "server-only";

const ALLOWED_TAGS = ["em", "strong", "br"] as const;
const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS);

// Matches any tag-like token: `<`, optional `/`, tag name, anything
// until the next `>`. Captures the tag name. Used by both screening
// (findDisallowedTags) and rewriting (sanitizeRichText).
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/**
 * Returns a list of tag names found in `html` that are NOT in the
 * allow-list. Produces the error string surfaced to the admin
 * ("found <script>, <iframe>") so they know what to remove before
 * retrying.
 */
export function findDisallowedTags(html: string): string[] {
  if (!html) return [];
  const found = new Set<string>();
  // Reset regex state for global flag — RE objects with /g carry
  // lastIndex between invocations; explicit reset is safer.
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html)) !== null) {
    const tag = m[2]!.toLowerCase();
    if (!ALLOWED_TAG_SET.has(tag)) {
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
 *               stripped, tags normalised to bare form)
 *   ok: false  → save is rejected; `result.disallowed` is the list
 *               of forbidden tag names to surface in the error toast
 *
 * Empty / null input returns ok:true with empty string — admins may
 * legitimately blank a value to fall back to messages/*.json.
 *
 * Sanitisation strategy:
 *   1. First pass — `findDisallowedTags` rejects on the first
 *      forbidden tag. We don't silently strip; better to surface
 *      the problem so the admin knows what was removed.
 *   2. Second pass — rewrite every allowed tag to its bare form
 *      (no attributes). `<em onclick="bad()">x</em>` becomes
 *      `<em>x</em>`. `<br />` and `<br>` both normalise to `<br />`.
 *      Closing tags become `</em>` / `</strong>` (no closing tag
 *      for `<br>` since it's void).
 */
export function sanitizeRichText(html: string): SanitizeResult {
  if (!html) return { ok: true, html: "" };

  const disallowed = findDisallowedTags(html);
  if (disallowed.length > 0) {
    return { ok: false, disallowed };
  }

  // Rewrite each matched tag to its bare form. This wipes any
  // attribute payload like style, onclick, data-*, etc. Even though
  // findDisallowedTags caught any malicious TAGS, attributes on the
  // allowed tags could still smuggle behaviour.
  TAG_RE.lastIndex = 0;
  const clean = html.replace(TAG_RE, (_match, slash: string, name: string) => {
    const tag = name.toLowerCase();
    // Closing tag, e.g. </em>
    if (slash === "/") {
      // <br> is void — a closing tag shouldn't really exist, but if
      // someone wrote one, drop it (don't emit </br>, which the HTML
      // parser would parse as a SECOND <br>).
      if (tag === "br") return "";
      return `</${tag}>`;
    }
    // Opening tag. For <br>, emit the self-closing form so the
    // resulting HTML is identical between server render and
    // dangerouslySetInnerHTML re-parse.
    if (tag === "br") return "<br />";
    return `<${tag}>`;
  });

  return { ok: true, html: clean };
}
