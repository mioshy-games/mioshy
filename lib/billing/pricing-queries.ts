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
  /** Stage-1 coaching add-on — the cost of the expert-chat add-on on top of
   *  the content price, per cadence. Default 0 (journey-only meaningful). */
  coaching_cost_ils: number;
  coaching_cost_usd: number;
  enabled: boolean;
  is_default: boolean;
}

// Base columns that have existed since migration 112. The Stage-1 coaching
// cost columns (migration 149) are appended SEPARATELY so a missing-column
// window (code deployed before the SQL ran) degrades gracefully instead of
// emptying the whole price matrix — which would hide every cadence and break
// checkout. We try the full select first; on ANY error we retry with the base
// columns and default the coaching cost to 0.
const BASE_PRICE_COLS = "product, cadence, price_ils, price_usd, enabled, is_default";
const COACHING_COLS = "coaching_cost_ils, coaching_cost_usd";

type RawPriceRow = Record<string, unknown>;
function toPrice(d: RawPriceRow): SubscriptionPrice {
  return {
    product: d.product as SubscriptionProduct,
    cadence: d.cadence as Cadence,
    price_ils: Number(d.price_ils),
    price_usd: Number(d.price_usd),
    // Absent in the fallback (pre-149) select → coalesce to 0.
    coaching_cost_ils: Number(d.coaching_cost_ils ?? 0),
    coaching_cost_usd: Number(d.coaching_cost_usd ?? 0),
    enabled: Boolean(d.enabled),
    is_default: Boolean(d.is_default),
  };
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
    const run = (cols: string) =>
      supabase
        .from("subscription_prices")
        .select(cols)
        .eq("product", product)
        .eq("cadence", cadence)
        .maybeSingle();

    let { data, error } = await run(`${BASE_PRICE_COLS}, ${COACHING_COLS}`);
    if (error) ({ data, error } = await run(BASE_PRICE_COLS)); // pre-149 fallback
    if (error || !data) return null;
    return toPrice(data as unknown as RawPriceRow);
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
    const run = (cols: string) =>
      supabase.from("subscription_prices").select(cols);

    let { data, error } = await run(`id, ${BASE_PRICE_COLS}, ${COACHING_COLS}`);
    if (error) ({ data, error } = await run(`id, ${BASE_PRICE_COLS}`)); // pre-149 fallback
    if (error || !data) return [];
    return (data as unknown as RawPriceRow[])
      .map((d) => ({
        id: d.id as string,
        ...toPrice(d),
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
    const run = (cols: string) =>
      supabase
        .from("subscription_prices")
        .select(cols)
        .eq("product", product)
        .eq("enabled", true);

    let { data, error } = await run(`${BASE_PRICE_COLS}, ${COACHING_COLS}`);
    if (error) ({ data, error } = await run(BASE_PRICE_COLS)); // pre-149 fallback
    if (error || !data) return [];
    return (data as unknown as RawPriceRow[]).map(toPrice);
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
