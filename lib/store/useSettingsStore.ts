"use client";

/**
 * Zustand store for the Game Settings system.
 *
 * Responsibilities:
 *  • Hold the current "draft" settings being edited in the panel
 *  • Track the active game id
 *  • Track the save scope (current / all / default)
 *  • Provide optimistic local updates (DB calls happen in useGameSettings hook)
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
import type {
  GameSettings,
  WheelSettings,
  BorderSettings,
  BackgroundSettings,
  MotionSettings,
  ShapeSettings,
  ParticlesSettings,
  SaveScope,
  SettingsPreset,
} from "@/lib/types/settings";
import { DEFAULT_GAME_SETTINGS } from "@/lib/settings-defaults";

/** Deep-clone that works inside AND outside Immer set() callbacks */
function deepClone<T>(value: T): T {
  try {
    // current() unwraps Immer Proxy → plain object, then we JSON-clone it
    return JSON.parse(JSON.stringify(current(value as object))) as T;
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsStoreState = {
  /** Game currently being edited (null = global defaults panel) */
  activeGameId: string | null;

  /** The "committed" settings loaded from DB (before edits) */
  savedSettings: GameSettings;

  /** Draft being edited live in the panel */
  draftSettings: GameSettings;

  /** Whether the panel is open */
  panelOpen: boolean;

  /** Save scope selection */
  scope: SaveScope;

  /** Available presets (loaded on mount) */
  presets: SettingsPreset[];

  /** Whether a save is in progress */
  isSaving: boolean;

  /** Error from last save attempt */
  saveError: string | null;
};

export type SettingsStoreActions = {
  /** Load settings into the store without opening the sheet (inline editor use) */
  loadSettings: (gameId: string, initialSettings: GameSettings) => void;

  /** Open the settings panel for a given game */
  openPanel: (gameId: string, initialSettings: GameSettings) => void;

  /** Close the panel (discards unsaved draft) */
  closePanel: () => void;

  /** Patch any top-level section of the draft */
  patchDraft: (partial: {
    wheel?: Partial<WheelSettings>;
    border?: Partial<BorderSettings>;
    background?: Partial<BackgroundSettings>;
    motion?: Partial<MotionSettings>;
    shape?: Partial<ShapeSettings>;
    particles?: Partial<ParticlesSettings>;
    layout?: GameSettings["layout"];
  }) => void;

  /** Reset draft to the saved (committed) settings */
  resetDraft: () => void;

  /** Replace draft with a preset's settings */
  applyPreset: (preset: SettingsPreset) => void;

  /** Update scope checkboxes */
  setScope: (partial: Partial<SaveScope>) => void;

  /** Toggle a field in selectedFields */
  toggleScopeField: (field: keyof GameSettings) => void;

  /** Called by useGameSettings after a successful DB save */
  commitDraft: () => void;

  setIsSaving: (v: boolean) => void;
  setSaveError: (msg: string | null) => void;
  setPresets: (presets: SettingsPreset[]) => void;
};

export type SettingsStore = SettingsStoreState & SettingsStoreActions;

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
  immer((set) => ({
    // ── Initial state ──────────────────────────────────────────────────────
    activeGameId: null,
    savedSettings: DEFAULT_GAME_SETTINGS,
    draftSettings: DEFAULT_GAME_SETTINGS,
    panelOpen: false,
    scope: {
      currentGameOnly: true,
      allExistingGames: false,
      saveAsDefault: false,
      selectedFields: [],
    },
    presets: [],
    isSaving: false,
    saveError: null,

    // ── Actions ────────────────────────────────────────────────────────────
    loadSettings: (gameId, initialSettings) =>
      set((s) => {
        s.activeGameId = gameId;
        s.savedSettings = initialSettings;
        s.draftSettings = deepClone(initialSettings);
        s.saveError = null;
      }),

    openPanel: (gameId, initialSettings) =>
      set((s) => {
        s.activeGameId = gameId;
        s.savedSettings = initialSettings;
        s.draftSettings = deepClone(initialSettings);
        s.panelOpen = true;
        s.saveError = null;
      }),

    closePanel: () =>
      set((s) => {
        s.panelOpen = false;
      }),

    patchDraft: (partial) =>
      set((s) => {
        if (partial.wheel) s.draftSettings.wheel = { ...s.draftSettings.wheel, ...partial.wheel };
        if (partial.border) s.draftSettings.border = { ...s.draftSettings.border, ...partial.border };
        if (partial.background) s.draftSettings.background = { ...s.draftSettings.background, ...partial.background };
        if (partial.motion) s.draftSettings.motion = { ...s.draftSettings.motion, ...partial.motion };
        if (partial.shape) s.draftSettings.shape = { ...s.draftSettings.shape, ...partial.shape };
        if (partial.particles) s.draftSettings.particles = { ...s.draftSettings.particles, ...partial.particles };
        if (partial.layout !== undefined) s.draftSettings.layout = partial.layout;
      }),

    resetDraft: () =>
      set((s) => {
        s.draftSettings = deepClone(s.savedSettings);
      }),

    applyPreset: (preset) =>
      set((s) => {
        s.draftSettings = deepClone(preset.settings);
      }),

    setScope: (partial) =>
      set((s) => {
        Object.assign(s.scope, partial);
      }),

    toggleScopeField: (field) =>
      set((s) => {
        const idx = s.scope.selectedFields.indexOf(field);
        if (idx === -1) {
          s.scope.selectedFields.push(field);
        } else {
          s.scope.selectedFields.splice(idx, 1);
        }
      }),

    commitDraft: () =>
      set((s) => {
        s.savedSettings = deepClone(s.draftSettings);
      }),

    setIsSaving: (v) =>
      set((s) => {
        s.isSaving = v;
      }),

    setSaveError: (msg) =>
      set((s) => {
        s.saveError = msg;
      }),

    setPresets: (presets) =>
      set((s) => {
        s.presets = presets;
      }),
  })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selectors (stable references)
// ─────────────────────────────────────────────────────────────────────────────
export const selectDraft = (s: SettingsStore) => s.draftSettings;
export const selectSaved = (s: SettingsStore) => s.savedSettings;
export const selectScope = (s: SettingsStore) => s.scope;
export const selectPresets = (s: SettingsStore) => s.presets;
export const selectPanelOpen = (s: SettingsStore) => s.panelOpen;
export const selectIsSaving = (s: SettingsStore) => s.isSaving;
export const selectSaveError = (s: SettingsStore) => s.saveError;
export const selectActiveGameId = (s: SettingsStore) => s.activeGameId;
