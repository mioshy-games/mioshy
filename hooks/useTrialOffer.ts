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
  /** CMS-editable label, resolved with an inline fallback. Doc copy (task 17):
   *  "התחילו 7 ימים חינם". */
  ctaLabel: string;
  /** Trial microcopy (doc, task 17): "בלי חיוב עכשיו · תזכורת לפני שמתחיל".
   *  Trial is ILS/Israeli-only in v1, so the EN variant never actually renders. */
  disclosure: string | null;
  /** Short tag for the selected plan card (doc, section 2): "7 ימי ניסיון חינם". */
  cardTag: string;
  /** True until the availability probe resolves (avoid a CTA flash). */
  loading: boolean;
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
  // Doc copy (task 17). EN never renders (trial is ILS/Israeli-only).
  const [ctaLabel, setCtaLabel] = useState(isHe ? "התחילו 7 ימים חינם" : "Start your 7 free days");
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

  // Doc copy (task 17, section 2). The specific price now lives in the trial
  // timeline (task 16, package selector), not in this microcopy.
  const disclosure = enabled
    ? isHe
      ? "בלי חיוב עכשיו · תזכורת לפני שמתחיל"
      : "No charge now · we'll remind you before it starts"
    : null;

  const cardTag = isHe ? "7 ימי ניסיון חינם" : "7-day free trial";

  return { enabled, amount, currency, ctaLabel, disclosure, cardTag, loading };
}
