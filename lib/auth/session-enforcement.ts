/**
 * Single-session enforcement helpers.
 *
 * Each time a user logs in we:
 *  1. Generate a fresh session_token (UUID v4).
 *  2. Upsert it into `user_sessions` (one row per user - old row is replaced).
 *  3. Write the token to a cookie called `mioshy_session`.
 *
 * Middleware reads the cookie and validates it against the DB:
 *  • Match  → allow request, bump last_active_at
 *  • No match → user was logged in on another device → redirect to /auth?kicked=1
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const SESSION_COOKIE = "mioshy_session";
/** 30 days */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type DeviceInfo = {
  ua?: string;
  ip?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Create / refresh a session record in DB
// ─────────────────────────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo = {},
): Promise<string> {
  const token = crypto.randomUUID();
  const admin = createAdminSupabaseClient();

  // Upsert: replaces any existing session for this user (single-device rule)
  const { error } = await admin.from("user_sessions").upsert(
    {
      user_id:        userId,
      session_token:  token,
      device_info:    deviceInfo,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[session-enforcement] upsert failed:", error.message);
    throw new Error("Failed to create session record.");
  }

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate session token against DB
// Returns the userId if valid, null if invalid / kicked
// ─────────────────────────────────────────────────────────────────────────────

export async function validateSession(
  token: string,
): Promise<{ userId: string; valid: true } | { valid: false }> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("user_sessions")
    .select("user_id, last_active_at")
    .eq("session_token", token)
    .maybeSingle();

  if (error || !data) return { valid: false };

  // Bump last_active_at (fire-and-forget - don't await to keep middleware fast)
  void admin
    .from("user_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("session_token", token);

  return { valid: true, userId: data.user_id as string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invalidate all sessions for a user (on logout)
// ─────────────────────────────────────────────────────────────────────────────

export async function invalidateAllSessions(userId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from("user_sessions").delete().eq("user_id", userId);
}
