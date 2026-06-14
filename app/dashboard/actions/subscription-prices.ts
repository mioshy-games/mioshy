"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  pricingFormSchema,
  type PricingFormValues,
} from "@/lib/billing/pricing-validations";

type SaveError = Record<string, string[] | undefined>;
export type SaveResult =
  | { ok: true }
  | { ok: false; error: SaveError };

/**
 * Save the subscription pricing matrix. Validates against the same
 * invariants the DB enforces, then writes atomically via the
 * save_subscription_prices RPC (one transaction — needed for safe
 * default switching; see migration 112).
 *
 * Contract: ALWAYS resolves to a { ok, error? } object — never throws to
 * the caller, and never resolves to undefined. Previously the RPC call
 * sat outside any try/catch, so an unexpected throw (rejected rpc, a
 * Postgres error surfaced as an exception, a serialization failure) went
 * uncaught — and in production Next.js swallows an unhandled Server
 * Action throw and hands the client `undefined`, which crashed the form
 * at `res.ok`. The catch below converts any such throw into a normal
 * error result. requireAdmin() stays OUTSIDE the try because it may
 * redirect (throws NEXT_REDIRECT) and that control-flow throw must
 * propagate, not be swallowed.
 */
export async function saveSubscriptionPrices(
  raw: unknown,
): Promise<SaveResult> {
  const parsed = pricingFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.length
        ? { _root: parsed.error.flatten().formErrors }
        : parsed.error.flatten().fieldErrors,
    };
  }
  const v: PricingFormValues = parsed.data;

  // Outside try/catch: a non-admin triggers redirect() (NEXT_REDIRECT)
  // which must propagate as control flow, not be caught as an error.
  const { supabase, user } = await requireAdmin();

  try {
    const { error } = await supabase.rpc("save_subscription_prices", {
      p_rows: v.rows,
      p_actor: user.id,
    });

    if (error) {
      return { ok: false, error: { _root: [error.message] } };
    }

    // Pricing shows on marketing + checkout; revalidate broadly.
    revalidatePath("/dashboard/settings/pricing");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "שגיאה לא צפויה בשמירה";
    return { ok: false, error: { _root: [message] } };
  }
}
