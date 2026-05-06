"use server";

import { cookies, headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  invalidateAllSessions,
} from "@/lib/auth/session-enforcement";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getDeviceInfo() {
  const hdrs = await headers();
  return {
    ua: hdrs.get("user-agent") ?? "unknown",
    ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown",
  };
}

async function writeSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Signup
// ─────────────────────────────────────────────────────────────────────────────

export type SignupResult =
  | { success: true }
  | { success: false; error: string };

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const phone    = (formData.get("phone")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!fullName || !email || !password) {
    return { success: false, error: "Please fill in all required fields." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  try {
    const admin = createAdminSupabaseClient();

    // Create user - email_confirm: true skips email verification
    const { data: userData, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) {
      if (createError.message.toLowerCase().includes("already registered")) {
        return { success: false, error: "An account with this email already exists." };
      }
      return { success: false, error: createError.message };
    }

    const userId = userData.user.id;

    // Upsert profile row with name + phone
    await admin.from("profiles").upsert(
      { id: userId, full_name: fullName, phone: phone || null },
      { onConflict: "id" },
    );

    // Auto sign-in via regular client (now that email is confirmed)
    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { success: false, error: "Account created - please log in." };
    }

    // Single-session record
    const token = await createSession(userId, await getDeviceInfo());
    await writeSessionCookie(token);

    return { success: true };
  } catch (err) {
    console.error("[signup]", err);
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export type LoginResult =
  | { success: true; isAdmin: boolean }
  | { success: false; error: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  try {
    const supabase = await createServerSupabaseClient();

    console.log("[loginAction] attempting sign-in", { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Surface the full GoTrue payload - name / status / code / message -
      // so we can tell apart "Invalid credentials" from "Database error
      // querying schema" (which means a column GoTrue queries on auth.users
      // is in an unreadable state, NOT a wrong password).
      console.error("[loginAction] sign-in failed", {
        email,
        name: error.name,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
        message: error.message,
      });
      return {
        success: false,
        error:
          error.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : error.message,
      };
    }

    console.log("[loginAction] sign-in OK", { userId: data.user.id });

    const userId = data.user.id;

    // Single-session: invalidate old sessions then create new one
    // (invalidate is implicit via upsert with onConflict: user_id)
    const token = await createSession(userId, await getDeviceInfo());
    await writeSessionCookie(token);

    // Check admin role for redirect
    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    return { success: true, isAdmin: profile?.role === "admin" };
  } catch (err) {
    console.error("[login]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await invalidateAllSessions(user.id);
    }

    await supabase.auth.signOut();
  } catch {
    // best-effort
  } finally {
    await clearSessionCookie();
  }
}
