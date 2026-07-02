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
/** Stage-1 coaching add-on targeting (migration 149). 'all' = applies whether
 *  or not the buyer chose coaching; 'with' = only the with-coaching option;
 *  'without' = only the without-coaching option. */
export type CoachingScope = "with" | "without" | "all";

export interface SubscriptionPromo {
  id: string;
  name: string;
  /** Optional customer-facing title (migration 147). null → UI shows "מבצע {name}". */
  display_text: string | null;
  /** Cadence restriction (migration 148). null/'all' → every cadence; otherwise
   *  the promo only applies to a checkout whose resolved cadence matches. */
  cadence: string | null;
  /** Coaching targeting (migration 149). null/'all' → applies regardless of the
   *  coaching choice; 'with'/'without' → only that option. */
  coaching_scope: CoachingScope | null;
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
 * Cadence match (migration 148). A promo with no cadence restriction
 * (null/'all') applies to every cadence; otherwise it applies only when the
 * purchased cadence equals the promo's. Used by checkout (exact cadence) and by
 * the offer UI (per-cadence card).
 */
export function promoAppliesToCadence(
  promo: SubscriptionPromo,
  cadence: string | null | undefined,
): boolean {
  if (promo.cadence == null || promo.cadence === "all") return true;
  return cadence != null && promo.cadence === cadence;
}

/**
 * Coaching match (migration 149). A promo with no coaching restriction
 * (null/'all') applies to both options; otherwise it applies only when the
 * buyer's coaching choice matches ('with' ↔ coaching=true, 'without' ↔ false).
 * Pass `coaching` undefined to ignore the restriction — e.g. the offer UI
 * fetches the promo once and tests each option card itself.
 */
export function promoAppliesToCoaching(
  promo: SubscriptionPromo,
  coaching: boolean | null | undefined,
): boolean {
  if (promo.coaching_scope == null || promo.coaching_scope === "all") return true;
  if (coaching === undefined || coaching === null) return true;
  return promo.coaching_scope === (coaching ? "with" : "without");
}

/**
 * Pure selection. Of `promos`, keep those that are active, match the product
 * ('all' or exact), and contain `at` in [starts_at, ends_at]. When `cadence` is
 * provided, also require the promo to apply to that cadence (migration 148);
 * omit `cadence` (undefined) to ignore the cadence restriction — e.g. the offer
 * UI fetches the promo once and then tests each card's cadence itself. Zero →
 * null. More than one → deterministic pick (latest created_at, id tiebreak) + a
 * warning (spec §8 — there should be at most one, enforced by assertNoOverlap).
 */
export function selectActivePromo(
  promos: SubscriptionPromo[],
  {
    product,
    at,
    cadence,
    coaching,
    ignoreEndsAt,
  }: {
    product: PromoProduct;
    at: Date | string;
    cadence?: string | null;
    coaching?: boolean | null;
    /** Task 20 (personal_window): the per-user 48h window is the real expiry,
     *  so the promo's global ends_at must NOT cut it off. When true, keep the
     *  starts_at floor but drop the ends_at ceiling. */
    ignoreEndsAt?: boolean;
  },
): { promo: SubscriptionPromo | null; warning?: string } {
  const t = ms(at);
  const matches = promos.filter(
    (p) =>
      p.is_active &&
      (p.product === product || p.product === "all") &&
      ms(p.starts_at) <= t &&
      (ignoreEndsAt || t <= ms(p.ends_at)) &&
      (cadence === undefined || promoAppliesToCadence(p, cadence)) &&
      (coaching === undefined || promoAppliesToCoaching(p, coaching)),
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
  {
    product,
    at,
    cadence,
    coaching,
    ignoreEndsAt,
  }: {
    product: PromoProduct;
    at?: Date | string;
    cadence?: string | null;
    coaching?: boolean | null;
    /** See selectActivePromo — drop the ends_at ceiling (personal_window). */
    ignoreEndsAt?: boolean;
  },
): Promise<{ promo: SubscriptionPromo | null; warning?: string }> {
  const when = at ?? new Date();
  const { data, error } = await admin
    .from("subscription_promos")
    .select("*")
    .eq("is_active", true)
    .in("product", [product, "all"])
    .returns<SubscriptionPromo[]>();
  if (error) throw new Error(`findActivePromo: ${error.message}`);
  return selectActivePromo(data ?? [], { product, at: when, cadence, coaching, ignoreEndsAt });
}

type PromoWindow = Pick<
  SubscriptionPromo,
  "product" | "starts_at" | "ends_at" | "coaching_scope"
>;

/**
 * Pure conflict predicate: two promos clash when their windows overlap AND their
 * products collide (same, or either 'all') AND their coaching scopes collide
 * (same, or either 'all'). The coaching_scope dimension lets a with-coaching and
 * a without-coaching journey promo coexist in the same window — each targets a
 * different purchase option, so they don't actually conflict.
 */
export function promoConflicts(a: PromoWindow, b: PromoWindow): boolean {
  const productClash = a.product === b.product || a.product === "all" || b.product === "all";
  const windowOverlap = ms(a.starts_at) <= ms(b.ends_at) && ms(b.starts_at) <= ms(a.ends_at);
  const scopeA = a.coaching_scope ?? "all";
  const scopeB = b.coaching_scope ?? "all";
  const coachingClash = scopeA === scopeB || scopeA === "all" || scopeB === "all";
  return productClash && windowOverlap && coachingClash;
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
    .select("id, name, product, starts_at, ends_at, coaching_scope")
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
