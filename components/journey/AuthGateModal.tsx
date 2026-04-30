"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/journey/types";

interface AuthGateModalProps {
  open: boolean;
  locale: Locale;
  deviceId: string;
  onAuthenticated: () => void;
  onClose?: () => void;
}

/**
 * Register/Login modal shown after Q3.
 * After success it calls POST /api/journey/resume with the device_id so
 * the anonymous journey row is linked to the new user, then invokes
 * onAuthenticated() which advances the parent flow.
 */
export function AuthGateModal({ open, locale, deviceId, onAuthenticated, onClose }: AuthGateModalProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserSupabaseClient();

  const t = locale === "he"
    ? {
        title: "שמרו את ההתקדמות שלכם",
        body: "כדי להמשיך - צריך חשבון קטן. שלוש שאלות נשמרו כבר, לא תאבדו כלום.",
        fullName: "שם מלא",
        email: "אימייל",
        phone: "טלפון",
        password: "סיסמה",
        submitRegister: "הרשמה וההמשך",
        submitLogin: "התחברות וההמשך",
        switchToLogin: "כבר יש לי חשבון",
        switchToRegister: "אני חדש/ה כאן",
        err: "משהו השתבש. נסו שוב.",
      }
    : {
        title: "Save your progress",
        body: "To continue we need a quick account. Your first 3 answers are safe - you won't lose anything.",
        fullName: "Full name",
        email: "Email",
        phone: "Phone",
        password: "Password",
        submitRegister: "Register & continue",
        submitLogin: "Log in & continue",
        switchToLogin: "I already have an account",
        switchToRegister: "I'm new here",
        err: "Something went wrong. Please try again.",
      };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              phone: form.phone,
              language: locale,
            },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      }

      // Link the anonymous journey to the freshly authenticated user.
      await fetch("/api/journey/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });

      onAuthenticated();
    } catch (err) {
      const message = err instanceof Error ? err.message : t.err;
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent dir={locale === "he" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.body}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" ? (
            <>
              <div>
                <Label htmlFor="full_name">{t.fullName}</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">{t.phone}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
            </>
          ) : null}
          <div>
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">{t.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "…" : mode === "register" ? t.submitRegister : t.submitLogin}
          </Button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "register" ? "login" : "register"))}
            className="text-sm text-white/70 underline underline-offset-4"
          >
            {mode === "register" ? t.switchToLogin : t.switchToRegister}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
