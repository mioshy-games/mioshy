import "server-only";

/**
 * Subscription marketing promos — server-side discount logic
 * (docs/marketing-discounts-spec.md). STEP 1: pure computation + lookup only.
 * NOTHING here touches Cardcom or the checkout/webhook/renewal flow — that is
 * step 2+. The pure functions (applyDiscount / selectActivePromo /
 * promoConflicts) carry the rules and are unit-testable without a DB; the thin
 * DB wrappers (findActivePromo / assertNoOverlap) read subscription_promos via
 * the service-role client (the table is RLS-locked to it).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscountType = "percent" | "fixed_amount";
export type PromoProduct = "journey" | "games" | "all";
export type Currency = "ILS" | "USD";

export interface SubscriptionPromo {
  id: string;
  name: string;
  code: string | null;
  discount_type: DiscountType;
  percent: number | null;
  amount_ils: number | null;
  amount_usd: number | null;
  product: PromoProduct;
  discounted_charges: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  max_redemptions: number | null;
  created_at: string;
}

/**
 * Cardcom rejects a charge at/below zero, so the discounted amount is clamped to
 * a small positive floor (never ≤ 0 — spec §3.6).
 * TODO(itzik): confirm the real Cardcom minimum charge and set it here.
 */
const MIN_CHARGE = 1; // currency units (ILS / USD)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ms(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

export interface ApplyDiscountResult {
  discountedAmount: number;
  originalAmount: number;
  promoId: string | null;
}

/**
 * Pure discount math. `percent` is currency-agnostic; `fixed_amount` uses
 * amount_ils / amount_usd by currency — if there is no value for the currency
 * (e.g. a USD customer on an ILS-only fixed promo) there is NO discount. The
 * result is clamped to a positive floor; if the clamp would raise the price
 * (tiny base amount) no discount is recorded (promoId null). No DB / Cardcom.
 */
export function applyDiscount({
  amount,
  currency,
  promo,
}: {
  amount: number;
  currency: Currency;
  promo: SubscriptionPromo;
}): ApplyDiscountResult {
  const originalAmount = round2(amount);
  let discounted = originalAmount;

  if (promo.discount_type === "percent") {
    if (promo.percent != null) discounted = originalAmount * (1 - promo.percent / 100);
  } else {
    const off = currency === "ILS" ? promo.amount_ils : promo.amount_usd;
    if (off != null) discounted = originalAmount - off;
    // off == null → no value for this currency → no discount.
  }

  discounted = round2(Math.max(discounted, MIN_CHARGE));
  const applied = discounted < originalAmount;
  return {
    discountedAmount: applied ? discounted : originalAmount,
    originalAmount,
    promoId: applied ? promo.id : null,
  };
}

/**
 * Pure selection. Of `promos`, keep those that are active, match the product
 * ('all' or exact), and contain `at` in [starts_at, ends_at]. Zero → null. More
 * than one → deterministic pick (latest created_at, id tiebreak) + a warning
 * (spec §8 — there should be at most one, enforced by assertNoOverlap).
 */
export function selectActivePromo(
  promos: SubscriptionPromo[],
  { product, at }: { product: PromoProduct; at: Date | string },
): { promo: SubscriptionPromo | null; warning?: string } {
  const t = ms(at);
  const matches = promos.filter(
    (p) =>
      p.is_active &&
      (p.product === product || p.product === "all") &&
      ms(p.starts_at) <= t &&
      t <= ms(p.ends_at),
  );
  if (matches.length === 0) return { promo: null };
  if (matches.length === 1) return { promo: matches[0] };

  const chosen = [...matches].sort(
    (a, b) => ms(a.created_at) - ms(b.created_at) || a.id.localeCompare(b.id),
  )[matches.length - 1];
  return {
    promo: chosen,
    warning: `Multiple active promos matched product=${product} at ${new Date(
      t,
    ).toISOString()} (${matches.map((m) => m.id).join(", ")}); chose ${chosen.id} (latest).`,
  };
}

/**
 * DB wrapper for selectActivePromo. `admin` MUST be the service-role client
 * (subscription_promos is RLS-locked to it). Defaults `at` to now.
 */
export async function findActivePromo(
  admin: SupabaseClient,
  { product, at }: { product: PromoProduct; at?: Date | string },
): Promise<{ promo: SubscriptionPromo | null; warning?: string }> {
  const when = at ?? new Date();
  const { data, error } = await admin
    .from("subscription_promos")
    .select("*")
    .eq("is_active", true)
    .in("product", [product, "all"])
    .returns<SubscriptionPromo[]>();
  if (error) throw new Error(`findActivePromo: ${error.message}`);
  return selectActivePromo(data ?? [], { product, at: when });
}

type PromoWindow = Pick<SubscriptionPromo, "product" | "starts_at" | "ends_at">;

/**
 * Pure conflict predicate: two promos clash when their date windows overlap AND
 * their products collide (same product, or either is 'all') — spec §3.5/§8.
 */
export function promoConflicts(a: PromoWindow, b: PromoWindow): boolean {
  const productClash = a.product === b.product || a.product === "all" || b.product === "all";
  const windowOverlap = ms(a.starts_at) <= ms(b.ends_at) && ms(b.starts_at) <= ms(a.ends_at);
  return productClash && windowOverlap;
}

/**
 * Throws if `promo` would overlap ANY OTHER active promo (conflicting product +
 * overlapping window). For the admin create/update path (step 4). `admin` =
 * service-role client.
 */
export async function assertNoOverlap(
  admin: SupabaseClient,
  promo: Pick<SubscriptionPromo, "id" | "name"> & PromoWindow,
): Promise<void> {
  const { data, error } = await admin
    .from("subscription_promos")
    .select("id, name, product, starts_at, ends_at")
    .eq("is_active", true)
    .returns<(Pick<SubscriptionPromo, "id" | "name"> & PromoWindow)[]>();
  if (error) throw new Error(`assertNoOverlap: ${error.message}`);

  for (const existing of data ?? []) {
    if (existing.id === promo.id) continue; // editing itself
    if (promoConflicts(promo, existing)) {
      throw new Error(
        `Promo "${promo.name}" overlaps active promo "${existing.name}" ` +
          `(${existing.starts_at}..${existing.ends_at}, product=${existing.product}). ` +
          `At most one active promo per product/window is allowed.`,
      );
    }
  }
}
