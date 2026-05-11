import type { GameSettings, ParticlesSettings, SettingsPreset } from "@/lib/types/settings";

// ─────────────────────────────────────────────────────────────────────────────
// Default particle settings (shared by all defaults and presets)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_PARTICLES: ParticlesSettings = {
  enabled: true,
  count: 18,
  shape: "circle",
  opacity: 0.55,
  speed: 4,
  sizeMin: 4,
  sizeMax: 12,
};

// ─────────────────────────────────────────────────────────────────────────────
// Default fallback settings (matches DB seed in migration 019)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  wheel: {
    sizeRem: 22,
    sizeRemMax: 32,
    labelRadiusFraction: 0.72,
    centerShadow: {
      enabled: false,
      color: "#000000",
      opacity: 0.35,
      blur: 4,
      offsetX: 0,
      offsetY: 2,
    },
    dividerShadow: {
      enabled: false,
      color: "#000000",
      opacity: 0.25,
      blur: 2,
    },
    labelFontSizePx: 12,
    labelColor: "#ffffff",
    labelOutline: {
      enabled: true,
      color: "#000000",
      opacity: 0.25,
      width: 2,
    },
    labelOrientation: "tangential",
    pointerColor: "#ffffff",
    pointerOffsetY: 0,
    innerCircle: { enabled: true, fillColor: "#fafafa", borderColor: "#e5e5e5" },
    divider: { enabled: true, color: "#ffffff", width: 2 },
    markers: { type: "none", color: "#ffffff", size: 14, count: 0, position: 100, svgPath: "" },
  },
  border: {
    enabled: true,
    width: 3,
    color: "#ffffff",
    style: "solid",
    distance: 0,
  },
  background: {
    type: "color",
    color: "#1e1b4b",
  },
  motion: {
    spinSpeed: 5,
    movementSpeed: 5,
    easing: "ease-out",
  },
  shape: {
    enabled: true,
    type: "circle",
  },
  particles: DEFAULT_PARTICLES,
  layout: "centered",
};

