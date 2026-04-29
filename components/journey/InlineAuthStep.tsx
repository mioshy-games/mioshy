"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import type { Locale } from "@/lib/journey/types";
import { track } from "@/lib/analytics";

interface InlineAuthStepProps {
  locale: Locale;
  deviceId: string;
  onAuthenticated: () => void;
}

/**
 * Inline registration / login — shown after 100% questionnaire completion.
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

  const supabase = createBrowserSupabaseClient();
  const isHe = locale === "he";

  const t = isHe
    ? {
        heading: "סיימתם את השאלון! 🎉",
        sub: "הניתוח האישי שלכם מוכן — צרו חשבון חינמי כדי לקבל אותו.",
        fullName: "שם מלא",
        email: "אימייל",
        phone: "טלפון",
        password: "סיסמה",
        passwordPlaceholder: "לפחות 8 תווים",
        submitRegister: "קבלו את הניתוח האישי שלכם ←",
        submitLogin: "התחברות וצפייה בניתוח ←",
        switchToLogin: "כבר יש לי חשבון — כניסה",
        switchToRegister: "אני חדש/ה כאן — הרשמה",
        errDefault: "משהו השתבש. נסו שוב.",
        badges: ["🔒 מוגן לחלוטין", "ניתוח אישי תוך שניות", "ניתן לביטול בכל עת"],
      }
    : {
        heading: "You finished the questionnaire! 🎉",
        sub: "Your personal analysis is ready — create a free account to unlock it.",
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
      if (mode === "register") {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              language: locale,
            },
          },
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) throw loginErr;
      }

      // Link the anonymous journey to the freshly authenticated user.
      await fetch("/api/journey/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });

      track("registration_completed", { source: "journey_inline", mode });
      onAuthenticated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit = /rate.?limit|too many/i.test(msg);
      setError(
        isRateLimit
          ? isHe
            ? "הגבלת שליחת מיילים — נסו שוב בעוד מספר דקות."
            : "Email rate limit reached — please try again in a few minutes."
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

      {/* Form card — same token as /auth pages */}
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
