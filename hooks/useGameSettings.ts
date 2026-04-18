"use client";

/**
 * useGameSettings
 *
 * High-level hook that wires together:
 *  • Supabase data fetching (lazy – loads only when openPanel() is called)
 *  • The Zustand settings store
 *  • Save / rollback / preset / duplicate actions
 */

import { useCallback, useState } from "react";
import { createBrowserSupabaseClient as createClient } from "@/lib/supabase/client";
import {
  fetchGameSettings,
  fetchPresets,
  saveSettingsWithScope,
  rollbackGameSettings,
  duplicateSettingsFromGame,
  saveAsPreset,
} from "@/lib/settings-queries";
import { useSettingsStore, selectDraft, selectScope, selectPresets } from "@/lib/store/useSettingsStore";
import type { GameSettings, SettingsPreset, SettingsVersion } from "@/lib/types/settings";
import { BUILT_IN_PRESETS } from "@/lib/settings-defaults";

export function useGameSettings(gameId: string) {
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [versionHistory, setVersionHistory] = useState<SettingsVersion[]>([]);

  const draft = useSettingsStore(selectDraft);
  const scope = useSettingsStore(selectScope);
  const presets = useSettingsStore(selectPresets);

  const {
    openPanel: openPanelStore,
    loadSettings,
    closePanel,
    patchDraft,
    resetDraft,
    applyPreset,
    setScope,
    toggleScopeField,
    commitDraft,
    setIsSaving,
    setSaveError,
    setPresets,
    panelOpen,
    isSaving,
    saveError,
    savedSettings,
  } = useSettingsStore();

  // Shared loader used by both inline editor and sheet-open
  const load = useCallback(async () => {
    const [settings, dbPresets] = await Promise.all([
      fetchGameSettings(supabase, gameId),
      fetchPresets(supabase),
    ]);

    const custom = dbPresets.filter((p: SettingsPreset) => !p.isBuiltIn);
    setPresets([...BUILT_IN_PRESETS, ...custom]);

    // Pull version history from DB row for rollback UI
    const { data } = await supabase
      .from("game_settings")
      .select("version_history")
      .eq("game_id", gameId)
      .maybeSingle();
    if (data?.version_history) {
      setVersionHistory(data.version_history as SettingsVersion[]);
    } else {
      setVersionHistory([]);
    }

    return settings;
  }, [supabase, gameId, setPresets]);

  // ── Lazy open: load settings + presets then open the panel ───────────────
  const openPanel = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await load();
      openPanelStore(gameId, settings);
    } catch (err) {
      console.error("[useGameSettings] openPanel error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [gameId, load, openPanelStore]);

  // ── Inline load: fetch and populate store without opening the sheet ──────
  const loadInline = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await load();
      loadSettings(gameId, settings);
    } catch (err) {
      console.error("[useGameSettings] loadInline error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [gameId, load, loadSettings]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveSettingsWithScope(supabase, gameId, draft, scope);
      commitDraft();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setSaveError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [supabase, gameId, draft, scope, commitDraft, setIsSaving, setSaveError]);

  // ── Rollback ──────────────────────────────────────────────────────────────
  const rollback = useCallback(
    async (targetVersion: number) => {
      setIsSaving(true);
      try {
        await rollbackGameSettings(supabase, gameId, targetVersion);
        const refreshed = await fetchGameSettings(supabase, gameId);
        openPanelStore(gameId, refreshed);
      } finally {
        setIsSaving(false);
      }
    },
    [supabase, gameId, openPanelStore, setIsSaving],
  );

  // ── Duplicate from another game ───────────────────────────────────────────
  const duplicateFrom = useCallback(
    async (sourceGameId: string) => {
      setIsSaving(true);
      try {
        await duplicateSettingsFromGame(supabase, sourceGameId, gameId);
        const refreshed = await fetchGameSettings(supabase, gameId);
        openPanelStore(gameId, refreshed);
      } finally {
        setIsSaving(false);
      }
    },
    [supabase, gameId, openPanelStore, setIsSaving],
  );

  // ── Save current settings as a new preset ────────────────────────────────
  const savePreset = useCallback(
    async (name: string, description?: string): Promise<void> => {
      const preset = await saveAsPreset(supabase, name, draft, description);
      setPresets([...presets, preset]);
    },
    [supabase, draft, presets, setPresets],
  );

  return {
    // State
    settings: draft,
    savedSettings,
    isLoading,
    isSaving,
    saveError,
    panelOpen,
    scope,
    presets,
    versionHistory,

    // Actions
    loadInline,
    openPanel,
    closePanel,
    patchDraft,
    resetDraft,
    applyPreset,
    setScope,
    toggleScopeField,
    save,
    rollback,
    duplicateFrom,
    savePreset,
  };
}
