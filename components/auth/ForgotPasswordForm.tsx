"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { motion } from "framer-motion";
import { AuthCard, AuthField, AuthSubmitButton } from "@/components/ui/auth-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * ForgotPasswordForm — Itzik 2026-05-07.
 *
 * Single email input. On submit, calls Supabase
 * `auth.resetPasswordForEmail` with a redirect back to the locale-
 * appropriate /auth page. Supabase emails the user a one-time link;
 * clicking it logs them in, after which they can update their
 * password from /account/security.
 *
 * Success state: render a calm "we sent the link" confirmation in
 * place of the form so the user knows the next step is "check your
 * inbox", not "click again".
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      // Locale-aware redirect — pull the prefix off the current path.
      const localePrefix =
        typeof window !== "undefined"
          ? (window.location.pathname.match(/^\/(he|en)(\/|$)/)?.[0] ?? "/he")
          : "/he";
      const redirectTo = `${window.location.origin}${localePrefix.replace(/\/$/, "")}/auth`;
      const { error: rpfeErr } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (rpfeErr) throw rpfeErr;
      setSent(true);
    } catch (err) {
      console.error("[ForgotPasswordForm] reset failed", err);
      setError(
        (err as { message?: string })?.message ??
          "Could not send reset email — try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mioshy-white.svg"
          alt="Mioshy"
          width={171}
          height={81}
          className="h-14 w-auto drop-shadow-lg sm:h-16"
        />
      </div>

      <AuthCard>
        <h1 className="text-2xl font-bold text-white">{t("forgotTitle")}</h1>
        <p className="mt-1 text-[15px] text-white/85">
          {t("forgotSubtitle")}
        </p>

        {sent ? (
          <p
            role="status"
            className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-4 text-[15px] leading-[1.55] text-emerald-100"
          >
            {t("forgotSent")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AuthField
              id="forgot_email"
              label={t("emailLabel")}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
              placeholder={t("forgotEmailPlaceholder")}
            />

            {error ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300"
              >
                {error}
              </motion.p>
            ) : null}

            <AuthSubmitButton
              loading={busy}
              label={t("forgotSubmit")}
              loadingLabel="…"
            />
          </form>
        )}

        <div className="mt-5 text-center text-[15px] text-white/85">
          <Link
            href="/auth"
            className="font-medium text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200"
          >
            {t("forgotBackToLogin")}
          </Link>
        </div>
      </AuthCard>
    </motion.div>
  );
}
