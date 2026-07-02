"use client";

import { useEffect, useState } from "react";
import { fetchCmsTextMap } from "@/lib/cms/client-text-map";

/**
 * useTrialOffer — shared client resolver for the 7-day-trial CTA (A3).
 *
 * Given a package (product, coaching, plan hint), it:
 *   • probes /api/billing/trial/availability (enabled + post-trial amount), and
 *   • loads the CMS-editable CTA label (`trial_cta_label`) with an inline
 *     fallback so a blank/missing CMS row never renders an empty button.
 *
 * When `enabled` is true the calling surface swaps its paid CTA for the trial
 * offer: label → `ctaLabel`, checkout → /api/billing/checkout/create-trial.
 * The real eligibility/abuse/pricing enforcement stays server-side in the
 * create-trial route; this is display-only. v1 is ILS-only (the API returns
 * enabled:false for non-Israeli requests).
 */
export interface TrialOffer {
  enabled: boolean;
  amount: number | null;
  currency: string | null;
  /** CMS-editable label, resolved with an inline fallback. */
  ctaLabel: string;
  /** Localized "after 7 days you'll be charged ₪X · cancel anytime" line. */
  disclosure: string | null;
  /** True until the availability probe resolves (avoid a CTA flash). */
  loading: boolean;
}

function fmtAmount(amount: number, currency: string, isHe: boolean): string {
  try {
    return new Intl.NumberFormat(isHe ? "he-IL" : "en-US", {
      style: "currency",
      currency: currency || "ILS",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function useTrialOffer(args: {
  product: "games" | "journey" | "adults";
  coaching: boolean;
  isHe: boolean;
  /** Cadence hint sent to both availability and create-trial (default weekly). */
  plan?: string;
}): TrialOffer {
  const { product, coaching, isHe, plan = "weekly" } = args;

  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [ctaLabel, setCtaLabel] = useState(isHe ? "נסה 7 ימים חינם" : "Try 7 days free");
  const [loading, setLoading] = useState(true);

  // Adults is never a trial (one-time) — short-circuit without a network call.
  useEffect(() => {
    if (product === "adults") {
      setEnabled(false);
      setLoading(false);
      return;
    }
    let alive = true;
    const qs = new URLSearchParams({ product, coaching: String(coaching), plan });
    fetch(`/api/billing/trial/availability?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || typeof d.enabled !== "boolean") return;
        setEnabled(d.enabled);
        setAmount(typeof d.amount === "number" ? d.amount : null);
        setCurrency(typeof d.currency === "string" ? d.currency : null);
      })
      .catch(() => { /* fall back to the paid CTA */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [product, coaching, plan]);

  // CMS-editable CTA label (provider-independent read + inline fallback).
  useEffect(() => {
    let alive = true;
    void fetchCmsTextMap(["trial_cta_label"], isHe ? "he" : "en").then((m) => {
      if (alive && m.trial_cta_label) setCtaLabel(m.trial_cta_label);
    });
    return () => { alive = false; };
  }, [isHe]);

  const disclosure =
    enabled && amount != null && currency
      ? isHe
        ? `בעוד 7 ימים תחויב ב-${fmtAmount(amount, currency, true)} · ביטול בקליק, בלי חיוב`
        : `After 7 days you'll be charged ${fmtAmount(amount, currency, false)} · cancel anytime, no charge`
      : enabled
        ? isHe
          ? "7 ימים חינם · ביטול בקליק, בלי חיוב"
          : "7 days free · cancel anytime, no charge"
        : null;

  return { enabled, amount, currency, ctaLabel, disclosure, loading };
}
