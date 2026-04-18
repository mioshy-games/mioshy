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
   * Diameter of the wheel in rem units.
   * Default: 22 (≈352px).
   */
  sizeRem: number;
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
  labelOutline: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    width: number; // px
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
