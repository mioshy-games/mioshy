"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import type { Locale } from "@/lib/assessments/types";
import { assessmentInlineSignup } from "@/app/actions/assessment-inline-signup";

interface Props {
  locale: Locale;
  deviceId: string;
  assessmentId: string;
  onAuthenticated: () => void;
}

/**
 * Registration / login shown after the user finishes all questions, before
 * the result. Uses the same AuthField/AuthCard tokens as the Journey flow but
 * calls the dedicated assessment signup action (which claims the assessment
 * session, never journeys). Copy is inline Hebrew/English for v1.
 */
export function AssessmentInlineAuthStep({ locale, deviceId, assessmentId, onAuthenticated }: Props) {
  const isHe = locale === "he";
  const [mode, setMode] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = (he: string, en: string) => (isHe ? he : en);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await assessmentInlineSignup({
        email,
        password,
        fullName,
        phone,
        language: locale,
        deviceId,
        assessmentId,
        mode,
      });
      if (!result.success) throw new Error(result.error);
      onAuthenticated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isAlready = /already.?registered|already.?exists|user.?already/i.test(msg);
      setError(
        isAlready
          ? t("כבר קיים חשבון עם המייל הזה. עברו להתחברות.", "An account with this email already exists. Switch to login.")
          : msg || t("משהו השתבש. נסו שוב.", "Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      dir={isHe ? "rtl" : "ltr"}
      className="flex w-full max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-bold text-white md:text-3xl">
          {t("סיימתם! התוצאות מוכנות 🎉", "Done! Your results are ready 🎉")}
        </h2>
        <p className="max-w-md text-sm text-white/60">
          {t(
            "השאירו פרטים כדי לראות את האבחון האישי שלכם ולקבל את ההמלצות.",
            "Leave your details to see your personal results and recommendations.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {[
          t("חינמי לחלוטין", "Completely free"),
          t("התוצאות נשמרות עבורכם", "Your results are saved"),
        ].map((b) => (
          <span
            key={b}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60"
          >
            {b}
          </span>
        ))}
      </div>

      <AuthCard>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <AuthField
                id="assess_full_name"
                label={t("שם מלא", "Full name")}
                type="text"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required
              />
              <AuthField
                id="assess_phone"
                label={t("טלפון", "Phone")}
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                required
              />
            </>
          )}

          <AuthField
            id="assess_email"
            label={t("אימייל", "Email")}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <AuthField
            id="assess_password"
            label={t("סיסמה", "Password")}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={t("לפחות 8 תווים", "At least 8 characters")}
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
            label={mode === "register" ? t("הצגת התוצאות", "Show my results") : t("התחברות", "Log in")}
            loadingLabel={t("רגע...", "One moment...")}
          />
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "register" ? "login" : "register"))}
          className="mt-4 w-full text-center text-sm text-white/40 underline underline-offset-4 transition hover:text-white/70"
        >
          {mode === "register"
            ? t("כבר יש לכם חשבון? התחברו", "Already have an account? Log in")
            : t("אין לכם חשבון? הירשמו", "No account? Sign up")}
        </button>
      </AuthCard>
    </motion.div>
  );
}
