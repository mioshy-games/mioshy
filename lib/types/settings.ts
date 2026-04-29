// ─────────────────────────────────────────────────────────────────────────────
// Game Settings – shared TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use numeric distance (px) instead */
export type BorderDistance = "attached" | "near" | "far";
export type BorderStyle = "solid" | "dashed" | "none";
export type EasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type ShapeType = "circle" | "square" | "custom";
export type BgType = "color" | "gradient" | "image";

/**
 * Game page layout.
 * - "centered"      – classic stacked layout: logo on top, wheel below, spin button below that
 * - "side-by-side"  – desktop split: wheel on the left, spin button / content on the right;
 *                     collapses to centered on narrow viewports (< md)
 */
export type GamePageLayout = "centered" | "side-by-side";

// ── Wheel (global visual sizing) ────────────────────────────────────────────
export type WheelSettings = {
  /**
   * Minimum diameter of the wheel in rem units (mobile / narrow screens).
   * On mobile the wheel is always capped at 92 vw regardless of this value.
   * Default: 22 (≈352 px).
   */
  sizeRem: number;
  /**
   * Maximum diameter of the wheel in rem units (large / wide screens).
   * When set the wheel scales via CSS clamp() from sizeRem → sizeRemMax as
   * the viewport grows.  Omit (or set equal to sizeRem) to keep a fixed size.
   * Default: 32 (≈512 px).
   */
  sizeRemMax?: number;
  /**
   * Radial position of slice labels as a fraction of r (0–1).
   * Default: 0.72 (sits in the outer third of each slice).
   */
  labelRadiusFraction: number;
  centerShadow: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    blur: number; // px (stdDeviation in SVG)
    offsetX: number; // px
    offsetY: number; // px
  };
  dividerShadow: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    blur: number; // px (stdDeviation in SVG)
  };

  labelFontSizePx: number;
  /** Fill color of the slice text. Default: "#ffffff". */
  labelColor: string;
  labelOutline: {
    enabled: boolean;
    /** Stroke / outline color. Default: "#000000". */
    color: string;
    opacity: number; // 0-1
    width: number; // px
  };

  // ── Wheel colors & per-game appearance ──────────────────────────────────
  /** Color of the pointer (triangle or SVG currentColor fill). Default: "#ffffff". */
  pointerColor: string;
  /**
   * Vertical offset of the pointer in px.
   * Negative = upward (deeper into the wheel), positive = downward (away from wheel).
   * Range: -50 … +10. Default: 0.
   */
  pointerOffsetY: number;
  /**
   * Custom SVG markup for the pointer.
   * When provided, replaces the default triangle.
   * Tip: use fill="currentColor" so pointerColor still controls the fill.
   */
  pointerSvg?: string;
  /** Width of the custom SVG pointer in px. Default: 40. */
  pointerSvgWidth?: number;
  /** Height of the custom SVG pointer in px. Default: 48. */
  pointerSvgHeight?: number;
  /** Inner center circle. */
  innerCircle: {
    enabled: boolean;
    fillColor: string;   // default "#fafafa"
    borderColor: string; // default "#e5e5e5"
  };
  /** Lines between slices. */
  divider: {
    enabled: boolean;
    color: string;   // default "#ffffff"
    width: number;   // px, default 2
  };
  /** Decorative markers placed at slice boundaries. */
  markers: {
    type: "none" | "circle" | "svg_icon"; // default "none"
    color: string;      // default "#ffffff"
    size: number;       // px, default 14
    count: number;      // default 0
    position: number;   // % of radius, default 100
    svgPath?: string;   // optional custom SVG path d=""
  };
};

// ── Border (outer ring of the wheel) ─────────────────────────────────────────
export type BorderSettings = {
  enabled: boolean;
  width: number;           // px  1-20
  color: string;           // hex / rgba
  style: BorderStyle;
  /**
   * Gap between wheel edge and border ring, in px (0–50).
   * Legacy string values ("attached"=0, "near"=8, "far"=20) are still accepted
   * at runtime for DB backwards-compatibility.
   */
  distance: number;
};

// ── Background (per-game) ──────────────────────────────────────────────────
export type BackgroundSettings = {
  type: BgType;
  color: string;
  gradient?: { from: string; to: string };
  imageUrl?: string;
};

// ── Motion & Behaviour ────────────────────────────────────────────────────
export type MotionSettings = {
  spinSpeed: number;      // 1-10
  movementSpeed: number;  // 1-10
  easing: EasingType;
};

// ── Shape ─────────────────────────────────────────────────────────────────
export type ShapeSettings = {
  enabled: boolean;
  type: ShapeType;
  customSvg?: string;
};

// ── Floating particles (game-page background) ─────────────────────────────
export type ParticleShape = "circle" | "square" | "star" | "diamond";

export type ParticlesSettings = {
  enabled: boolean;
  /** Number of particles on screen. 5–30. */
  count: number;
  shape: ParticleShape;
  /** Particle opacity 0–1. Colors are auto-derived from the background. */
  opacity: number;
  /** Animation speed 1–10. Higher = faster movement. */
  speed: number;
  /** Minimum particle diameter in px. */
  sizeMin: number;
  /** Maximum particle diameter in px. */
  sizeMax: number;
};

// ── Full settings object ───────────────────────────────────────────────────
export type GameSettings = {
  wheel: WheelSettings;
  border: BorderSettings;
  background: BackgroundSettings;
  motion: MotionSettings;
  shape: ShapeSettings;
  /** Floating particles layer on the game page background. */
  particles: ParticlesSettings;
  /** Page layout for the game. Default: "centered". */
  layout: GamePageLayout;
  /**
   * Fixed gap (px) inserted between the wheel and the spin button,
   * and between the title and the wheel.
   * Large enough to visually clear the pointer tip (top) and any marker
   * dots that bleed outside the wheel container (bottom).
   * Default: 32.
   */
  wheelGapPx?: number;
};

// ── Versioned settings (for rollback) ────────────────────────────────────
export type SettingsVersion = {
  version: number;
  settings: GameSettings;
  savedAt: string;   // ISO date
  label?: string;
};

// ── Preset ────────────────────────────────────────────────────────────────
export type SettingsPreset = {
  id: string;
  name: string;
  description?: string;
  settings: GameSettings;
  isBuiltIn: boolean;
};

// ── Save scope ────────────────────────────────────────────────────────────
export type SaveScope = {
  currentGameOnly: boolean;
  allExistingGames: boolean;
  saveAsDefault: boolean;
  /** Field-level selectors – only these fields are broadcast globally */
  selectedFields: (keyof GameSettings)[];
};

// ── Supabase DB row shapes ─────────────────────────────────────────────────
export type GameSettingsRow = {
  id: string;
  game_id: string;
  settings: GameSettings;
  version_history: SettingsVersion[];
  updated_at: string;
};

export type GlobalSettingsRow = {
  id: number;
  default_settings: GameSettings;
  version_history: SettingsVersion[];
  updated_at: string;
};
