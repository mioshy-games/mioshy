/**
 * Server-side loader for the Snakes & Ladders game config.
 *
 * Used by `/game/local` (and any other server entrypoint that needs the
 * current admin-managed config) to fetch the live config out of the
 * `snakes_ladders_config` Supabase table.
 *
 * Resolution chain (in order):
 *   1. The row with `is_active = true` — what admins toggle in
 *      `/dashboard/snakes` to publish.
 *   2. The row with `is_default = true` — the seeded fallback so the game
 *      still works if an admin temporarily un-activates everything.
 *   3. `DEFAULT_SNAKES_CONFIG` — the hardcoded emergency config in
 *      `lib/snakes/defaultConfig.ts`. Only reached if the DB is
 *      unreachable, the table is empty, or every fetch above errored.
 *
 * Each layer of the chain is logged at console.warn level on miss so a
 * production "why is local showing the wrong content?" question has a
 * trail. The function never throws — callers always get a valid
 * `GameConfig`.
 *
 * Important: this is a Server Component / route helper only. Keep it out
 * of any "use client" file so the secret-free SSR client stays
 * server-bound and doesn't bloat the bundle.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_SNAKES_CONFIG } from "./defaultConfig";
import type { GameConfig, Question, SnakeOrLadder } from "./types";

/** Raw shape of a `snakes_ladders_config` row coming back from Supabase. */
interface SnakesConfigRow {
  name: string | null;
  board_size: number | null;
  coin_heads_steps: number | null;
  coin_tails_steps: number | null;
  penalty_type: string | null;
  penalty_steps: number | null;
  snakes: unknown;
  ladders: unknown;
  questions: unknown;
}

/**
 * Map a DB row (snake_case) into the in-app `GameConfig` shape
 * (camelCase). Identical to the inline mapping used by the room flow at
 * `app/[locale]/game/[roomCode]/ui.tsx` — extracted here so both
 * entrypoints stay in sync as the schema evolves.
 */
function rowToGameConfig(row: SnakesConfigRow): GameConfig {
  return {
    name: row.name ?? "Default",
    boardSize: row.board_size ?? 100,
    coinHeadsSteps: row.coin_heads_steps ?? 3,
    coinTailsSteps: row.coin_tails_steps ?? 1,
    penaltyType: (row.penalty_type ?? "back5") as "back5" | "start",
    penaltySteps: row.penalty_steps ?? 5,
    snakes: (Array.isArray(row.snakes) ? row.snakes : []) as SnakeOrLadder[],
    ladders: (Array.isArray(row.ladders) ? row.ladders : []) as SnakeOrLadder[],
    questions: (Array.isArray(row.questions) ? row.questions : []) as Question[],
  };
}

/**
 * Fetch the live Snakes config the same way the admin dashboard ships
 * it. Always resolves to a usable `GameConfig`; the result includes a
 * `source` tag so the caller can show "(fallback)" telemetry or just
 * inspect it during debugging.
 */
export async function loadActiveSnakesConfig(): Promise<{
  config: GameConfig;
  source: "active" | "default" | "hardcoded";
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. is_active=true (the admin's "currently published" config)
    const activeRes = await supabase
      .from("snakes_ladders_config")
      .select(
        "name, board_size, coin_heads_steps, coin_tails_steps, penalty_type, penalty_steps, snakes, ladders, questions",
      )
      .eq("is_active", true)
      .maybeSingle();

    if (activeRes.data) {
      return { config: rowToGameConfig(activeRes.data as SnakesConfigRow), source: "active" };
    }
    if (activeRes.error) {
      console.warn("[snakes/configLoader] active fetch error", activeRes.error.message);
    }

    // 2. is_default=true (the seeded "Default Couples" fallback)
    const defaultRes = await supabase
      .from("snakes_ladders_config")
      .select(
        "name, board_size, coin_heads_steps, coin_tails_steps, penalty_type, penalty_steps, snakes, ladders, questions",
      )
      .eq("is_default", true)
      .maybeSingle();

    if (defaultRes.data) {
      return { config: rowToGameConfig(defaultRes.data as SnakesConfigRow), source: "default" };
    }
    if (defaultRes.error) {
      console.warn("[snakes/configLoader] default fetch error", defaultRes.error.message);
    }
  } catch (e) {
    console.warn("[snakes/configLoader] unexpected error, falling back to hardcoded", e);
  }

  // 3. Hardcoded emergency fallback
  return { config: DEFAULT_SNAKES_CONFIG, source: "hardcoded" };
}
