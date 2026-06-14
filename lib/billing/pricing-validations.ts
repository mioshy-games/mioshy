// ============================================================
// lib/billing/pricing-validations.ts
//
// Zod schema for the admin subscription-pricing editor
// (/dashboard/settings/pricing). Mirrors the per-product DB invariants
// from migration 112 so the form surfaces friendly errors *before* the
// save RPC rejects: exactly one default per product, the default must be
// enabled, ≥1 enabled cadence per product, and quarterly is Journey-only.
// ============================================================
import { z } from "zod";

export const PRICING_PRODUCTS = ["games", "journey"] as const;
export const PRICING_CADENCES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

// Which cadences each product offers. Quarterly is Journey-only (also a
// DB CHECK). The editor renders one row per slot here; the upsert RPC
// creates the row on save if it doesn't exist yet.
export const CADENCES_BY_PRODUCT = {
  games: ["weekly", "monthly", "yearly"],
  journey: ["weekly", "monthly", "quarterly", "yearly"],
} as const;

// A single price row passed to client surfaces (e.g. the journey cadence
// picker). Client-safe (no server imports) — mirrors SubscriptionPrice
// minus the DB id.
export type CadenceOption = {
  cadence: (typeof PRICING_CADENCES)[number];
  price_ils: number;
  price_usd: number;
  enabled: boolean;
  is_default: boolean;
};

// Prices are whole units only (no agorot/cents): step=1, integer.
export const priceRowSchema = z.object({
  product: z.enum(PRICING_PRODUCTS),
  cadence: z.enum(PRICING_CADENCES),
  price_ils: z.number().int("מחיר ₪ חייב להיות מספר שלם").positive("מחיר ₪ חייב להיות גדול מ-0"),
  price_usd: z.number().int("מחיר $ חייב להיות מספר שלם").positive("מחיר $ חייב להיות גדול מ-0"),
  enabled: z.boolean(),
  is_default: z.boolean(),
});

export type PriceRowValues = z.infer<typeof priceRowSchema>;

export const pricingFormSchema = z
  .object({ rows: z.array(priceRowSchema) })
  .superRefine((val, ctx) => {
    for (const product of PRICING_PRODUCTS) {
      const rows = val.rows.filter((r) => r.product === product);
      if (rows.length === 0) continue;

      const defaults = rows.filter((r) => r.is_default);
      if (defaults.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows"],
          message: `${product}: חייבת להיות בדיוק קדנציית ברירת-מחדל אחת`,
        });
      }
      if (defaults.length === 1 && !defaults[0].enabled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows"],
          message: `${product}: קדנציית ברירת-המחדל חייבת להיות פעילה`,
        });
      }
      if (!rows.some((r) => r.enabled)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows"],
          message: `${product}: חייבת קדנציה פעילה אחת לפחות`,
        });
      }
    }

    // Quarterly is Journey-only (also enforced by a DB CHECK constraint).
    for (const r of val.rows) {
      if (r.cadence === "quarterly" && r.product !== "journey") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows"],
          message: "קדנציה רבעונית זמינה לליווי (journey) בלבד",
        });
      }
    }
  });

export type PricingFormValues = z.infer<typeof pricingFormSchema>;
