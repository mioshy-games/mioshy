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

import { cookies, headers } from "next/headers";

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

  // Append-only login history for admin behavior analytics (spec §5.2).
  // Best-effort: a failure here must never block a successful login.
  await recordLoginEvent(userId, deviceInfo);

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Append one login-history row (auth_login_events). Reads device_id from the
// mioshy_device_id cookie and country from the Vercel geo header — both
// best-effort. Awaited (not fire-and-forget) so the row is committed before a
// serverless function freezes, but wrapped so it can never break login.
// ─────────────────────────────────────────────────────────────────────────────

async function recordLoginEvent(
  userId: string,
  deviceInfo: DeviceInfo,
): Promise<void> {
  try {
    const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
    const deviceId = cookieStore.get("mioshy_device_id")?.value ?? null;
    const country = hdrs.get("x-vercel-ip-country") ?? null;

    const admin = createAdminSupabaseClient();
    await admin.from("auth_login_events").insert({
      user_id:     userId,
      device_id:   deviceId,
      device_info: deviceInfo,
      country,
    });
  } catch (err) {
    console.warn(
      "[session-enforcement] login-event insert failed:",
      err instanceof Error ? err.message : err,
    );
  }
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
