import "server-only";

import DOMPurify from "isomorphic-dompurify";

/**
 * CMS — server-side rich-text sanitisation.
 *
 * Lives in a SEPARATE file from `lib/cms/render.ts` because
 * isomorphic-dompurify drags JSDOM into the bundle. JSDOM references
 * filesystem-bound CSS files (browser/default-stylesheet.css) that
 * don't exist in a Next.js client/edge bundle context, so importing
 * this module from anywhere reachable by the client side breaks
 * `next build` with ENOENT. `import "server-only"` here is the guard:
 * any accidental client import errors loudly at build time.
 *
 * CMS save flow allows admins to wrap selected text in <em> / <strong>
 * via the toolbar in CmsTextRow. Plus the existing copy already has
 * inline <em>, <strong>, <br> markup carried over from the seed.
 *
 * Save-time validation pipeline runs TWO checks:
 *
 *   1. Detect any tag NOT in the allow-list — if found, REJECT the
 *      save and tell the admin what was disallowed. Don't silently
 *      strip; better to surface the problem so they know what
 *      changed.
 *   2. Pass the value through DOMPurify with the strict allow-list as
 *      a defense-in-depth pass. Even allowed tags get their
 *      attributes stripped (no <em onclick="…">, no <strong style="…">).
 */

const ALLOWED_TAGS = ["em", "strong", "br"] as const;
const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS);

/**
 * Returns a list of tag names found in `html` that are NOT in the
 * allow-list. Used to produce a clear error message before saving —
 * the admin sees "found <script>, <iframe>" instead of a silent strip.
 *
 * Tag detection is intentionally lightweight (regex over opening +
 * closing tag names). It's not a parser — it's a screening pass to
 * surface obvious abuse. DOMPurify is the actual stripper if anything
 * sneaks past.
 */
export function findDisallowedTags(html: string): string[] {
  if (!html) return [];
  const found = new Set<string>();
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1]!.toLowerCase();
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
 *   ok: true   → use `result.html` (cleaned input)
 *   ok: false  → reject save; surface `result.disallowed` in the error
 *
 * Empty / null input returns ok:true with empty string — admins may
 * legitimately blank a value to fall back to messages/*.json.
 */
export function sanitizeRichText(html: string): SanitizeResult {
  if (!html) return { ok: true, html: "" };

  const disallowed = findDisallowedTags(html);
  if (disallowed.length > 0) {
    return { ok: false, disallowed };
  }

  // DOMPurify with the strictest possible config — allowed tags only,
  // no attributes, no data:/javascript: URIs (those wouldn't apply to
  // em/strong/br anyway, but locked down regardless).
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  return { ok: true, html: clean };
}
