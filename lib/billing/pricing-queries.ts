// ============================================================
// lib/billing/pricing-queries.ts
//
// Server-side reads for the DB-backed subscription pricing matrix
// (table: subscription_prices, created in migration 112). This is the
// C1 replacement for the hardcoded PLAN_AMOUNTS_* maps in lib/billing.ts.
//
// Read by getPlanPrice() (checkout) and, later, the admin pricing editor
// + the customer-facing pricing UI. Public-readable (RLS `using(true)`),
// so the anon/server client is fine.
//
// Wrapped in React.cache() so multiple consumers in one request round-trip
// to Supabase once — same pattern as lib/between-us/queries.ts.
// ============================================================
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SubscriptionProduct } from "@/lib/billing";

// All cadences the schema allows. Only `weekly` is populated until C2.
export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

export interface SubscriptionPrice {
  id?: string; // present when fetched for the admin editor (listAllPrices)
  product: SubscriptionProduct;
  cadence: Cadence;
  price_ils: number;
  price_usd: number;
  enabled: boolean;
  is_default: boolean;
}

/**
 * Fetch the price row for a (product, cadence). Returns null if the row
 * is missing or the query fails — callers (getPlanPrice) fall back to the
 * hardcoded constants so a transient DB hiccup never blocks a checkout.
 *
 * numeric(10,2) comes back as a string from PostgREST, so we coerce.
 */
export const getSubscriptionPrice = cache(
  async function getSubscriptionPriceImpl(
    product: SubscriptionProduct,
    cadence: Cadence,
  ): Promise<SubscriptionPrice | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subscription_prices")
      .select("product, cadence, price_ils, price_usd, enabled, is_default")
      .eq("product", product)
      .eq("cadence", cadence)
      .maybeSingle();

    if (error || !data) return null;
    return {
      product: data.product as SubscriptionProduct,
      cadence: data.cadence as Cadence,
      price_ils: Number(data.price_ils),
      price_usd: Number(data.price_usd),
      enabled: Boolean(data.enabled),
      is_default: Boolean(data.is_default),
    };
  },
);

// Cadence sort order (shortest → longest) for stable admin/UI rendering.
export const CADENCE_ORDER: Record<Cadence, number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 2,
  yearly: 3,
};

/**
 * Every price row (enabled or not), for the admin editor. Ordered by
 * product then cadence length. Returns [] on error.
 */
export const listAllPrices = cache(
  async function listAllPricesImpl(): Promise<SubscriptionPrice[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subscription_prices")
      .select("id, product, cadence, price_ils, price_usd, enabled, is_default");

    if (error || !data) return [];
    return data
      .map((d) => ({
        id: d.id as string,
        product: d.product as SubscriptionProduct,
        cadence: d.cadence as Cadence,
        price_ils: Number(d.price_ils),
        price_usd: Number(d.price_usd),
        enabled: Boolean(d.enabled),
        is_default: Boolean(d.is_default),
      }))
      .sort(
        (a, b) =>
          a.product.localeCompare(b.product) ||
          CADENCE_ORDER[a.cadence] - CADENCE_ORDER[b.cadence],
      );
  },
);

/**
 * All enabled price rows for a product, ordered by cadence length.
 * Used later by the pricing UI to render the cadence options. Returns []
 * on error.
 */
export const listEnabledPrices = cache(
  async function listEnabledPricesImpl(
    product: SubscriptionProduct,
  ): Promise<SubscriptionPrice[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subscription_prices")
      .select("product, cadence, price_ils, price_usd, enabled, is_default")
      .eq("product", product)
      .eq("enabled", true);

    if (error || !data) return [];
    return data.map((d) => ({
      product: d.product as SubscriptionProduct,
      cadence: d.cadence as Cadence,
      price_ils: Number(d.price_ils),
      price_usd: Number(d.price_usd),
      enabled: Boolean(d.enabled),
      is_default: Boolean(d.is_default),
    }));
  },
);

/**
 * Resolve the cadence a checkout should use (C2.2). Server-authoritative:
 * the requested cadence is honoured ONLY if it's an enabled cadence for
 * the product; otherwise we fall back to the product's default enabled
 * cadence (the UI offers only enabled options, so the fallback is a
 * safety net for stale/spoofed requests). Returns null when the product
 * has no enabled cadence at all (a misconfiguration — caller should
 * refuse the checkout rather than guess a price).
 */
export const resolveCheckoutCadence = cache(
  async function resolveCheckoutCadenceImpl(
    product: SubscriptionProduct,
    requested: string | null | undefined,
  ): Promise<Cadence | null> {
    const enabled = await listEnabledPrices(product);
    if (enabled.length === 0) return null;
    const requestedMatch = requested
      ? enabled.find((p) => p.cadence === requested)
      : undefined;
    const chosen =
      requestedMatch ?? enabled.find((p) => p.is_default) ?? enabled[0];
    return chosen.cadence;
  },
);
