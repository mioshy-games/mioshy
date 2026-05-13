"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";
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
 *
 * CMS migration (Sprint 4 #3 Phase 2A) — every formerly-inline
 * bilingual string moved to journeyAssessment.authGate.* keys. The
 * DOM consumers render via <CmsText>; the error fallback string
 * (used in a catch block, not the DOM) reads from useCmsText().text.
 */
export function AuthGateModal({
  open,
  locale,
  deviceId,
  onAuthenticated,
  onClose,
}: AuthGateModalProps) {
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

  // Used as a string in the catch block fallback, not for DOM render.
  const errFallback = useCmsText("journeyAssessment.authGate.err").text;

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
      const message = err instanceof Error ? err.message : errFallback;
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent dir={locale === "he" ? "rtl" : "ltr"} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <CmsText cmsKey="journeyAssessment.authGate.title" />
          </DialogTitle>
          <DialogDescription>
            <CmsText cmsKey="journeyAssessment.authGate.body" />
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" ? (
            <>
              <div>
                <Label htmlFor="full_name">
                  <CmsText cmsKey="journeyAssessment.authGate.fullName" />
                </Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">
                  <CmsText cmsKey="journeyAssessment.authGate.phone" />
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  required
                />
              </div>
            </>
          ) : null}
          <div>
            <Label htmlFor="email">
              <CmsText cmsKey="journeyAssessment.authGate.email" />
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="password">
              <CmsText cmsKey="journeyAssessment.authGate.password" />
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              "…"
            ) : (
              <CmsText
                cmsKey={
                  mode === "register"
                    ? "journeyAssessment.authGate.submitRegister"
                    : "journeyAssessment.authGate.submitLogin"
                }
              />
            )}
          </Button>
          <button
            type="button"
            onClick={() =>
              setMode((m) => (m === "register" ? "login" : "register"))
            }
            className="text-sm text-white/70 underline underline-offset-4"
          >
            <CmsText
              cmsKey={
                mode === "register"
                  ? "journeyAssessment.authGate.switchToLogin"
                  : "journeyAssessment.authGate.switchToRegister"
              }
            />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
