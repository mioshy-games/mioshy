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
import { useCmsText } from "@/hooks/useCmsText";
import { useTrialOffer } from "@/hooks/useTrialOffer";
import { CmsText } from "@/components/cms/CmsText";
import type { Locale } from "@/lib/journey/types";

interface PaywallGateModalProps {
  open: boolean;
  locale: Locale;
  onClose?: () => void;
}

/**
 * Fallback paywall modal — Sprint 4 #3 Phase 2A migration. The
 * locale-keyed inline dictionary moved to journeyAssessment.paywallGate.*
 * (10 keys). The bullets array became 4 separate keys so admins can
 * edit them individually in the CMS.
 */
export function PaywallGateModal({
  open,
  locale,
  onClose,
}: PaywallGateModalProps) {
  const [busy, setBusy] = useState(false);

  // The loading label is needed as a string (it goes through the
  // `busy ? loading : cta` ternary into a <Button>'s child). All
  // other consumers render directly through <CmsText>.
  const loadingLabel = useCmsText("journeyAssessment.paywallGate.loading").text;

  // A3: journey (content-only) trial. When enabled the CTA + checkout swap to
  // the trial flow. plan 'monthly' matches this surface's paid cadence.
  const trial = useTrialOffer({
    product: "journey",
    coaching: false,
    isHe: locale === "he",
    plan: "monthly",
  });

  const startCheckout = async () => {
    setBusy(true);
    try {
      const endpoint = trial.enabled
        ? "/api/billing/checkout/create-trial"
        : "/api/billing/checkout/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monthly",
          source: "paywall_modal",
          language: locale,
          is_israeli: locale === "he",
          // Entry surface → the WITHOUT-coaching (content-only) price. Explicit
          // false because checkout defaults journey coaching to TRUE; without
          // this the buyer would be charged content + coaching_cost. The with-
          // coaching choice is only offered on the assessment results paywall.
          coaching: false,
        }),
      });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent dir={locale === "he" ? "rtl" : "ltr"} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <CmsText cmsKey="journeyAssessment.paywallGate.title" />
          </DialogTitle>
          <DialogDescription>
            <CmsText cmsKey="journeyAssessment.paywallGate.body" />
          </DialogDescription>
        </DialogHeader>

        <ul className="my-4 flex flex-col gap-2 text-sm text-white/85">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-fuchsia-300" />
              <CmsText cmsKey={`journeyAssessment.paywallGate.bullet${n}`} />
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-center text-white">
          <CmsText
            cmsKey="journeyAssessment.paywallGate.price"
            as="div"
            className="text-xl font-semibold"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={startCheckout}
            disabled={busy}
            size="lg"
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
          >
            {busy ? (
              loadingLabel
            ) : trial.enabled ? (
              trial.ctaLabel
            ) : (
              <CmsText cmsKey="journeyAssessment.paywallGate.cta" />
            )}
          </Button>
          {/* A3: trial disclosure — replaces the paid price implication */}
          {trial.enabled && trial.disclosure ? (
            <p className="text-center text-xs text-white/60">{trial.disclosure}</p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white/90"
          >
            <CmsText cmsKey="journeyAssessment.paywallGate.cancel" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
