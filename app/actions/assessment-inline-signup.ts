"use server";

/**
 * Inline signup for the assessments product line. Mirrors
 * journey-inline-signup's auth mechanics (admin createUser with
 * email_confirm to skip the email rate limit, sign in via the session
 * client so the cookie is set before we return), but links the anonymous
 * ASSESSMENT session(s) for this device — never touches journeys.
 */

import { cookies, headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
} from "@/lib/auth/session-enforcement";

export type AssessmentInlineSignupResult =
  | { success: true; userId: string }
  | { success: false; error: string };

export async function assessmentInlineSignup(args: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  language?: "he" | "en";
  deviceId: string;
  assessmentId: string;
  mode: "register" | "login";
}): Promise<AssessmentInlineSignupResult> {
  const email = args.email.trim();
  const fullName = args.fullName.trim();
  const phone = (args.phone ?? "").trim();
  const password = args.password;

  if (!email || !password)
    return { success: false, error: "Email and password are required." };
  if (args.mode === "register" && !fullName)
    return { success: false, error: "Full name is required to register." };
  if (args.mode === "register" && password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };
  if (!args.deviceId || args.deviceId.length < 8)
    return { success: false, error: "Missing device id - refresh and retry." };

  try {
    const admin = createAdminSupabaseClient();

    if (args.mode === "register") {
      const { data: userData, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            phone,
            language: args.language ?? "he",
          },
        });

      if (createError) {
        const msg = createError.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered")) {
          return {
            success: false,
            error: "An account with this email already exists. Switch to login.",
          };
        }
        return { success: false, error: createError.message };
      }

      const userId = userData.user.id;
      const { error: profileErr } = await admin.from("profiles").upsert(
        { id: userId, full_name: fullName, phone: phone || null },
        { onConflict: "id" },
      );
      if (profileErr) {
        console.warn(
          "[assessmentInlineSignup] profile upsert failed (non-fatal)",
          profileErr.message,
        );
      }
    }

    // ── Sign in (both branches) so the cookie is written before we return ──
    const supabase = await createServerSupabaseClient();
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      return {
        success: false,
        error: signInError?.message ?? "Sign-in failed.",
      };
    }
    const userId = signInData.session.user.id;

    // ── Single-session record + cookie ───────────────────────────────────
    const hdrs = await headers();
    const token = await createSession(userId, {
      ua: hdrs.get("user-agent") ?? "unknown",
      ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown",
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    // ── Claim the anonymous assessment session(s) for this device ─────────
    // Service-role UPDATE: trusts the userId we just signed in with. Scope to
    // this device + assessment so we don't grab unrelated anon rows.
    const { error: claimErr } = await admin
      .from("assessment_sessions")
      .update({
        user_id: userId,
        device_id: null,
        last_activity_at: new Date().toISOString(),
      })
      .eq("device_id", args.deviceId)
      .eq("assessment_id", args.assessmentId)
      .is("user_id", null);
    if (claimErr) {
      console.warn(
        "[assessmentInlineSignup] session claim failed (non-fatal)",
        claimErr.message,
      );
    }

    return { success: true, userId };
  } catch (err) {
    console.error("[assessmentInlineSignup] unhandled error", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected sign-up failure.",
    };
  }
}
