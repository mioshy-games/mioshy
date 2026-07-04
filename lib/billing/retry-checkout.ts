"use client";

/**
 * retryCheckout — re-open a fresh Cardcom payment page from a failed attempt.
 *
 * Task 26 #3 (Itzik 2026-07-03): the failure page's "ניסיון נוסף" button used to
 * dump the user on /pricing or the home paywall. It must instead mint a NEW
 * checkout session and send them straight back to Cardcom.
 *
 * The failed session carries everything we need (product / plan / coaching /
 * is_trial). RLS lets a user read their own checkout_sessions (the success page
 * already does), so we read it client-side, then re-POST to the SAME create
 * endpoint the results page uses — which runs all the real guards again and
 * returns a fresh redirect_url. A failed attempt created no trial_redemption /
 * subscription, so the abuse guards pass on retry.
 *
 * Returns the Cardcom redirect URL, or null when we couldn't restart (caller
 * shows an error / falls back to a link).
 */

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export async function retryCheckout(
  sessionId: string,
  locale: string,
  // "auto" reuses the failed session's flow (trial → trial); "regular" forces a
  // normal paid subscription with NO trial (Task 33 — "you already used your
  // one-time trial, join directly" path).
  mode: "auto" | "regular" = "auto",
): Promise<{ redirectUrl: string | null; message?: string }> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("checkout_sessions")
      .select("product, plan, coaching, is_trial")
      .eq("id", sessionId)
      .maybeSingle();
    if (!data) return { redirectUrl: null, message: "session_not_found" };

    const useTrial = mode === "auto" && data.is_trial;
    const endpoint = useTrial
      ? "/api/billing/checkout/create-trial"
      : "/api/billing/checkout/create";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: data.product,
        plan: data.plan,
        coaching: data.coaching,
        language: locale,
        is_israeli: locale === "he",
        return_path: `/${locale}/my`,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      redirect_url?: string;
      message?: string;
    };
    return { redirectUrl: json?.redirect_url ?? null, message: json?.message };
  } catch {
    return { redirectUrl: null, message: "network_error" };
  }
}
