"use server";

/**
 * Admin CRUD for subscription_promos (marketing-discounts-spec §7). Auth-gated
 * by requireAdmin(); all DB ops use the service-role client (the table is
 * RLS-locked to it). create/update enforce assertNoOverlap so two compatible
 * promos can never be active at once. CRUD only — never touches the money path.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { assertNoOverlap } from "@/lib/billing/promos";
import { promoFormSchema } from "@/lib/billing/promo-validations";

const PAGE = "/dashboard/marketing/discounts";

type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: Record<string, string[] | undefined> };

export async function savePromo(id: string | null, raw: unknown): Promise<SaveResult> {
  const parsed = promoFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined> };
  }
  await requireAdmin();
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: { _root: ["Service role not configured"] } };

  const v = parsed.data;
  const row = {
    name: v.name,
    display_text: v.display_text,
    cadence: v.cadence,
    // Stage-1 coaching targeting (migration 149): 'all' | 'with' | 'without'.
    coaching_scope: v.coaching_scope,
    code: v.code,
    discount_type: v.discount_type,
    percent: v.discount_type === "percent" ? v.percent : null,
    amount_ils: v.discount_type === "fixed_amount" ? v.amount_ils : null,
    amount_usd: v.discount_type === "fixed_amount" ? v.amount_usd : null,
    product: v.product,
    discounted_charges: v.discounted_charges,
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    is_active: v.is_active,
    // max_redemptions intentionally not written from the UI (removed — not
    // enforced; campaigns run by date). The DB column stays nullable/unused.
  };

  // No two overlapping active promos (spec §3.5) — only when this one is active.
  if (v.is_active) {
    try {
      await assertNoOverlap(admin, {
        id: id ?? "__new__",
        name: v.name,
        product: v.product,
        starts_at: v.starts_at,
        ends_at: v.ends_at,
      });
    } catch (e) {
      return { ok: false, error: { _root: [e instanceof Error ? e.message : String(e)] } };
    }
  }

  let savedId = id;
  if (id) {
    const { error } = await admin.from("subscription_promos").update(row).eq("id", id);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await admin.from("subscription_promos").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: { _root: [error?.message ?? "Insert failed"] } };
    savedId = data.id as string;
  }

  revalidatePath(PAGE);
  return { ok: true, id: savedId! };
}

export async function togglePromoActive(
  id: string,
  value: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "Service role not configured" };

  // Activating a draft is also a create-time event for overlap purposes.
  if (value) {
    const { data: promo, error: fErr } = await admin
      .from("subscription_promos")
      .select("id, name, product, starts_at, ends_at")
      .eq("id", id)
      .maybeSingle();
    if (fErr || !promo) return { ok: false, error: fErr?.message ?? "Promo not found" };
    try {
      await assertNoOverlap(admin, promo as { id: string; name: string; product: "journey" | "games" | "all"; starts_at: string; ends_at: string });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const { error } = await admin.from("subscription_promos").update({ is_active: value }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

export async function deletePromo(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "Service role not configured" };
  const { error } = await admin.from("subscription_promos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}
