"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OtpFlow } from "@/components/auth/OtpFlow";
import { fetchOtpConsentCopy } from "@/app/actions/otp-consent-action";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";
import { track } from "@/lib/analytics";

/**
 * In-game registration — passwordless Email OTP (name + email → code → phone,
 * skippable) via the shared OtpFlow in the dark game-modal theme. Consent copy
 * is fetched client-side (this modal isn't handed server-resolved props). On
 * success the game continues via onSuccess().
 */
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
  const isHe = locale === "he";
  const [consent, setConsent] = useState<OtpConsentCopy | null>(null);

  useEffect(() => {
    if (open) {
      track("registration_started", { source: "game_lobby" });
      if (!consent) fetchOtpConsentCopy(locale).then(setConsent).catch(() => {});
    }
  }, [open, locale, consent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isHe ? "rtl" : "ltr"}
        aria-labelledby="reg-headline"
        className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-md"
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-stone-900 ring-1 ring-white/10">
          <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-amber-400 via-rose-400 to-fuchsia-500" />
          <div className="flex flex-col gap-4 p-6">
            {consent ? (
              <OtpFlow
                initialMode="signup"
                locale={locale}
                consent={consent}
                theme="dark"
                onAuthenticated={() => {
                  track("registration_completed", { source: "game_lobby" });
                  onSuccess();
                  onOpenChange(false);
                }}
              />
            ) : (
              <p className="py-8 text-center text-sm text-white/50">{isHe ? "טוען…" : "Loading…"}</p>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-2xl py-2 text-[15px] text-white/40 transition hover:text-white/70"
            >
              {isHe ? "אולי בפעם אחרת" : "Maybe later"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
