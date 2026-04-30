"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import type { Locale } from "@/lib/journey/types";
import { track } from "@/lib/analytics";
import { journeyInlineSignup } from "@/app/actions/journey-inline-signup";

interface InlineAuthStepProps {
  locale: Locale;
  deviceId: string;
  onAuthenticated: () => void;
}

/**
 * Inline registration / login - shown after 100% questionnaire completion.
 * Uses the same AuthField / AuthSubmitButton / AuthCard tokens as /auth pages.
 */
export function InlineAuthStep({ locale, deviceId, onAuthenticated }: InlineAuthStepProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const isHe = locale === "he";

  const t = isHe
    ? {
        heading: "סיימתם את השאלון! 🎉",
        sub: "הניתוח האישי שלכם מוכן - צרו חשבון חינמי כדי לקבל אותו.",
        fullName: "שם מלא",
        email: "אימייל",
        phone: "טלפון",
        password: "סיסמה",
        passwordPlaceholder: "לפחות 8 תווים",
        submitRegister: "קבלו את הניתוח האישי שלכם ←",
        submitLogin: "התחברות וצפייה בניתוח ←",
        switchToLogin: "כבר יש לי חשבון - כניסה",
        switchToRegister: "אני חדש/ה כאן - הרשמה",
        errDefault: "משהו השתבש. נסו שוב.",
        badges: ["🔒 מוגן לחלוטין", "ניתוח אישי תוך שניות", "ניתן לביטול בכל עת"],
      }
    : {
        heading: "You finished the questionnaire! 🎉",
        sub: "Your personal analysis is ready - create a free account to unlock it.",
        fullName: "Full name",
        email: "Email",
        phone: "Phone",
        password: "Password",
        passwordPlaceholder: "At least 8 characters",
        submitRegister: "Get my personal analysis →",
        submitLogin: "Log in & view analysis →",
        switchToLogin: "I already have an account",
        switchToRegister: "I'm new here",
        errDefault: "Something went wrong. Please try again.",
        badges: ["🔒 100% private", "Analysis in seconds", "Cancel anytime"],
      };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      console.log("[InlineAuthStep] submit", { mode, deviceId });

      // One server-side call does it all atomically:
      //   • admin.createUser({email_confirm:true})  — no email, no rate limit
      //   • signInWithPassword                      — sets the auth cookie
      //   • createSession + writeSessionCookie      — single-session record
      //   • link_journey_to_user RPC                — links anon → user
      //   • returns the linked journey row          — client jumps straight in
      const result = await journeyInlineSignup({
        email,
        password,
        fullName,
        phone,
        language: locale,
        deviceId,
        mode,
      });

      // Log the FULL server-side debug envelope to the browser console so
      // we never have to switch terminals. Includes the pre-RPC anon
      // journey state, the RPC result + any error, the fallback's
      // result, and the post-link journey row resolved for this user.
      console.log("[InlineAuthStep] journeyInlineSignup returned", {
        success: result.success,
        ...(result.success
          ? {
              userId: result.userId,
              journey: result.journey,
              debug: result.debug,
            }
          : { error: result.error, debug: result.debug }),
      });
      if (!result.success) {
        // Throwing pushes us into the existing catch block which already
        // surfaces the message into the rose error UI.
        throw new Error(result.error);
      }

      track("registration_completed", { source: "journey_inline", mode });
      console.log("[InlineAuthStep] calling onAuthenticated() → page reload");
      onAuthenticated();
    } catch (err) {
      // Log the FULL error envelope so we can see what Supabase is
      // actually returning (status, code, message, name, plus the full
      // object if it's a SupabaseAuthError). This is what was missing —
      // the previous code only surfaced the .message string.
      console.error("[InlineAuthStep] submit failed", {
        mode,
        email,
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        // SupabaseAuthError carries .status and .code — log them explicitly.
        errorStatus: (err as { status?: number })?.status,
        errorCode: (err as { code?: string })?.code,
        rawError: err,
      });
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit = /rate.?limit|too many/i.test(msg);
      const isAlreadyRegistered =
        /already.?registered|already.?exists|user.?already/i.test(msg);
      setError(
        isRateLimit
          ? isHe
            ? "הגבלת שליחת מיילים - נסו שוב בעוד מספר דקות."
            : "Email rate limit reached - please try again in a few minutes."
          : isAlreadyRegistered
            ? isHe
              ? "המייל הזה כבר רשום במערכת. עברו ל'יש לי כבר חשבון' למטה ↓"
              : "This email is already registered. Switch to 'I already have an account' below ↓"
            : msg || t.errDefault
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      dir={isHe ? "rtl" : "ltr"}
      className="flex w-full max-w-2xl flex-col gap-6"
    >
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white">{t.heading}</h2>
        <p className="text-sm text-white/60">{t.sub}</p>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap gap-2">
        {t.badges.map((b) => (
          <span
            key={b}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60"
          >
            {b}
          </span>
        ))}
      </div>

      {/* Form card - same token as /auth pages */}
      <AuthCard>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <AuthField
                id="inline_full_name"
                label={t.fullName}
                type="text"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required
              />
              <AuthField
                id="inline_phone"
                label={t.phone}
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                optional
              />
            </>
          )}

          <AuthField
            id="inline_email"
            label={t.email}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <AuthField
            id="inline_password"
            label={t.password}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={t.passwordPlaceholder}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={8}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <AuthSubmitButton
            loading={busy}
            label={mode === "register" ? t.submitRegister : t.submitLogin}
            loadingLabel={isHe ? "שניה…" : "Hold on…"}
          />
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "register" ? "login" : "register"))}
          className="mt-4 w-full text-center text-sm text-white/40 underline underline-offset-4 transition hover:text-white/70"
        >
          {mode === "register" ? t.switchToLogin : t.switchToRegister}
        </button>
      </AuthCard>
    </motion.div>
  );
}
