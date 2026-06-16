"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { signupAction } from "@/app/actions/auth-actions";
import { track } from "@/lib/analytics";
import { AuthField, AuthSubmitButton } from "@/components/ui/auth-field";
import { ConsentCheckbox } from "@/components/auth/ConsentCheckbox";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

// ── Bilingual strings ────────────────────────────────────────────────────────
// Inline rather than next-intl because this modal renders mid-game and the
// rest of the modal's strings have lived here historically. Consent copy
// matches the wording in messages/{he,en}.json so users get the same
// language as the standalone /auth/signup page.
const T = {
  he: {
    headline:       "רגע לפני שמתחילים 🎲",
    sub:            "פתחו חשבון חינמי כדי לשמור את ההתקדמות שלכם",
    fullName:       "שם מלא",
    mobile:         "טלפון נייד",
    email:          "אימייל",
    password:       "סיסמה",
    close:          "עכשיו לא",
    register:       "בואו נשחק ←",
    confirmEmail:   "בדקו את האימייל לאישור החשבון, ולאחר מכן התחברו.",
    registerFailed: "ההרשמה נכשלה",
    consentLabel:   "אני מסכים/ה לקבל עדכונים, טיפים ותכנים חדשים במייל",
    consentHint:    "ניתן לבטל בכל עת",
    rateLimit:      "הגבלת שליחת מיילים - נסו שוב בעוד מספר דקות.",
    phoneRequired:  "נא להזין מספר טלפון נייד",
  },
  en: {
    headline:       "One sec before we play 🎲",
    sub:            "Create a free account to save your progress",
    fullName:       "Full name",
    mobile:         "Mobile",
    email:          "Email",
    password:       "Password",
    close:          "Maybe later",
    register:       "Let's play →",
    confirmEmail:   "Check your email to confirm your account, then sign in.",
    registerFailed: "Registration failed",
    consentLabel:   "I agree to receive updates, tips and new content by email",
    consentHint:    "You can unsubscribe at any time",
    rateLimit:      "Email rate limit reached - please try again in a few minutes.",
    phoneRequired:  "Please enter a mobile number",
  },
} as const;

// ── Main component ────────────────────────────────────────────────────────────
export function RegistrationModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const locale = useLocale() as "he" | "en";
  const t = T[locale] ?? T.en;
  const isHe = locale === "he";

  const [fullName, setFullName] = useState("");
  const [mobile,   setMobile]   = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (open) track("registration_started", { source: "game_lobby" });
  }, [open]);

  async function submit() {
    setError(null);
    // QA 2026-06-16 — mobile number is required to play. The modal submits via
    // onClick (not a native form), so enforce it here on both platforms.
    if (!mobile.trim()) {
      setError(t.phoneRequired);
      return;
    }
    setBusy(true);
    try {
      // Previously called supabase.auth.signUp() directly. Step C1
      // consolidates onto the single canonical signupAction so consent
      // capture, Brevo sync, and session-cookie handling all go through
      // one code path. The modal's "mobile" UI field maps to FormData
      // `phone` (same `profiles.phone` column either way).
      const fd = new FormData();
      fd.set("fullName", fullName.trim());
      fd.set("email",    email.trim());
      fd.set("phone",    mobile.trim());
      fd.set("password", password);
      fd.set("marketing_consent", marketingConsent ? "true" : "false");
      fd.set("preferred_language", locale === "en" ? "en" : "he");
      fd.set("source", "registration_modal");

      const result = await signupAction(fd);

      if (!result.success) {
        const msg = result.error ?? t.registerFailed;
        const isRateLimit = /rate.?limit|too many/i.test(msg);
        setError(isRateLimit ? t.rateLimit : msg);
        return;
      }

      track("registration_completed", { source: "game_lobby" });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || t.registerFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isHe ? "rtl" : "ltr"}
        className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-md"
      >
        {/* Dark game-style card with accent bar + frosted-glass body */}
        <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-stone-900 ring-1 ring-white/10">
          {/* Top accent bar */}
          <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-amber-400 via-rose-400 to-fuchsia-500" />

          <div className="flex flex-col gap-5 p-6">
            {/* Header — QA 2026-06-16: larger title + subtitle on mobile. */}
            <div>
              <h2 className="text-[24px] font-bold text-amber-50 sm:text-xl">{t.headline}</h2>
              <p className="mt-1 text-[16px] text-white/50 sm:text-sm">{t.sub}</p>
            </div>

            {/* Fields - AuthField tokens. QA 2026-06-16: `emphasis` bumps the
                mobile labels to 18px (desktop unchanged); the mobile/phone
                field is now REQUIRED (both platforms) — needed to play. */}
            <div className="space-y-4">
              <AuthField id="reg_fullname" label={t.fullName} value={fullName} onChange={setFullName} autoComplete="name" required emphasis />
              <AuthField id="reg_mobile"   label={t.mobile}   value={mobile}   onChange={setMobile}   autoComplete="tel" required emphasis />
              <AuthField id="reg_email"    label={t.email}    type="email" value={email} onChange={setEmail} autoComplete="email" required emphasis />
              <AuthField id="reg_password" label={t.password} type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={8} emphasis />
            </div>

            <ConsentCheckbox
              id="reg_marketing_consent"
              checked={marketingConsent}
              onChange={setMarketingConsent}
              label={t.consentLabel}
              dir={isHe ? "rtl" : "ltr"}
            />

            {error && (
              <p className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300">{error}</p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <AuthSubmitButton
                type="button"
                loading={busy}
                label={t.register}
                loadingLabel={isHe ? "שניה…" : "Hold on…"}
                onClick={() => void submit()}
              />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-2xl py-2 text-[16px] text-white/40 transition hover:text-white/70 sm:text-sm"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
