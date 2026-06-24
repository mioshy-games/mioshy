/**
 * lib/text/sanitize-dashes.ts
 *
 * Display-layer em-dash sanitizer. Brand voice forbids the long dash "—";
 * authors (CMS), static copy, and the LLM all sneak it in. Rather than chase
 * every source we normalise it ONCE at the render points (see CmsText /
 * useCmsText, analyze-assessment, and the static result/focus copy).
 *
 * Scope is deliberately narrow:
 *   • Targets ONLY the em-dash (U+2014) and the horizontal bar (U+2015).
 *   • Leaves the en-dash (U+2013) untouched, so numeric ranges like "₪400–600"
 *     stay intact.
 *   • Collapses any surrounding whitespace into a single " - " so the result
 *     reads as a spaced minus regardless of how the author spaced the dash.
 *   • Idempotent: running it again on its own output is a no-op (the output
 *     contains no U+2014/U+2015).
 *
 * It only ever touches the dash characters, so it is safe to run over strings
 * that contain HTML tags (it can't alter a tag).
 */
export function stripEmDash(input: string): string {
  if (!input) return input;
  // em-dash (U+2014) + horizontal bar (U+2015), with any surrounding whitespace → " - ".
  return input.replace(/\s*[—―]\s*/g, " - ");
}

/**
 * Deep variant for static-copy modules (result-content, focus-month-copy):
 * returns a structurally-identical value with stripEmDash applied to every
 * nested string. Non-strings (numbers, booleans) pass through untouched.
 * Returns a NEW object/array — the source constant is never mutated. Idempotent.
 */
export function stripEmDashDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmDash(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripEmDashDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripEmDashDeep(v);
    }
    return out as T;
  }
  return value;
}
