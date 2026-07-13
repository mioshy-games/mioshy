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
  /** Trial microcopy. As of the ₪1 charge-and-refund model (2026-07-13) this is
   *  the CMS `trial_charge_disclosure` copy with `{price}` filled from `amount`
   *  ("...נחייב ₪1 שיוחזר מיד. בתום 7 ימים יחויב {price} ₪..."). ILS/Israeli-only. */
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
  // Disclosure template (with a `{price}` placeholder) — CMS-editable, resolved
  // with an inline fallback so a missing row never blanks the notice.
  const [disclosureTpl, setDisclosureTpl] = useState(
    isHe
      ? "לאימות הכרטיס נבצע חיוב זמני של ₪1 שיוחזר מיד. בתום 7 ימים יחויב {price} ₪, וניתן לבטל בכל עת."
      : "To verify your card we'll make a temporary ₪1 charge, refunded immediately. After 7 days you'll be charged ₪{price}; cancel anytime.",
  );
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

  // CMS-editable CTA label + charge disclosure (provider-independent read with
  // inline fallbacks). Both live in the `marketing`/`trial` namespace.
  useEffect(() => {
    let alive = true;
    void fetchCmsTextMap(["trial_cta_label", "trial_charge_disclosure"], isHe ? "he" : "en").then((m) => {
      if (!alive) return;
      if (m.trial_cta_label) setCtaLabel(m.trial_cta_label);
      if (m.trial_charge_disclosure) setDisclosureTpl(m.trial_charge_disclosure);
    });
    return () => { alive = false; };
  }, [isHe]);

  // ₪1 charge-and-refund model (2026-07-13): the trial DOES take a real (₪1)
  // validation charge, refunded immediately — so the old "no charge now" copy is
  // wrong. Fill `{price}` with the resolved post-trial amount.
  const disclosure = enabled
    ? disclosureTpl.replace(/\{price\}/g, amount != null ? String(amount) : "")
    : null;

  const cardTag = isHe ? "7 ימי ניסיון חינם" : "7-day free trial";

  return { enabled, amount, currency, ctaLabel, disclosure, cardTag, loading };
}
