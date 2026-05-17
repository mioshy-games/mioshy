"use server";

/**
 * Server-side loader for the Snakes & Ladders game config.
 *
 * Architecture (2026-05-17, per Itzik):
 *   The board itself — boardSize, snakes, ladders, coin steps,
 *   penalties — is a frozen, hardcoded game design. It lives in
 *   `lib/snakes/defaultConfig.ts` (`DEFAULT_SNAKES_CONFIG`) and is
 *   never sourced from the DB. Admins do not tune mechanics.
 *
 *   The DB row in `snakes_ladders_config` only contributes the *content*
 *   that admins actually edit:
 *     • `name`       — display name for the variant
 *     • `questions`  — the question/challenge deck
 *
 *   Every other field on the returned `GameConfig` comes from
 *   `DEFAULT_SNAKES_CONFIG`, regardless of what's stored in the row.
 *   This is the explicit "hardcoded wins" rule: the admin tabs for
 *   snakes/ladders/coin/penalties are hidden from the UI, but even if
 *   stale values are sitting in those columns from past edits, the
 *   loader ignores them.
 *
 * Resolution chain (in order):
 *   1. The row with `is_active = true` — what admins toggle to publish.
 *   2. The row with `is_default = true` — seeded fallback if no active.
 *   3. `DEFAULT_SNAKES_CONFIG` verbatim — emergency fallback if the DB
 *      is unreachable or both queries error out.
 *
 * Each miss is logged at console.warn level on the server side (Vercel
 * runtime logs) so a "wrong content live" report has a trail. The
 * function never throws — callers always get a valid `GameConfig`.
 *
 * `"use server"` is set at the top so this can be invoked from both
 * server components (the local-game page) and client components (the
 * room-lobby start button) without duplicating the merge logic.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_SNAKES_CONFIG } from "./defaultConfig";
import type { GameConfig, Question } from "./types";

/** Subset of `snakes_ladders_config` we actually consume now. */
interface SnakesConfigRow {
  name: string | null;
  questions: unknown;
}

/**
 * Merge a DB row over `DEFAULT_SNAKES_CONFIG`. Only `name` and
 * `questions` cross from the row; everything mechanical stays
 * hardcoded. Pass `null` to get the pure hardcoded config.
 */
function mergeRowWithDefaults(row: SnakesConfigRow | null): GameConfig {
  if (!row) return DEFAULT_SNAKES_CONFIG;

  const dbQuestions = Array.isArray(row.questions)
    ? (row.questions as Question[])
    : null;

  return {
    ...DEFAULT_SNAKES_CONFIG,
    name: row.name ?? DEFAULT_SNAKES_CONFIG.name,
    // If the admin saved an empty array, respect that — they get an
    // empty deck (a bug they can fix). Only swap in the hardcoded deck
    // when the column is null/non-array (i.e. truly absent).
    questions: dbQuestions ?? DEFAULT_SNAKES_CONFIG.questions,
  };
}

/**
 * Fetch the live Snakes config the same way both the local game and
 * the room lobby ship it. Always resolves to a usable `GameConfig`;
 * the `source` tag lets callers surface telemetry or "(fallback)"
 * markers in the console.
 */
export async function loadActiveSnakesConfig(): Promise<{
  config: GameConfig;
  source: "active" | "default" | "hardcoded";
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. is_active=true (the admin's currently published variant)
    const activeRes = await supabase
      .from("snakes_ladders_config")
      .select("name, questions")
      .eq("is_active", true)
      .maybeSingle();

    if (activeRes.data) {
      return {
        config: mergeRowWithDefaults(activeRes.data as SnakesConfigRow),
        source: "active",
      };
    }
    if (activeRes.error) {
      console.warn("[snakes/configLoader] active fetch error", activeRes.error.message);
    }

    // 2. is_default=true (the seeded "Default Couples" fallback)
    const defaultRes = await supabase
      .from("snakes_ladders_config")
      .select("name, questions")
      .eq("is_default", true)
      .maybeSingle();

    if (defaultRes.data) {
      return {
        config: mergeRowWithDefaults(defaultRes.data as SnakesConfigRow),
        source: "default",
      };
    }
    if (defaultRes.error) {
      console.warn("[snakes/configLoader] default fetch error", defaultRes.error.message);
    }
  } catch (e) {
    console.warn("[snakes/configLoader] unexpected error, falling back to hardcoded", e);
  }

  // 3. Hardcoded emergency fallback — pure DEFAULT_SNAKES_CONFIG.
  return { config: DEFAULT_SNAKES_CONFIG, source: "hardcoded" };
}
