import { z } from "zod";

/**
 * Admin form validation for subscription_promos (marketing-discounts-spec §7).
 * Mirrors the DB CHECKs (migration 146): a percent promo needs `percent`; a
 * fixed promo needs at least one amount; ends_at ≥ starts_at; charges ≥ 1.
 * Used by the create/update server action.
 */

const numOrNull = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null ? null : v));

export const promoFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    code: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        const s = typeof v === "string" ? v.trim() : "";
        return s.length ? s : null;
      }),
    discount_type: z.enum(["percent", "fixed_amount"]),
    percent: numOrNull,
    amount_ils: numOrNull,
    amount_usd: numOrNull,
    product: z.enum(["journey", "games", "all"]),
    discounted_charges: z.number().int().min(1, "At least 1 charge"),
    starts_at: z.string().min(1, "Start is required"),
    ends_at: z.string().min(1, "End is required"),
    is_active: z.boolean(),
  })
  .refine(
    (v) => v.discount_type !== "percent" || (v.percent != null && v.percent > 0 && v.percent <= 100),
    { path: ["percent"], message: "Percent must be between 0 and 100" },
  )
  .refine(
    (v) => v.discount_type !== "fixed_amount" || v.amount_ils != null || v.amount_usd != null,
    { path: ["amount_ils"], message: "A fixed promo needs an ILS and/or USD amount" },
  )
  .refine((v) => new Date(v.ends_at).getTime() >= new Date(v.starts_at).getTime(), {
    path: ["ends_at"],
    message: "End must be on/after start",
  });

export type PromoFormValues = z.infer<typeof promoFormSchema>;
