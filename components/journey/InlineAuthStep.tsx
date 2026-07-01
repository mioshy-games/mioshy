"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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

// ── Light-theme tokens (docs/signup-light-mockup-approved.html) ──────────────
const GRAD = "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";
const SANS = "var(--font-assistant), sans-serif";
const SERIF = "var(--font-frank-ruhl), serif";

interface InlineAuthStepProps {
  locale: Locale;
  deviceId: string;
  onAuthenticated: () => void;
}

/**
 * Inline registration / login — shown after 100% questionnaire completion.
 *
 * 2026-07-01 light-theme redesign (docs/signup-light-mockup-approved.html):
 * the form is rendered LOCALLY in the light palette instead of the shared
 * dark AuthField/AuthCard/AuthSubmitButton primitives (those stay dark for
 * /auth, RegistrationModal and the intimacy/friendship signup, so they must
 * not be restyled). All logic is unchanged: state, draft persistence, the
 * journeyInlineSignup action, both consent checkboxes, mode toggle, tracking,
 * and the CMS-managed copy.
 *
 * Heading + the two trust chips use message-only keys (headingLight /
 * chipResults / chipSecure) so the emoji-free copy in the mockup renders
 * without depending on a CMS migration; sub/labels/errors keep their existing
 * CMS keys.
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
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveDraft({ fullName, email, phone });
  }, [fullName, email, phone]);

  // String-prop consumers — field labels/placeholders, button labels, and the
  // error-state strings set imperatively in the submit handler.
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

  const submitDisabled = busy || (mode === "register" && !termsAccepted);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      dir={isHe ? "rtl" : "ltr"}
      className="w-full max-w-[720px]"
      style={{ fontFamily: SANS }}
    >
      {/* Heading + sub + chips — centered, wide so the sub fits one desktop
          line while the card below stays narrow. */}
      <div className="text-center">
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.headingLight"
          as="h1"
          className="text-[34px] font-black leading-tight text-[#2E2622]"
          style={{ fontFamily: SERIF }}
        />
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.sub"
          as="p"
          className="mx-auto mt-3 max-w-[680px] text-[22px] font-medium leading-normal text-[#161210]"
        />

        <div className="mt-5 flex flex-wrap justify-center gap-5">
          <span className="inline-flex items-center gap-[7px] text-[15px] font-medium text-[#7B6B5E]">
            <ChipIconResults />
            <CmsText cmsKey="journeyAssessment.inlineAuth.chipResults" />
          </span>
          <span className="inline-flex items-center gap-[7px] text-[15px] font-medium text-[#7B6B5E]">
            <ChipIconSecure />
            <CmsText cmsKey="journeyAssessment.inlineAuth.chipSecure" />
          </span>
        </div>
      </div>

      {/* White form card — narrow, soft shadow (mockup). */}
      <div className="mx-auto mt-6 max-w-[460px] rounded-[22px] border border-[#ece2d4] bg-white p-6 text-start shadow-[0_24px_60px_-30px_rgba(80,50,35,0.35)]">
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <LightField
                id="inline_full_name"
                label={fullNameLabel}
                type="text"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required
                isHe={isHe}
              />
              <LightField
                id="inline_phone"
                label={phoneLabel}
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                required
                isHe={isHe}
              />
            </>
          )}

          <LightField
            id="inline_email"
            label={emailLabel}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
            isHe={isHe}
          />

          <LightField
            id="inline_password"
            label={passwordLabel}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={passwordPlaceholder}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={8}
            isHe={isHe}
          />

          {mode === "register" && (
            <div className="mt-1 space-y-3">
              {/* Terms — REQUIRED (gates the submit button). Links are the
                  locale-aware @/navigation Link so they resolve to
                  /he/terms · /he/privacy (or /en/...) in the same tab. */}
              <label className="flex items-start gap-2.5 text-[14px] leading-normal text-[#5a5049]">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#D6409F]"
                  style={{ accentColor: "#D6409F" }}
                />
                <span>
                  {termsPrefix}
                  <Link
                    href="/terms"
                    className="font-bold text-[#7A1F2B] underline underline-offset-2"
                  >
                    {termsLink}
                  </Link>
                  {termsAnd}
                  <Link
                    href="/privacy"
                    className="font-bold text-[#7A1F2B] underline underline-offset-2"
                  >
                    {privacyLink}
                  </Link>
                  {termsSuffix}
                </span>
              </label>

              {/* Marketing — default ON, optional (never blocks submit). */}
              <label className="flex items-start gap-2.5 text-[14px] leading-normal text-[#5a5049]">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#D6409F]"
                  style={{ accentColor: "#D6409F" }}
                />
                <CmsText cmsKey="journeyAssessment.inlineAuth.marketingConsent" as="span" />
              </label>
            </div>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-700"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="mt-[22px] flex h-[56px] w-full items-center justify-center rounded-[15px] text-[19px] font-extrabold text-white shadow-[0_16px_34px_-12px_rgba(150,60,150,0.5)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: GRAD, fontFamily: SANS }}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {loadingLabel}
              </span>
            ) : mode === "register" ? (
              submitRegisterLabel
            ) : (
              submitLoginLabel
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "register" ? "login" : "register"))}
          className="mt-4 block w-full text-center text-[14px] font-bold text-[#7A1F2B] underline-offset-2 transition hover:underline"
        >
          <CmsText
            cmsKey={
              mode === "register"
                ? "journeyAssessment.inlineAuth.switchToLogin"
                : "journeyAssessment.inlineAuth.switchToRegister"
            }
          />
        </button>
      </div>
    </motion.div>
  );
}

// ── Local light form field with password eye-toggle (mockup palette) ─────────
function LightField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  autoComplete,
  required,
  minLength,
  isHe,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  isHe: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPw ? "text" : "password") : type;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-[7px] block text-[15px] font-extrabold text-[#2E2622]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="h-[52px] w-full rounded-[13px] border-[1.5px] border-[#ece2d4] bg-[#fdfbf8] px-[15px] text-[17px] text-[#2E2622] outline-none transition placeholder:text-[#b7a99b] focus:border-[#D6409F] focus:shadow-[0_0_0_3px_rgba(214,64,159,0.12)]"
          style={isPassword ? { paddingInlineEnd: "3rem" } : undefined}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? (isHe ? "הסתר סיסמה" : "Hide password") : isHe ? "הצג סיסמה" : "Show password"}
            className="absolute inset-y-0 end-3.5 flex items-center text-[#7B6B5E] transition hover:text-[#2E2622]"
          >
            {showPw ? (
              <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Trust-chip icons (line icons, burgundy stroke — from the mockup) ─────────
function ChipIconResults() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="#7A1F2B" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function ChipIconSecure() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="#7A1F2B" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
