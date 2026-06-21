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
import { tagAsRegistered } from "@/lib/email/brevo-segments-sync";
import { fireCompleteRegistrationCapi } from "@/lib/analytics/meta-capi";

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

// Known sources for marketing_consent_source. Free-form text in the DB
// for forward compatibility (see migration 082); these are the values
// signupAction will ever write.
type SignupSource = "signup" | "registration_modal";

function parseSignupSource(raw: string | null | undefined): SignupSource {
  return raw === "registration_modal" ? "registration_modal" : "signup";
}

function parseLanguage(raw: string | null | undefined): "he" | "en" {
  return raw === "en" ? "en" : "he";
}

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const phone    = (formData.get("phone")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  // New in Step C1 — marketing consent + locale + source. Optional so older
  // callers (forms that haven't been updated yet) keep working: missing
  // consent defaults to false, missing language to 'he', missing source
  // to 'signup'.
  const marketingConsent =
    (formData.get("marketing_consent") as string | null) === "true";
  const preferredLanguage = parseLanguage(
    formData.get("preferred_language") as string | null,
  );
  const source = parseSignupSource(formData.get("source") as string | null);

  // Itzik 2026-06-17: every signup must collect a mobile number, so phone
  // is now required server-side too (backstop for the client `required`).
  // Both real callers (RegistrationModal, SignupForm) already send it.
  if (!fullName || !email || !phone || !password) {
    return { success: false, error: "Please fill in all required fields." };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
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

    // Upsert profile row with name + phone + consent state + language.
    // The trigger from migration 002 has already inserted a row with
    // role='user', so this upsert just fills in the fields we collect at
    // signup. marketing_consent_at is stamped only when consent=true so
    // future code can distinguish "never opted in" (NULL) from "opted in
    // on a specific date" — important for any GDPR audit trail.
    //
    // CRITICAL BUG FIX (Itzik 2026-05-27): write the phone value to BOTH
    // `phone` and `mobile` columns. The schema has two columns with the
    // same data (migration 020 added `phone`, migrations 009+064 added
    // `mobile`). signupAction historically wrote only `phone`, but the
    // profile-completeness gate (lib/auth/profile-gate.ts) reads `mobile`.
    // That mismatch caused every newly-signed-up user — including pair-code
    // partners — to fail requireCompleteProfile() with 'profile_incomplete',
    // which blocked silent auto-pair on signup and shoved partners into
    // a redundant /account/profile completion screen asking for the same
    // phone they just typed seconds earlier. Writing to both keeps every
    // downstream reader happy regardless of which column they consult.
    await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        phone: phone || null,
        mobile: phone || null,
        marketing_consent: marketingConsent,
        marketing_consent_at: marketingConsent ? new Date().toISOString() : null,
        marketing_consent_source: marketingConsent ? source : null,
        preferred_language: preferredLanguage,
      },
      { onConflict: "id" },
    );

    // ── Test-user invitation auto-claim (Itzik 2026-06-01) ─────────────
    // If an admin added this email to test_user_invitations BEFORE the
    // signup, claim it now: flip is_test_user on the new profile and
    // stamp the invitation as claimed. The entitlements gate will now
    // grant every product on the first /my visit.
    //
    // Failure-tolerant: any error here is logged but does NOT block the
    // signup itself. The admin can re-mark the user manually.
    try {
      const { data: invite } = await admin
        .from("test_user_invitations")
        .select("email, note, invited_by")
        .eq("email", email.toLowerCase())
        .is("claimed_at", null)
        .maybeSingle();
      if (invite) {
        await admin
          .from("profiles")
          .update({
            is_test_user: true,
            test_user_note: (invite as { note: string | null }).note,
            test_user_marked_at: new Date().toISOString(),
            test_user_marked_by:
              (invite as { invited_by: string | null }).invited_by,
          })
          .eq("id", userId);
        await admin
          .from("test_user_invitations")
          .update({
            claimed_at: new Date().toISOString(),
            claimed_user_id: userId,
          })
          .eq("email", (invite as { email: string }).email);
        console.log("[signup] test-user invitation claimed", {
          email,
          user_id: userId,
        });
      }
    } catch (claimErr) {
      console.warn("[signup] test-user claim failed (non-fatal)", claimErr);
    }

    // Fire-and-forget Brevo sync. Israeli Communications Act §30A:
    // marketing emails require prior explicit consent, so we only call
    // Brevo when the user ticked the box. Auth + profile creation are
    // the source of truth — Brevo failure must NEVER fail the signup.
    if (marketingConsent) {
      try {
        const syncResult = await tagAsRegistered(
          email,
          userId,
          preferredLanguage,
        );
        if (!syncResult.success) {
          console.warn(
            "[signup] tagAsRegistered returned non-success:",
            syncResult.error,
          );
        }
      } catch (brevoErr) {
        console.error("[signup] Brevo sync failed", brevoErr);
      }
    }

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

    // Meta CompleteRegistration (CAPI) — awaited for reliable serverless
    // delivery (no browser backup); bounded + non-throwing so it never blocks
    // or breaks signup.
    await fireCompleteRegistrationCapi({ userId, email, phone });

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

// 2026-06-01 — error returns now carry a STABLE `code` field on top of
// the human-readable `error` string. LoginForm consumes the code to
// pick a friendly i18n message (HE/EN). Without the code, the form
// was rendering raw Supabase strings like "Database error querying
// schema" directly to users — opaque + scary.
export type LoginErrorCode =
  | "MISSING_FIELDS"
  | "INVALID_CREDENTIALS" // wrong password OR email not registered (GoTrue can't tell)
  | "EMAIL_NOT_CONFIRMED"
  | "RATE_LIMITED"
  | "GENERIC";

export type LoginResult =
  | { success: true; isAdmin: boolean }
  | { success: false; error: string; code: LoginErrorCode };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return {
      success: false,
      code: "MISSING_FIELDS",
      error: "Email and password are required.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();

    console.log("[loginAction] attempting sign-in", { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Map GoTrue payloads to a small, stable code set the UI can
      // translate. The raw message is preserved in `error` for logs +
      // dev-time debugging, but the UI shouldn't surface it directly.
      console.error("[loginAction] sign-in failed", {
        email,
        name: error.name,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
        message: error.message,
      });
      const msg = (error.message ?? "").toLowerCase();
      const goTrueCode = String(
        (error as { code?: string }).code ?? "",
      ).toLowerCase();
      let code: LoginErrorCode = "GENERIC";
      if (msg.includes("invalid login credentials")) {
        code = "INVALID_CREDENTIALS";
      } else if (msg.includes("email not confirmed") || goTrueCode === "email_not_confirmed") {
        code = "EMAIL_NOT_CONFIRMED";
      } else if (
        msg.includes("rate limit") ||
        goTrueCode === "over_request_rate_limit"
      ) {
        code = "RATE_LIMITED";
      }
      return {
        success: false,
        code,
        error:
          code === "INVALID_CREDENTIALS"
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
    return {
      success: false,
      code: "GENERIC",
      error: "Something went wrong. Please try again.",
    };
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
