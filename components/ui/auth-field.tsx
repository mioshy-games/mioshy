"use client";

/**
 * Shared form primitives - AuthField + AuthSubmitButton
 *
 * Design token (from /auth login & signup pages):
 *   Label  → text-xs font-semibold uppercase tracking-widest text-white/40
 *   Input  → rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white
 *             placeholder:text-white/25 focus:border-fuchsia-400/60 focus:ring-fuchsia-400/20
 *   Button → rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 py-3.5 font-bold
 *
 * Usage:
 *   import { AuthField, AuthSubmitButton } from "@/components/ui/auth-field";
 *
 *   <AuthField id="email" label="אימייל" type="email" value={email} onChange={setEmail} />
 *   <AuthSubmitButton loading={busy} label="כניסה" loadingLabel="שניה…" />
 */

import { useState } from "react";

// ─── AuthField ────────────────────────────────────────────────────────────────

interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  autoComplete,
  required,
  minLength,
}: AuthFieldProps) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType  = isPassword ? (showPw ? "text" : "password") : type;

  return (
    <div>
      {/* Label sizing — mobile reads 15px (a touch larger so it feels
          confident under a thumb), desktop steps down to 14px since
          the field already has more horizontal weight there.

          2026-06-02 (Itzik): the auto-injected "(אופציונלי)" suffix
          dropped. It collided with i18n strings that already carried
          the same word and the result was duplicated. The `optional`
          prop is kept (callers still use it to flip `required` off
          on the input) but no longer renders text. */}
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[15px] font-semibold tracking-wide text-white sm:text-[14px]"
      >
        {label}
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          // Mobile-first sizing — 17px text prevents iOS Safari from
          // zooming on focus, 56px tap target (rounded thumb-friendly
          // height), 18px horizontal padding for breathing room. Desktop
          // scales back to 16px / 50px / 16px so the form doesn't feel
          // oversized on a 1440px monitor.
          className="w-full rounded-[18px] border border-white/15 bg-white/5 px-[18px] py-4 text-[17px] text-white placeholder:text-white/25 transition focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-[16px]"
          style={isPassword ? { paddingRight: "3rem" } : undefined}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((v) => !v)}
            className="absolute inset-y-0 right-4 flex items-center text-white/40 transition hover:text-white/80"
            aria-label={showPw ? "הסתר סיסמה" : "הצג סיסמה"}
          >
            {showPw ? (
              <svg className="h-[22px] w-[22px] sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-[22px] w-[22px] sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

// ─── AuthSubmitButton ─────────────────────────────────────────────────────────

interface AuthSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  onClick?: () => void;
  type?: "submit" | "button";
}

export function AuthSubmitButton({
  loading,
  label,
  loadingLabel = "שניה…",
  onClick,
  type = "submit",
}: AuthSubmitButtonProps) {
  return (
    <button
      type={type}
      disabled={loading}
      onClick={onClick}
      // Mobile: 60px tall (py-[18px] + 17px text) so the CTA dominates
      // the bottom of the form like in a native iOS app. Desktop steps
      // back to 54px so it doesn't look comical on a wide screen.
      className="mt-2 w-full rounded-[18px] bg-gradient-to-r from-fuchsia-500 to-rose-500 py-[18px] text-[17px] font-bold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:py-3.5 sm:text-base"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-5 w-5 animate-spin sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

// ─── AuthCard ─────────────────────────────────────────────────────────────────
// The frosted-glass card wrapping the form - consistent across all auth surfaces.

export function AuthCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Itzik 2026-06-02: frame removed (border, background, shadow, blur).
  // The form fields now sit directly on the page background, consistent
  // across InlineAuthStep / LoginForm / SignupForm / ForgotPasswordForm.
  // Padding kept so the form has breathing room from screen edges on
  // small viewports.
  return (
    <div className={`p-2 sm:p-4 ${className}`}>{children}</div>
  );
}
