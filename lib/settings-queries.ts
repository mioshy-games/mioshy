/**
 * Supabase CRUD for the Game Settings system.
 *
 * ⚠️  Requires migration 019_game_settings.sql to be applied.
 *     Until then, all reads return safe defaults and all writes
 *     log a warning instead of crashing the app.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GameSettings,
  GameSettingsRow,
  GlobalSettingsRow,
  SettingsPreset,
  SettingsVersion,
  SaveScope,
} from "@/lib/types/settings";
import { DEFAULT_GAME_SETTINGS, mergeSettings, pickSettingsFields } from "@/lib/settings-defaults";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_NOT_FOUND = "schema cache"; // substring present in the error message

function isMissingTable(msg: string) {
  return msg.includes(TABLE_NOT_FOUND) || msg.includes("does not exist");
}

function buildVersionEntry(settings: GameSettings, label?: string): SettingsVersion {
  return {
    version: Date.now(),
    settings,
    savedAt: new Date().toISOString(),
    label,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGlobalSettings(
  supabase: SupabaseClient,
): Promise<GlobalSettingsRow | null> {
  const { data, error } = await supabase
    .from("global_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    if (isMissingTable(error.message)) {
      console.warn("[settings] global_settings table not found – run migration 019. Using hardcoded defaults.");
      return null;
    }
    console.error("[settings] fetchGlobalSettings:", error.message);
    return null;
  }
  const row = data as GlobalSettingsRow;
  // Defensive: older DB rows may miss newly added keys (e.g., wheel.*).
  return {
    ...row,
    default_settings: mergeSettings(
      DEFAULT_GAME_SETTINGS,
      row.default_settings as Partial<GameSettings>,
    ),
  };
}

export async function updateGlobalSettings(
  supabase: SupabaseClient,
  newSettings: GameSettings,
): Promise<void> {
  const current = await fetchGlobalSettings(supabase);
  const history: SettingsVersion[] = current?.version_history ?? [];
  if (current) {
    history.push(buildVersionEntry(current.default_settings, "before update"));
    if (history.length > 20) history.splice(0, history.length - 20);
  }

  const { error } = await supabase
    .from("global_settings")
    .upsert(
      { id: 1, default_settings: newSettings, version_history: history },
      { onConflict: "id" },
    );

  if (error) {
    if (isMissingTable(error.message)) {
      console.warn("[settings] global_settings table not found – run migration 019.");
      return;
    }
    throw new Error(`[settings] updateGlobalSettings: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Game Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGameSettings(
  supabase: SupabaseClient,
  gameId: string,
): Promise<GameSettings> {
  const [gameRow, globalRow] = await Promise.all([
    supabase
      .from("game_settings")
      .select("*")
      .eq("game_id", gameId)
      .maybeSingle(),
    fetchGlobalSettings(supabase),
  ]);

  const globalDefaults =
    globalRow?.default_settings
      ? mergeSettings(DEFAULT_GAME_SETTINGS, globalRow.default_settings as Partial<GameSettings>)
      : DEFAULT_GAME_SETTINGS;

  if (gameRow.error) {
    if (isMissingTable(gameRow.error.message)) {
      console.warn("[settings] game_settings table not found – run migration 019. Using defaults.");
    } else {
      console.error("[settings] fetchGameSettings:", gameRow.error.message);
    }
    return globalDefaults;
  }

  if (!gameRow.data) return globalDefaults;

  return mergeSettings(globalDefaults, gameRow.data.settings as Partial<GameSettings>);
}

export async function upsertGameSettings(
  supabase: SupabaseClient,
  gameId: string,
  newSettings: GameSettings,
): Promise<void> {
  const { data: existing } = await supabase
    .from("game_settings")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  const history: SettingsVersion[] = (existing as GameSettingsRow | null)?.version_history ?? [];
  if (existing) {
    history.push(buildVersionEntry((existing as GameSettingsRow).settings, "before update"));
    if (history.length > 20) history.splice(0, history.length - 20);
  }

  const { error } = await supabase.from("game_settings").upsert(
    { game_id: gameId, settings: newSettings, version_history: history },
    { onConflict: "game_id" },
  );

  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        "טבלת game_settings לא קיימת ב-DB. יש להריץ את migration 019_game_settings.sql דרך Supabase → SQL Editor.",
      );
    }
    throw new Error(`[settings] upsertGameSettings: ${error.message}`);
  }
}

export async function deleteGameSettings(
  supabase: SupabaseClient,
  gameId: string,
): Promise<void> {
  const { error } = await supabase
    .from("game_settings")
    .delete()
    .eq("game_id", gameId);

  if (error) {
    if (isMissingTable(error.message)) return; // table doesn't exist – nothing to delete
    throw new Error(`[settings] deleteGameSettings: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk / Scope Logic
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSettingsWithScope(
  supabase: SupabaseClient,
  currentGameId: string,
  newSettings: GameSettings,
  scope: SaveScope,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  // All settings — including wheel — can be saved per-game.
  // The global /dashboard/settings/wheel provides the base default;
  // per-game settings override it (last write wins).
  const perGamePartial: Partial<GameSettings> = {
    wheel: newSettings.wheel,
    border: newSettings.border,
    background: newSettings.background,
    motion: newSettings.motion,
    shape: newSettings.shape,
    particles: newSettings.particles,
    layout: newSettings.layout,
    ...(newSettings.wheelGapPx !== undefined ? { wheelGapPx: newSettings.wheelGapPx } : {}),
  };
  if (scope.currentGameOnly || (!scope.allExistingGames && !scope.saveAsDefault)) {
    tasks.push(
      (async () => {
        const existing = await fetchGameSettings(supabase, currentGameId);
        const merged = mergeSettings(existing, perGamePartial);
        await upsertGameSettings(supabase, currentGameId, merged);
      })(),
    );
  }

  if (scope.allExistingGames) {
    const { data: games, error } = await supabase.from("games").select("id");
    if (error) throw new Error(`[settings] fetchAllGames: ${error.message}`);

    const partial =
      scope.selectedFields.length > 0
        ? pickSettingsFields(newSettings, scope.selectedFields)
        : perGamePartial;

    for (const game of games ?? []) {
      if (scope.selectedFields.length > 0) {
        tasks.push(
          (async () => {
            const existing = await fetchGameSettings(supabase, game.id);
            const merged = mergeSettings(existing, partial);
            await upsertGameSettings(supabase, game.id, merged);
          })(),
        );
      } else {
        tasks.push(
          (async () => {
            const existing = await fetchGameSettings(supabase, game.id);
            const merged = mergeSettings(existing, perGamePartial);
            await upsertGameSettings(supabase, game.id, merged);
          })(),
        );
      }
    }
  }

  if (scope.saveAsDefault) {
    tasks.push(updateGlobalSettings(supabase, newSettings));
  }

  await Promise.all(tasks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollback
// ─────────────────────────────────────────────────────────────────────────────

export async function rollbackGameSettings(
  supabase: SupabaseClient,
  gameId: string,
  targetVersion: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("game_settings")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error || !data) throw new Error("[settings] No settings found to rollback");

  const row = data as GameSettingsRow;
  const target = row.version_history.find((v) => v.version === targetVersion);
  if (!target) throw new Error("[settings] Version not found in history");

  await upsertGameSettings(supabase, gameId, target.settings);
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate
// ─────────────────────────────────────────────────────────────────────────────

export async function duplicateSettingsFromGame(
  supabase: SupabaseClient,
  sourceGameId: string,
  targetGameId: string,
): Promise<void> {
  const settings = await fetchGameSettings(supabase, sourceGameId);
  await upsertGameSettings(supabase, targetGameId, settings);
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPresets(supabase: SupabaseClient): Promise<SettingsPreset[]> {
  const { data, error } = await supabase
    .from("settings_presets")
    .select("*")
    .order("created_at");

  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[settings] fetchPresets:", error.message);
    }
    return []; // silently return empty – built-in presets are still shown from constants
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    settings: row.settings as GameSettings,
    isBuiltIn: row.is_built_in,
  }));
}

export async function saveAsPreset(
  supabase: SupabaseClient,
  name: string,
  settings: GameSettings,
  description?: string,
): Promise<SettingsPreset> {
  const { data, error } = await supabase
    .from("settings_presets")
    .insert({ name, description, settings, is_built_in: false })
    .select()
    .single();

  if (error) throw new Error(`[settings] saveAsPreset: ${error.message}`);
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    settings: data.settings as GameSettings,
    isBuiltIn: false,
  };
}
