"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import type { Locale } from "@/lib/journey/types";
import { track } from "@/lib/analytics";
import { journeyInlineSignup } from "@/app/actions/journey-inline-signup";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";
import { Link } from "@/navigation";

// 2026-05-29 — Itzik bug report: user clicked browser-back from the
// inline-auth gate, then forward again, and the form was empty. They
// had to re-type fullName/email/phone. Persist non-secret fields in
// localStorage for 7 days so back/forward (or even closing the tab
// and coming back the next day) keeps the data filled. Password is
// NEVER persisted; the user re-enters it on every visit. Cleared on
// successful submit so the next visitor on a shared device doesn't
// see someone else's details.
const STORAGE_KEY = "mioshy.inlineAuth.draft.v1";
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
interface DraftShape {
  fullName: string;
  email: string;
  phone: string;
  savedAt: number;
}
function loadDraft(): DraftShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftShape;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function saveDraft(d: Omit<DraftShape, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...d, savedAt: Date.now() }),
    );
  } catch {
    // localStorage can throw in private mode or when full — best-effort.
  }
}
function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

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
  // Consent checkboxes (register only). Terms is REQUIRED (gates submit);
  // marketing defaults ON and never blocks submit.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  // Skip the auto-save effect on the very first render (right after
  // hydration) so we don't immediately overwrite a draft with the
  // empty initial state. After hydrate, this flag flips to true.
  const hydratedRef = useRef(false);

  const isHe = locale === "he";

  // ── Draft hydration (Itzik 2026-05-29) ──────────────────────────────
  // Read once on mount. If a recent draft exists, fill the fields so the
  // user doesn't have to retype after browser back/forward.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.fullName) setFullName(draft.fullName);
      if (draft.email) setEmail(draft.email);
      if (draft.phone) setPhone(draft.phone);
    }
    hydratedRef.current = true;
  }, []);

  // ── Auto-save draft as the user types ───────────────────────────────
  // Runs after every change to a persisted field. We don't debounce
  // because localStorage writes are cheap (microseconds) and the user
  // typing rate is low — no benefit. We DO skip the first render so
  // we don't blank an existing draft with empty initial state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveDraft({ fullName, email, phone });
  }, [fullName, email, phone]);

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
  // Consent copy. The terms line interleaves two locale-aware links, so its
  // fragments are read as raw strings (useCmsText().text) to preserve the
  // exact leading/trailing spaces around the links — CmsText's plain renderer
  // trims outer whitespace, which would swallow them.
  const termsPrefix = useCmsText("journeyAssessment.inlineAuth.termsPrefix").text;
  const termsLink = useCmsText("journeyAssessment.inlineAuth.termsLink").text;
  const termsAnd = useCmsText("journeyAssessment.inlineAuth.termsAnd").text;
  const privacyLink = useCmsText("journeyAssessment.inlineAuth.privacyLink").text;
  const termsSuffix = useCmsText("journeyAssessment.inlineAuth.termsSuffix").text;

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
        termsAccepted,
        marketingConsent,
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
      // Successful signup/login — clear the draft so a future user
      // on the same device doesn't see these details prefilled.
      clearDraft();
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
      {/* Heading - centered per Itzik 2026-06-02. */}
      <div className="flex flex-col items-center gap-2 text-center">
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.heading"
          as="h2"
          className="text-2xl font-bold text-white md:text-3xl"
        />
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.sub"
          as="p"
          className="max-w-md text-sm text-white/60"
        />
      </div>

      {/* Trust badges - centered. Badge3 ("ניתן לביטול בכל עת") still
          omitted from the render; CMS keys kept on disk for re-enable. */}
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2].map((n) => (
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
                required
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

          {mode === "register" && (
            <div className="space-y-2.5">
              {/* Terms — REQUIRED. Gates submit (button disabled until checked),
                  not marked with a visual asterisk per spec. Links are the
                  locale-aware @/navigation Link so they resolve to
                  /he/terms · /he/privacy (or /en/...) in the same tab. */}
              <label className="flex items-start gap-2.5 text-sm leading-snug text-white/70">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500"
                />
                <span>
                  {termsPrefix}
                  <Link
                    href="/terms"
                    className="font-medium text-fuchsia-300 underline underline-offset-4 hover:text-white"
                  >
                    {termsLink}
                  </Link>
                  {termsAnd}
                  <Link
                    href="/privacy"
                    className="font-medium text-fuchsia-300 underline underline-offset-4 hover:text-white"
                  >
                    {privacyLink}
                  </Link>
                  {termsSuffix}
                </span>
              </label>

              {/* Marketing — default ON, optional (never blocks submit). */}
              <label className="flex items-start gap-2.5 text-sm leading-snug text-white/70">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500"
                />
                <CmsText
                  cmsKey="journeyAssessment.inlineAuth.marketingConsent"
                  as="span"
                />
              </label>
            </div>
          )}

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
            disabled={mode === "register" && !termsAccepted}
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
