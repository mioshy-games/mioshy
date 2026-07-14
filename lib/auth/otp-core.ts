import "server-only";

import { cookies, headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession } from "@/lib/auth/session-enforcement";

/**
 * Shared Email-OTP core for the passwordless auth flow.
 *
 * Flow: `sendEmailOtp` → Supabase mails a 6-digit code → `verifyEmailOtp`
 * establishes the Supabase SSR session (cookies written by the server client) →
 * the caller writes the profile + `finalizeOtpSession` (the custom
 * `mioshy_session` single-device layer) + analytics. This mirrors the old
 * createUser→signInWithPassword→createSession pattern, swapping the password
 * step for OTP while keeping BOTH session systems intact.
 */

/** Set the custom single-device cookie (mioshy_session). Extracted so every OTP
 *  surface uses identical options (was a local helper in auth-actions.ts). */
export async function writeSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Establish the custom single-device session AFTER `verifyEmailOtp` has set the
 *  Supabase session cookies. Call from every surface's verify action. */
export async function finalizeOtpSession(userId: string): Promise<void> {
  const hdrs = await headers();
  const token = await createSession(userId, {
    ua: hdrs.get("user-agent") ?? "unknown",
    ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown",
  });
  await writeSessionCookie(token);
}

export type SendOtpResult =
  | { ok: true }
  | { ok: false; error: string; code?: "no_account" | "rate_limit" | "invalid_email" };

/**
 * Send a 6-digit email OTP.
 * - `mode:"signup"` → creates the user if new and stores `full_name` in metadata.
 * - `mode:"login"`  → never creates; a missing email returns `code:"no_account"`.
 */
export async function sendEmailOtp(args: {
  email: string;
  mode: "signup" | "login";
  fullName?: string;
}): Promise<SendOtpResult> {
  const email = args.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "כתובת מייל לא תקינה.", code: "invalid_email" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: args.mode === "signup",
      ...(args.mode === "signup" && args.fullName?.trim()
        ? { data: { full_name: args.fullName.trim() } }
        : {}),
    },
  });
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const status = (error as { status?: number }).status;
    // login for a non-existent email (shouldCreateUser:false).
    if (args.mode === "login" && (msg.includes("not allowed") || msg.includes("not found") || msg.includes("signups"))) {
      return { ok: false, error: "לא נמצא חשבון עם המייל הזה. אפשר להירשם.", code: "no_account" };
    }
    if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
      return { ok: false, error: "נשלחו יותר מדי קודים. נסו שוב עוד רגע.", code: "rate_limit" };
    }
    console.error("[sendEmailOtp] failed", { message: error.message, status });
    return { ok: false, error: "לא הצלחנו לשלוח קוד. נסו שוב." };
  }
  return { ok: true };
}

/**
 * Deterministic "is this the account's FIRST completed registration?" — true
 * when the profile has no full_name yet. Robust where the `isNewUser` timing
 * heuristic isn't: a genuinely new user who takes >2 min to enter the code still
 * counts as first-time, and an existing account (name already set) never does.
 * Use this to gate identity writes (never overwrite an existing full_name),
 * Brevo, and CompleteRegistration.
 */
export async function isFirstRegistration(userId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const name = (data as { full_name?: string | null } | null)?.full_name;
  return !(name && name.trim().length > 0);
}

export type VerifyOtpResult =
  | { ok: true; userId: string; email: string; isNewUser: boolean }
  | { ok: false; error: string };

/**
 * Verify the 6-digit code. On success the Supabase SSR session is established
 * (the server client writes the auth cookies). Returns the user id + whether
 * this is a brand-new account (created in the last 2 min) so the caller fires
 * CompleteRegistration exactly once (signup, not login). The caller still does
 * profile writes + `finalizeOtpSession` + surface-specific anon-data claiming.
 */
export async function verifyEmailOtp(args: { email: string; token: string }): Promise<VerifyOtpResult> {
  const email = args.email.trim().toLowerCase();
  const token = args.token.replace(/\D/g, "");
  if (token.length !== 6) return { ok: false, error: "הקוד חייב להיות 6 ספרות." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("expired")) return { ok: false, error: "הקוד פג תוקף. בקשו קוד חדש." };
    if (msg.includes("invalid") || msg.includes("incorrect")) return { ok: false, error: "קוד שגוי. בדקו ונסו שוב." };
    console.error("[verifyEmailOtp] failed", { message: error?.message, status: (error as { status?: number })?.status });
    return { ok: false, error: "האימות נכשל. נסו שוב." };
  }
  const createdMs = data.user.created_at ? Date.parse(data.user.created_at) : 0;
  const isNewUser = createdMs > 0 && Date.now() - createdMs < 2 * 60 * 1000;
  return { ok: true, userId: data.user.id, email: data.user.email ?? email, isNewUser };
}
