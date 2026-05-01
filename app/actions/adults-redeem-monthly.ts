"use server";

/**
 * app/actions/adults-redeem-monthly.ts
 *
 * Redeems the user's monthly bundled Adults game (per spec §8.4).
 *
 * Steps:
 *   1. Verify the caller is signed in.
 *   2. Verify they have an active Journey subscription with an
 *      AVAILABLE monthly slot (not consumed this calendar month).
 *   3. Verify the requested game exists and isn't already entitled
 *      to the user's couple.
 *   4. INSERT a `couple_entitlements` row with source='monthly_bundle'.
 *   5. Mark the slot as consumed via `consumeAdultsMonthlySlot()`.
 *   6. Return ok so the UI can re-render with the game unlocked.
 *
 * Race conditions:
 *   We deliberately don't wrap steps 4+5 in a transaction. If the
 *   entitlement insert succeeds but the slot stamp fails, the user
 *   keeps the game and might (very briefly, on race) get a SECOND
 *   game this month. We accept that vs. the alternative — a stamp
 *   that fires without the entitlement existing, which would lock
 *   the user out of their bundle for the whole month. Belt-and-
 *   suspenders fix can come later if it becomes a real issue.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  getAdultsMonthlyStatus,
  consumeAdultsMonthlySlot,
} from "@/lib/entitlements/adults-monthly";

const InputSchema = z.object({
  game_id: z.string().uuid(),
});

export type RedeemResult =
  | { ok: true; entitlement_id: string }
  | { ok: false; error: string };

export async function redeemAdultsMonthly(
  raw: z.input<typeof InputSchema>,
): Promise<RedeemResult> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // ── Validate ────────────────────────────────────────────────────────────
  const parse = InputSchema.safeParse(raw);
  if (!parse.success) return { ok: false, error: "invalid_game_id" };
  const { game_id } = parse.data;

  // ── Slot availability ──────────────────────────────────────────────────
  const status = await getAdultsMonthlyStatus(user.id);
  if (!status.has_bundle_subscription) {
    return { ok: false, error: "no_journey_subscription" };
  }
  if (!status.available) {
    return { ok: false, error: "monthly_slot_consumed" };
  }

  // ── Resolve couple (entitlements live at couple level) ────────────────
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  const { data: coupleIdResp, error: coupleErr } = await admin.rpc(
    "ensure_couple_for_user",
    { p_user_id: user.id },
  );
  if (coupleErr || !coupleIdResp) {
    return { ok: false, error: coupleErr?.message ?? "couple_unavailable" };
  }
  const coupleId = coupleIdResp as string;

  // ── Idempotency: if already entitled, treat as success ─────────────────
  const { data: existing } = await admin
    .from("couple_entitlements")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("game_id", game_id)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, entitlement_id: existing.id };
  }

  // ── Verify game exists and is active ───────────────────────────────────
  const { data: game } = await admin
    .from("experience_games")
    .select("id, is_active")
    .eq("id", game_id)
    .maybeSingle();
  if (!game || !game.is_active) {
    return { ok: false, error: "game_unavailable" };
  }

  // ── Insert entitlement + consume slot ──────────────────────────────────
  const { data: inserted, error: insErr } = await admin
    .from("couple_entitlements")
    .insert({
      couple_id: coupleId,
      game_id,
      source: "monthly_bundle",
      acquired_by_user_id: user.id,
      price_paid: 0,
      currency: "ILS",
      notes: "Journey monthly Adults bundle",
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return {
      ok: false,
      error: insErr?.message ?? "entitlement_insert_failed",
    };
  }

  const consumed = await consumeAdultsMonthlySlot(user.id);
  if (!consumed) {
    // Soft warning — user got the game; we just couldn't stamp the slot.
    console.error(
      "[adults-redeem-monthly] slot stamp failed (game still granted)",
      { user_id: user.id, entitlement_id: inserted.id },
    );
  }

  revalidatePath("/[locale]/my/adults", "page");
  revalidatePath("/[locale]/my", "page");

  return { ok: true, entitlement_id: inserted.id };
}
