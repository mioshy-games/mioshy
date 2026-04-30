"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { AuthField, AuthSubmitButton } from "@/components/ui/auth-field";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

// ── Bilingual strings ────────────────────────────────────────────────────────
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
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (open) track("registration_started", { source: "game_lobby" });
  }, [open]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      if (e) throw e;
      const user = data.user;
      if (!user) { setError(t.confirmEmail); return; }
      if (data.session) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName.trim(), mobile: mobile.trim() })
          .eq("id", user.id);
      }
      track("registration_completed", { source: "game_lobby" });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit = /rate.?limit|too many/i.test(msg);
      setError(
        isRateLimit
          ? isHe
            ? "הגבלת שליחת מיילים - נסו שוב בעוד מספר דקות."
            : "Email rate limit reached - please try again in a few minutes."
          : msg || t.registerFailed
      );
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
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-amber-50">{t.headline}</h2>
              <p className="mt-1 text-sm text-white/50">{t.sub}</p>
            </div>

            {/* Fields - AuthField tokens */}
            <div className="space-y-4">
              <AuthField id="reg_fullname" label={t.fullName} value={fullName} onChange={setFullName} autoComplete="name" required />
              <AuthField id="reg_mobile"   label={t.mobile}   value={mobile}   onChange={setMobile}   autoComplete="tel" optional />
              <AuthField id="reg_email"    label={t.email}    type="email" value={email} onChange={setEmail} autoComplete="email" required />
              <AuthField id="reg_password" label={t.password} type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={8} />
            </div>

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
                className="w-full rounded-2xl py-2 text-sm text-white/40 transition hover:text-white/70"
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
