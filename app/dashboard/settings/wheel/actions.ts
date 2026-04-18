"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { fetchGlobalSettings, updateGlobalSettings } from "@/lib/settings-queries";
import { DEFAULT_GAME_SETTINGS, mergeSettings } from "@/lib/settings-defaults";
import type { GamePageLayout, GameSettings } from "@/lib/types/settings";

/** Shape returned/accepted by the global wheel + layout settings page */
export type WheelPageDefaults = {
  wheel: GameSettings["wheel"];
  layout: GamePageLayout;
};

export async function getWheelDefaults(): Promise<WheelPageDefaults> {
  const { supabase } = await requireAdmin();
  const global = await fetchGlobalSettings(supabase);
  const merged = global?.default_settings
    ? mergeSettings(DEFAULT_GAME_SETTINGS, global.default_settings as Partial<GameSettings>)
    : DEFAULT_GAME_SETTINGS;
  return { wheel: merged.wheel, layout: merged.layout };
}

export async function saveWheelDefaults(next: WheelPageDefaults) {
  const { supabase } = await requireAdmin();
  const global = await fetchGlobalSettings(supabase);
  const base = global?.default_settings
    ? mergeSettings(DEFAULT_GAME_SETTINGS, global.default_settings as Partial<GameSettings>)
    : DEFAULT_GAME_SETTINGS;

  await updateGlobalSettings(supabase, {
    ...base,
    wheel: next.wheel,
    layout: next.layout,
  });
}
