"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import type { Locale } from "@/lib/journey/types";
import { track } from "@/lib/analytics";
import { journeyInlineSignup } from "@/app/actions/journey-inline-signup";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface InlineAuthStepProps {
  locale: Locale;
  deviceId: string;
  onAuthenticated: () => void;
}

/**
 * Inline registration / login - shown after 100% questionnaire completion.
 * Uses the same AuthField / AuthSubmitButton / AuthCard tokens as /auth pages.
 *
 * Sprint 4 #3 Phase 2A migration — 18 keys under journeyAssessment.inlineAuth.*.
 * AuthField/AuthSubmitButton take label/placeholder/loadingLabel as string
 * props, so those consumers go through useCmsText().text. Heading, sub,
 * switch link, badges, and error message render as DOM children — those
 * use <CmsText> (or set state to a resolved string).
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

  // String-prop consumers — AuthField labels/placeholders, AuthSubmitButton
  // labels, and the error-state strings set imperatively in the submit
  // handler.
  const fullNameLabel = useCmsText("journeyAssessment.inlineAuth.fullName").text;
  const emailLabel = useCmsText("journeyAssessment.inlineAuth.email").text;
  const phoneLabel = useCmsText("journeyAssessment.inlineAuth.phone").text;
  const passwordLabel = useCmsText("journeyAssessment.inlineAuth.password").text;
  const passwordPlaceholder = useCmsText("journeyAssessment.inlineAuth.passwordPlaceholder").text;
  const submitRegisterLabel = useCmsText("journeyAssessment.inlineAuth.submitRegister").text;
  const submitLoginLabel = useCmsText("journeyAssessment.inlineAuth.submitLogin").text;
  const loadingLabel = useCmsText("journeyAssessment.inlineAuth.loadingLabel").text;
  const errDefault = useCmsText("journeyAssessment.inlineAuth.errDefault").text;
  const errRateLimit = useCmsText("journeyAssessment.inlineAuth.errRateLimit").text;
  const errAlreadyRegistered = useCmsText("journeyAssessment.inlineAuth.errAlreadyRegistered").text;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      console.log("[InlineAuthStep] submit", { mode, deviceId });

      const result = await journeyInlineSignup({
        email,
        password,
        fullName,
        phone,
        language: locale,
        deviceId,
        mode,
      });

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
        throw new Error(result.error);
      }

      track("registration_completed", { source: "journey_inline", mode });
      console.log("[InlineAuthStep] calling onAuthenticated() → page reload");
      onAuthenticated();
    } catch (err) {
      console.error("[InlineAuthStep] submit failed", {
        mode,
        email,
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
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
          ? errRateLimit
          : isAlreadyRegistered
            ? errAlreadyRegistered
            : msg || errDefault
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
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.heading"
          as="h2"
          className="text-2xl font-bold text-white"
        />
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.sub"
          as="p"
          className="text-sm text-white/60"
        />
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((n) => (
          <CmsText
            key={n}
            cmsKey={`journeyAssessment.inlineAuth.badge${n}`}
            as="span"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60"
          />
        ))}
      </div>

      {/* Form card - same token as /auth pages */}
      <AuthCard>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <AuthField
                id="inline_full_name"
                label={fullNameLabel}
                type="text"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required
              />
              <AuthField
                id="inline_phone"
                label={phoneLabel}
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
            label={emailLabel}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <AuthField
            id="inline_password"
            label={passwordLabel}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={passwordPlaceholder}
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
            label={mode === "register" ? submitRegisterLabel : submitLoginLabel}
            loadingLabel={loadingLabel}
          />
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "register" ? "login" : "register"))}
          className="mt-4 w-full text-center text-sm text-white/40 underline underline-offset-4 transition hover:text-white/70"
        >
          <CmsText
            cmsKey={
              mode === "register"
                ? "journeyAssessment.inlineAuth.switchToLogin"
                : "journeyAssessment.inlineAuth.switchToRegister"
            }
          />
        </button>
      </AuthCard>
    </motion.div>
  );
}
