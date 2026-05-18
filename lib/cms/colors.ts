/**
 * CMS colour-override registry + resolver.
 *
 * Sprint 5 — Color Override. The `cms_texts.color_override` column
 * stores one of three shapes (enforced by a DB CHECK constraint in
 * migration 084):
 *
 *   NULL              → no override; component default wins
 *   "preset:<name>"   → named preset, resolved via COLOR_PRESETS
 *   "#XXXXXX"         → 6-digit HEX, used verbatim
 *
 * Keeping the registry centralised means a palette change ("brand-rose
 * is now #C04050") is a one-file diff and no DB migration on the rows
 * that already reference the preset by name.
 *
 * This module is import-safe from both server and client code: pure
 * functions, no Node-only deps.
 */

/**
 * Resolved colour values for every named preset.
 *
 * Note on `muted` — the spec calls for `#8B2638` at 0.7 opacity, which
 * has no single 6-digit HEX representation. We store the rgba string;
 * `style={{ color }}` accepts it identically to a HEX.
 *
 * The `default` UI option in the dropdown does NOT live here — it maps
 * to `color_override = NULL` and short-circuits before resolution.
 */
export const COLOR_PRESETS = {
  "brand-rose": "#B83C4D",
  "brand-rose-dark": "#8B2638",
  "brand-purple": "#3D1F3D",
  "brand-cream": "#FCF4E5",
  "text-primary": "#170E14",
  "text-secondary": "#4A3A45",
  muted: "rgba(139, 38, 56, 0.7)",
  white: "#FFFFFF",
} as const satisfies Record<string, string>;

export type ColorPresetName = keyof typeof COLOR_PRESETS;

/**
 * Display order for the admin dropdown. Hand-curated so brand colours
 * cluster together, neutrals follow, and `white` (the "on dark
 * background" outlier) sits at the end.
 */
export const COLOR_PRESET_ORDER: readonly ColorPresetName[] = [
  "brand-rose",
  "brand-rose-dark",
  "brand-purple",
  "brand-cream",
  "text-primary",
  "text-secondary",
  "muted",
  "white",
] as const;

/**
 * Validation regexes. Exported so the save action (Zod refine) and the
 * admin UI (live input validation) share one source of truth with the
 * DB CHECK constraint in migration 084. Keep these three in sync.
 *
 *   PRESET_VALUE_RE   matches the entire stored value including the
 *                     "preset:" prefix, e.g. "preset:brand-rose".
 *   HEX_VALUE_RE      matches 6-digit HEX with leading '#', case-
 *                     insensitive. 3-digit shorthand is rejected.
 */
export const PRESET_VALUE_RE = /^preset:[a-z][a-z0-9-]*$/;
export const HEX_VALUE_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * True iff `value` is one of the three shapes the DB will accept:
 *   null, "preset:<name>", or "#XXXXXX".
 *
 * Used by the save action and the admin UI. The admin UI also needs
 * to know that an unknown preset name (e.g. "preset:bogus") is
 * structurally valid here but won't resolve to a colour — see
 * `resolveColorOverride`.
 */
export function isValidColorOverride(value: string | null): boolean {
  if (value === null) return true;
  return PRESET_VALUE_RE.test(value) || HEX_VALUE_RE.test(value);
}

/**
 * Resolves a stored `color_override` value into a CSS-ready colour
 * string, or `null` if no colour should be applied.
 *
 *   null                  → null              (no override)
 *   "preset:<name>" (known) → HEX/rgba from COLOR_PRESETS
 *   "preset:<name>" (unknown)→ null + warn    (renamed preset, old row)
 *   "#XXXXXX"             → "#XXXXXX"        (used as-is)
 *   anything else         → null + warn      (junk that bypassed DB check)
 *
 * Never throws. Public-site rendering must not fail because a CMS row
 * carries a bad value.
 */
export function resolveColorOverride(value: string | null | undefined): string | null {
  if (!value) return null;

  if (value.startsWith("preset:")) {
    const name = value.slice("preset:".length);
    if (name in COLOR_PRESETS) {
      return COLOR_PRESETS[name as ColorPresetName];
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[cms-color] unknown preset "${name}" — falling back to no override`);
    }
    return null;
  }

  if (HEX_VALUE_RE.test(value)) {
    return value;
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[cms-color] malformed color_override "${value}" — falling back to no override`);
  }
  return null;
}