// ─────────────────────────────────────────────────────────────────────────────
// Built-in presets (mirrored from DB seed – available offline too)
// ─────────────────────────────────────────────────────────────────────────────
export const BUILT_IN_PRESETS: SettingsPreset[] = [
  {
    id: "preset-fast",
    name: "Fast Game",
    description: "High speed, snappy animations",
    isBuiltIn: true,
    settings: {
      wheel: {
        sizeRem: 22,
        labelRadiusFraction: 0.72,
        centerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.35,
          blur: 4,
          offsetX: 0,
          offsetY: 2,
        },
        dividerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.25,
          blur: 2,
        },
        labelFontSizePx: 12,
        labelColor: "#ffffff",
        labelOutline: {
          enabled: true,
          color: "#000000",
          opacity: 0.25,
          width: 2,
        },
        labelOrientation: "tangential",
        pointerColor: "#ffffff",
        pointerOffsetY: 0,
        innerCircle: { enabled: true, fillColor: "#fafafa", borderColor: "#e5e5e5" },
        divider: { enabled: true, color: "#ffffff", width: 2 },
        markers: { type: "none", color: "#ffffff", size: 14, count: 0, position: 100, svgPath: "" },
      },
      border: { enabled: true, width: 3, color: "#f59e0b", style: "solid", distance: 0 },
      background: { type: "gradient", color: "#1e1b4b", gradient: { from: "#f59e0b", to: "#ef4444" } },
      motion: { spinSpeed: 9, movementSpeed: 8, easing: "ease-out" },
      shape: { enabled: true, type: "circle" },
      particles: { ...DEFAULT_PARTICLES, speed: 7, count: 22 },
      layout: "centered",
    },
  },
  {
    id: "preset-kids",
    name: "Kids Mode",
    description: "Soft colors, gentle animations",
    isBuiltIn: true,
    settings: {
      wheel: {
        sizeRem: 22,
        labelRadiusFraction: 0.72,
        centerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.35,
          blur: 4,
          offsetX: 0,
          offsetY: 2,
        },
        dividerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.25,
          blur: 2,
        },
        labelFontSizePx: 12,
        labelColor: "#ffffff",
        labelOutline: {
          enabled: true,
          color: "#000000",
          opacity: 0.25,
          width: 2,
        },
        labelOrientation: "tangential",
        pointerColor: "#ffffff",
        pointerOffsetY: 0,
        innerCircle: { enabled: true, fillColor: "#fafafa", borderColor: "#e5e5e5" },
        divider: { enabled: true, color: "#ffffff", width: 2 },
        markers: { type: "none", color: "#ffffff", size: 14, count: 0, position: 100, svgPath: "" },
      },
      border: { enabled: true, width: 5, color: "#fde68a", style: "dashed", distance: 8 },
      background: { type: "gradient", color: "#fef9c3", gradient: { from: "#bfdbfe", to: "#fbcfe8" } },
      motion: { spinSpeed: 3, movementSpeed: 3, easing: "ease-in-out" },
      shape: { enabled: true, type: "circle" },
      particles: { ...DEFAULT_PARTICLES, shape: "star", count: 15, speed: 2 },
      layout: "centered",
    },
  },
  {
    id: "preset-minimal",
    name: "Minimal",
    description: "Clean, borderless, no-frills",
    isBuiltIn: true,
    settings: {
      wheel: {
        sizeRem: 22,
        labelRadiusFraction: 0.72,
        centerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.35,
          blur: 4,
          offsetX: 0,
          offsetY: 2,
        },
        dividerShadow: {
          enabled: false,
          color: "#000000",
          opacity: 0.25,
          blur: 2,
        },
        labelFontSizePx: 12,
        labelColor: "#ffffff",
        labelOutline: {
          enabled: true,
          color: "#000000",
          opacity: 0.25,
          width: 2,
        },
        labelOrientation: "tangential",
        pointerColor: "#ffffff",
        pointerOffsetY: 0,
        innerCircle: { enabled: true, fillColor: "#fafafa", borderColor: "#e5e5e5" },
        divider: { enabled: true, color: "#ffffff", width: 2 },
        markers: { type: "none", color: "#ffffff", size: 14, count: 0, position: 100, svgPath: "" },
      },
      border: { enabled: false, width: 0, color: "transparent", style: "none", distance: 0 },
      background: { type: "color", color: "#0f172a" },
      motion: { spinSpeed: 5, movementSpeed: 5, easing: "linear" },
      shape: { enabled: true, type: "circle" },
      particles: { ...DEFAULT_PARTICLES, enabled: false },
      layout: "centered",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility: deep merge (partial overrides)
// ─────────────────────────────────────────────────────────────────────────────
export function mergeSettings(
  base: GameSettings,
  overrides: Partial<GameSettings>,
): GameSettings {
  const merged: GameSettings = {
    wheel: { ...base.wheel, ...(overrides.wheel ?? {}) },
    border: { ...base.border, ...(overrides.border ?? {}) },
    background: { ...base.background, ...(overrides.background ?? {}) },
    motion: { ...base.motion, ...(overrides.motion ?? {}) },
    shape: { ...base.shape, ...(overrides.shape ?? {}) },
    particles: { ...DEFAULT_PARTICLES, ...(base.particles ?? {}), ...(overrides.particles ?? {}) },
    layout: overrides.layout ?? base.layout,
  };
  // Pass through optional top-level scalars that aren't sub-objects
  const resolvedGapPx = overrides.wheelGapPx ?? base.wheelGapPx;
  if (resolvedGapPx !== undefined) merged.wheelGapPx = resolvedGapPx;
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: pick only the requested top-level fields from settings
// ─────────────────────────────────────────────────────────────────────────────
export function pickSettingsFields(
  settings: GameSettings,
  fields: (keyof GameSettings)[],
): Partial<GameSettings> {
  const result: Partial<GameSettings> = {};
  for (const f of fields) {
    // @ts-expect-error – dynamic key assignment
    result[f] = settings[f];
  }
  return result;
}
