"use server";

/**
 * Poll-flow signup / login — used by the survey registration screen (§6).
 * Joining the daily poll requires an account; the single question, reveal and
 * share stay open (no registration). Mirrors journeyInlineSignup (admin
 * createUser → no confirmation email, signInWithPassword → session cookie set
 * server-side), but poll-specific: it links the anon's saved votes to the new
 * user and subscribes them to the daily question.
 *
 * §9א: a successful REGISTER fires Meta `CompleteRegistration` (server CAPI) —
 * the primary campaign conversion. The returned `capiEventId` lets the browser
 * Pixel fire the same event with a matching event_id for dedup.
 *
 * Additive: new file. Reuses existing auth/analytics/email helpers unchanged.
 */

import { cookies, headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession } from "@/lib/auth/session-enforcement";
import { fireCompleteRegistrationCapi, firePollLeadCapi, metaEventId } from "@/lib/analytics/meta-capi";
import { tagAsRegistered } from "@/lib/email/brevo-segments-sync";
import { isTestUser } from "@/lib/auth/is-test-user";
import { readPollAnonId } from "@/lib/poll/anon";

export type PollSignupResult =
  | { success: true; userId: string; capiEventId: string | null }
  | { success: false; error: string };

export async function pollSignup(args: {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  mode: "register" | "login";
  marketingConsent?: boolean;
  termsAccepted?: boolean;
  /** §6 — shared with the browser Pixel "Lead" for dedup. */
  leadEventId?: string;
}): Promise<PollSignupResult> {
  const email = args.email.trim();
  const fullName = (args.fullName ?? "").trim();
  const phone = (args.phone ?? "").trim();
  const password = args.password;
  const marketingConsent = args.marketingConsent === true;
  const termsAccepted = args.termsAccepted === true;

  if (!email || !password) return { success: false, error: "יש למלא אימייל וסיסמה." };
  if (args.mode === "register") {
    if (!fullName) return { success: false, error: "יש למלא שם." };
    if (!phone) return { success: false, error: "יש למלא טלפון נייד." };
    if (password.length < 8) return { success: false, error: "הסיסמה חייבת לפחות 8 תווים." };
    if (!termsAccepted) return { success: false, error: "יש לאשר את תנאי השימוש." };
  }

  const admin = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  // §6 — "submit form" Lead, fired on submit (before the account exists), deduped
  // with the browser Pixel Lead via the shared event_id. Never blocks signup.
  if (args.mode === "register" && args.leadEventId) {
    try { await firePollLeadCapi({ email, phone, eventId: args.leadEventId }); } catch { /* never blocks */ }
  }

  try {
    if (args.mode === "register") {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone, language: "he" },
      });
      if (createErr) {
        const msg = createErr.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered")) {
          return { success: false, error: "כבר קיים חשבון עם המייל הזה. אפשר להתחבר." };
        }
        return { success: false, error: createErr.message };
      }
      const userId = created.user.id;

      await admin.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName,
          phone: phone || null,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? nowIso : null,
          marketing_consent_source: "poll_signup",
        },
        { onConflict: "id" },
      );
      // terms columns in a separate best-effort write (mirrors journeyInlineSignup).
      await admin.from("profiles").update({ terms_accepted: termsAccepted, terms_accepted_at: termsAccepted ? nowIso : null }).eq("id", userId);
    }

    // ── Sign in (both modes) → session cookie ────────────────────────────────
    const supabase = await createServerSupabaseClient();
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.session) {
      return { success: false, error: signInErr?.message ?? "ההתחברות נכשלה." };
    }
    const userId = signIn.session.user.id;

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

    // ── Link the anon's saved votes to the user (§7 — votes always kept) ─────
    const anonId = await readPollAnonId();
    if (anonId) {
      await admin.from("poll_votes").update({ user_id: userId }).eq("anon_id", anonId).is("user_id", null);
    }

    // ── Subscribe to the daily poll by default (§6) ──────────────────────────
    await admin.from("poll_subscriptions").upsert(
      { user_id: userId, subscribed: true, updated_at: nowIso },
      { onConflict: "user_id" },
    );

    let capiEventId: string | null = null;
    if (args.mode === "register") {
      // Brevo tag (consent-gated, never blocks). Existing helper.
      if (marketingConsent && !(await isTestUser(admin, userId))) {
        try { await tagAsRegistered(email, userId, "he"); } catch { /* never blocks signup */ }
      }
      // §9א — the primary conversion. Deterministic event id → browser Pixel dedup.
      capiEventId = metaEventId.registration(userId);
      await fireCompleteRegistrationCapi({ userId, email, phone, contentName: "relationship_survey" });
    }

    return { success: true, userId, capiEventId };
  } catch (err) {
    console.error("[pollSignup] unhandled", err);
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהרשמה." };
  }
}
