/**
 * lib/uxellent-billing-helpers.ts
 *
 * Shared helpers for building the optional billing-document fields
 * (name, phone, product_name, payment_method) that the uxellent issuer
 * accepts and that are REGULATORY-REQUIRED on Israeli tax invoices.
 *
 * Used by three call sites:
 *   - app/api/billing/cardcom/indicator/route.ts  (first purchase)
 *   - app/api/billing/renewals/run/route.ts       (weekly cron)
 *   - app/api/billing/repair-missing-invoices/route.ts
 *
 * All helpers are *defensive*: they return null/undefined gracefully and
 * never throw. The uxellent API accepts every field as optional, so
 * "missing data" is a softer failure than "wrong data".
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─────────────────────────────────────────────────────────────────────────────
// 1. Product name
// ─────────────────────────────────────────────────────────────────────────────

/** Pillar slugs as written into checkout_sessions.product / subscriptions.product. */
export type ProductPillar = "games" | "journey" | "adults" | (string & {})

/**
 * Pillar → human-readable Hebrew product name used on the invoice line.
 *
 * Why Hebrew only: every invoice the issuer produces today is for Israeli
 * customers (we don't issue Israeli tax docs for non-IL purchases yet —
 * those go through the VAT-free path). When that changes we'll add a
 * `language` overload.
 */
export function pillarToProductName(pillar: ProductPillar | null | undefined): string {
  switch (pillar) {
    case "games":   return "משחקי זוגות אונליין"
    case "journey": return "ליווי עם מיאושי"
    case "adults":  return "הסקס של מיאושי"
    default:        return "מיאושי - עולם הזוגיות"
  }
}

/**
 * Resolve the per-line product name for a subscription/recurring charge.
 * Simple pillar mapping — subscriptions don't carry a target game.
 */
export function productNameForSubscription(pillar: ProductPillar | null | undefined): string {
  return pillarToProductName(pillar)
}

/**
 * Resolve the per-line product name for a checkout session.
 * For adults one-time purchases we look up the specific game title so
 * the invoice says "מיאושי – <game>" instead of the generic line.
 *
 * Best-effort: any DB failure falls back to the pillar default.
 */
export async function productNameForSession(args: {
  admin:          SupabaseClient
  product:        ProductPillar | null | undefined
  purchase_type:  "subscription" | "one_time" | string
  target_game_id: string | null | undefined
}): Promise<string> {
  const pillarDefault = pillarToProductName(args.product)

  // Only adults one-time purchases carry a specific game.
  if (args.purchase_type !== "one_time") return pillarDefault
  if (args.product !== "adults")          return pillarDefault
  if (!args.target_game_id)               return pillarDefault

  try {
    const { data: game } = await args.admin
      .from("games")
      .select("name_he, name_en")
      .eq("id", args.target_game_id)
      .maybeSingle<{ name_he: string | null; name_en: string | null }>()

    const title = game?.name_he?.trim() || game?.name_en?.trim() || ""
    if (!title) return pillarDefault
    return `מיאושי – ${title}`
  } catch {
    return pillarDefault
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Payment method
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cardcom returns several brand fields with inconsistent naming
 * (Mutag_24, Mutag, ExtShvaParams.Mutag24, CardName, …). This helper
 * normalises any of them to the Hebrew payment-method label the issuer
 * expects on the receipt.
 *
 * If the brand string is recognisably "Bit", "Apple Pay", "Google Pay",
 * "PayBox" or "PayPal" we return that; everything else (Visa, Mastercard,
 * Isracard, plain "אשראי", etc.) collapses to "כרטיס אשראי", which is
 * what the customer's bank statement will say anyway.
 */
export function brandToPaymentMethod(brand: string | null | undefined): string {
  const raw = String(brand ?? "").trim()
  if (!raw) return "כרטיס אשראי"

  const lc = raw.toLowerCase()

  // Wallets / alternative tenders
  if (lc.includes("bit"))                              return "Bit"
  if (lc.includes("apple"))                            return "Apple Pay"
  if (lc.includes("google"))                           return "Google Pay"
  if (lc.includes("paybox") || lc.includes("פייבוקס")) return "PayBox"
  if (lc.includes("paypal"))                           return "PayPal"

  // Anything else (Visa/Mastercard/Isracard/American Express/…)
  // is a credit-card brand → bucket under "כרטיס אשראי".
  return "כרטיס אשראי"
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Customer name / phone from Cardcom indicator
// ─────────────────────────────────────────────────────────────────────────────

/** Trim and return null if the result is empty. */
function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s : null
}

/**
 * Pull customer name + phone (+ a brand hint) from a Cardcom indicator
 * payload. Cardcom is famously inconsistent about field naming — we try
 * the most common keys and return null when nothing matches.
 *
 * `parsed` is the dict returned by parseCardcomResponse() in lib/cardcom.ts.
 */
export function extractCardcomCustomerInfo(parsed: Record<string, string> | null | undefined): {
  name:  string | null
  phone: string | null
  brand: string | null
} {
  const p = (parsed ?? {}) as Record<string, string>

  const name =
    clean(p["CardOwnerName"]) ??
    clean(p["UIValues.CardOwnerName"]) ??
    clean(p["Name"]) ??
    clean(p["CardHolderName"]) ??
    null

  const phone =
    clean(p["CardOwnerPhone"]) ??
    clean(p["UIValues.CardOwnerPhone"]) ??
    clean(p["Phone"]) ??
    clean(p["CardOwnerMobilePhone"]) ??
    null

  // Brand can come from many places. Prefer the human-readable CardName
  // when the issuer set it (some Cardcom configurations return e.g.
  // "ויזה כאל"); fall back to the Mutag_24 numeric/code brand.
  const brand =
    clean(p["CardName"]) ??
    clean(p["DealResponse.CardName"]) ??
    clean(p["Mutag_24"]) ??
    clean(p["ExtShvaParams.Mutag24"]) ??
    clean(p["Mutag"]) ??
    null

  return { name, phone, brand }
}
