"use client";

/**
 * Lightweight Zustand store that mirrors the wheel-related fields from the
 * GameForm (React Hook Form) so that WheelPreview can be rendered in the
 * sticky sidebar WITHOUT needing to be inside the RHF FormProvider tree.
 *
 * A WheelFormSync component (rendered inside FormProvider) pushes values here
 * via useWatch on every change.
 *
 * AppearanceTab also pushes the appearance-tab fields (border, label, etc.)
 * into this store via a useEffect bridge.
 */

import { create } from "zustand";
import type { WheelSlice } from "@/lib/types/database";
import type { BorderSettings } from "@/lib/types/settings";

export type WheelFormPreviewState = {
  slices: WheelSlice[];
  borderColor: string;
  pointerColor: string;
  /** Vertical offset of the pointer in px. Negative = up, positive = down. Range -50…+10. */
  pointerOffsetY: number;
  /** Custom SVG markup (replaces triangle). Use fill="currentColor" for dynamic coloring. */
  pointerSvg?: string;
  /** Width of the custom SVG pointer in px. */
  pointerSvgWidth?: number;
  /** Height of the custom SVG pointer in px. */
  pointerSvgHeight?: number;
  innerCircle: boolean;
  innerCircleColor: string;
  innerCircleBorderColor: string;
  dividerEnabled: boolean;
  dividerColor: string;
  dividerWidth: number;
  markerConfig: Record<string, unknown>;
  /** Label font size in px (from AppearanceTab → game_settings) */
  labelFontSizePx: number;
  /** Label fill color (from AppearanceTab → game_settings) */
  labelColor: string;
  /** Label outline settings (from AppearanceTab → game_settings) */
  labelOutline: { enabled: boolean; color: string; opacity: number; width: number };
  /** Outer border ring (from AppearanceTab → game_settings.border) */
  outerBorder: BorderSettings | null;
};

type WheelFormStore = WheelFormPreviewState & {
  setWheelPreview: (values: Partial<WheelFormPreviewState>) => void;
};

const DEFAULTS: WheelFormPreviewState = {
  slices: [],
  borderColor: "#ffffff",
  pointerColor: "#ffffff",
  pointerOffsetY: 0,
  innerCircle: true,
  innerCircleColor: "#fafafa",
  innerCircleBorderColor: "#e5e5e5",
  dividerEnabled: true,
  dividerColor: "#ffffff",
  dividerWidth: 2,
  markerConfig: {},
  labelFontSizePx: 12,
  labelColor: "#ffffff",
  labelOutline: { enabled: true, color: "#000000", opacity: 0.25, width: 2 },
  outerBorder: null,
};

export const useWheelFormStore = create<WheelFormStore>()((set) => ({
  ...DEFAULTS,
  setWheelPreview: (values) => set((s) => ({ ...s, ...values })),
}));
