import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-game play budget for free users.
 *
 * Every game has its own independent counter:
 *   * Plays 1-3   → free (both guests and logged-in users)
 *   * Guests after play 3 → lead signup modal (still dismissable)
 *   * After successful signup, a one-time +3 bonus is granted per game,
 *     giving the freshly signed-up user 3 more plays before the paywall.
 *   * Plays 4-6 (post-signup) → free thanks to the bonus
 *   * Play 7   → paywall modal (non-dismissable) until they subscribe
 *
 * Logged-in users without a post-signup bonus hit the paywall at play 4
 * for each game.
 */

export const FREE_PLAYS_PER_GAME = 3;
export const POST_SIGNUP_BONUS = 3;

// ───────────────────────────────────────────────────────────────────────
// Logged-in users: user_game_plays table (migration 034)
// ───────────────────────────────────────────────────────────────────────

export type UserGamePlays = {
  plays_used: number;
  post_signup_bonus_used: boolean;
};

/**
 * Read the caller's current play state for a specific game. Applies the
 * weekly auto-reset server-side; also auto-creates the row if missing.
 */
export async function getUserGamePlays(
  supabase: SupabaseClient,
  gameSlug: string,
): Promise<UserGamePlays> {
  const { data, error } = await supabase.rpc("get_user_game_plays", {
    p_game_slug: gameSlug,
  });
  if (error || !data) {
    return { plays_used: 0, post_signup_bonus_used: false };
  }
  // RPC returns SETOF — Supabase client resolves it as an array.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    plays_used: Number(row?.plays_used ?? 0),
    post_signup_bonus_used: Boolean(row?.post_signup_bonus_used ?? false),
  };
}

/**
 * Atomically increment plays_used for a specific game and return the new
 * value. Weekly reset is applied transactionally on the server.
 */
export async function incrementUserGamePlays(
  supabase: SupabaseClient,
  gameSlug: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("increment_user_game_plays", {
    p_game_slug: gameSlug,
  });
  if (error || data == null) return 0;
  return Number(data);
}

/**
 * Flip the post_signup_bonus_used flag and reset plays_used to 0 — giving
 * the caller a fresh window of FREE_PLAYS_PER_GAME. Idempotent: if the
 * bonus was already granted, returns the current plays_used without change.
 */
export async function grantPostSignupBonus(
  supabase: SupabaseClient,
  gameSlug: string,
): Promise<UserGamePlays> {
  const { data, error } = await supabase.rpc("grant_post_signup_bonus", {
    p_game_slug: gameSlug,
  });
  if (error || !data) {
    return { plays_used: 0, post_signup_bonus_used: true };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    plays_used: Number(row?.plays_used ?? 0),
    post_signup_bonus_used: Boolean(row?.post_signup_bonus_used ?? true),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Guests: localStorage, sharded per game slug
// ───────────────────────────────────────────────────────────────────────

function guestPlaysKey(gameSlug: string) {
  return `mioshy:guest_plays_v2:${gameSlug}`;
}

export function getGuestGamePlays(gameSlug: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(guestPlaysKey(gameSlug));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function setGuestGamePlays(gameSlug: string, n: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    guestPlaysKey(gameSlug),
    String(Math.max(0, Math.floor(n))),
  );
}

export function incrementGuestGamePlays(gameSlug: string): number {
  const next = getGuestGamePlays(gameSlug) + 1;
  setGuestGamePlays(gameSlug, next);
  return next;
}

/**
 * Returns true while the user holds a cached lead_id locally — i.e. they
 * have already completed the lead signup modal at some point. The flag is
 * written once, globally, by the lead-capture step in SubscriptionModal.
 */
export function hasGuestLeadCaptured(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem("mioshy:lead_id_v1"));
}
