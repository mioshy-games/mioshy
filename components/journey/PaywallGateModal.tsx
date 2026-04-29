"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/journey/types";

interface PaywallGateModalProps {
  open: boolean;
  locale: Locale;
  onClose?: () => void;
}

/**
 * Fallback paywall modal (shown only in edge-cases; main CTA is in AnalysisSummary).
 * Updated copy: highlights the personalized weekly-task service model.
 */
export function PaywallGateModal({ open, locale, onClose }: PaywallGateModalProps) {
  const [busy, setBusy] = useState(false);

  const t = locale === "he"
    ? {
        title: "תוכנית אישית — שבוע אחר שבוע",
        body: "הצטרפו לשירות וקבלו ניתוח מעמיק, משימות שבועיות מותאמות, ושיחות עם מומחים.",
        bullets: [
          "2–4 משימות בשבוע שנבחרו ע\"י מומחים — בדיוק למה שאתם צריכים",
          "שאלונים נוספים בשבועות הראשונים לכיוון מדויק יותר",
          "שירות מותאם אישית לחלוטין — לא תוכנית גנרית",
          "שיחות עם מומחים כלולות במחיר — ללא תוספת",
        ],
        price: "₪98 / $33 לחודש — ניתן לביטול בכל עת",
        cta: "הצטרפות לשירות",
        cancel: "אחר כך",
        loading: "מכין תשלום…",
      }
    : {
        title: "A personalized plan — week after week",
        body: "Join the service and get an in-depth analysis, weekly personalized tasks, and expert consultations.",
        bullets: [
          "2–4 expert-picked weekly tasks — matched precisely to your needs",
          "Additional questionnaires in early weeks to sharpen your profile",
          "100% personalized — not a generic program",
          "Expert consultations are included in the price — no add-ons",
        ],
        price: "$33 / ₪98 per month — cancel anytime",
        cta: "Join the service",
        cancel: "Not now",
        loading: "Preparing checkout…",
      };

  const startCheckout = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monthly",
          source: "paywall_modal",
          language: locale,
          is_israeli: locale === "he",
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
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.body}</DialogDescription>
        </DialogHeader>

        <ul className="my-4 flex flex-col gap-2 text-sm text-white/85">
          {t.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-fuchsia-300" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-center text-white">
          <div className="text-xl font-semibold">{t.price}</div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={startCheckout} disabled={busy} size="lg" className="w-full bg-fuchsia-600 hover:bg-fuchsia-700">
            {busy ? t.loading : t.cta}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white/90"
          >
            {t.cancel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
