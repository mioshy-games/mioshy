"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCompleteProfile } from "@/lib/auth/profile-gate";
import {
  isAdminBypassUser,
  BYPASS_ENTITLEMENT_SOURCE,
} from "@/lib/auth/admin-bypass";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

// ---------------------------------------------------------------------------
// createCoupleForSelf - calls RPC that makes a couple + adds caller as owner
// Idempotent: returns existing couple if already a member.
// ---------------------------------------------------------------------------
export async function createCoupleForSelf(
  displayName?: string,
): Promise<Ok<{ couple_id: string; pair_code: string }> | Err> {
  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const { data: coupleId, error } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: displayName ?? null },
  );
  if (error || !coupleId) {
    return {
      ok: false,
      error: error?.message ?? "Could not create couple",
    };
  }

  const { data: couple } = await supabase
    .from("couples")
    .select("pair_code")
    .eq("id", coupleId as string)
    .maybeSingle();

  revalidatePath("/[locale]/between-us", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");

  return {
    ok: true,
    couple_id: coupleId as string,
    pair_code: couple?.pair_code ?? "",
  };
}

// ---------------------------------------------------------------------------
// joinCoupleByPairCode - partner enters the 6-char code to link accounts
// ---------------------------------------------------------------------------
export async function joinCoupleByPairCode(
  pairCode: string,
): Promise<Ok<{ couple_id: string }> | Err> {
  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const normalized = pairCode.trim().toUpperCase();
  if (normalized.length !== 6) {
    return { ok: false, error: "Pair code must be 6 characters" };
  }

  const { data: coupleId, error } = await supabase.rpc(
    "join_couple_by_pair_code",
    { p_pair_code: normalized },
  );
  if (error || !coupleId) {
    const msg = error?.message ?? "";
    const friendly = msg.includes("pair_code not found")
      ? "Pair code not found"
      : msg.includes("already belongs")
        ? "You're already in a couple"
        : msg.includes("already a member")
          ? "You're already a member of this couple"
          : msg || "Could not join couple";
    return { ok: false, error: friendly };
  }

  revalidatePath("/[locale]/between-us", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");

  return { ok: true, couple_id: coupleId as string };
}

// ---------------------------------------------------------------------------
// startAdultsSinglePurchase - entry point for the Adults BUY button.
// ---------------------------------------------------------------------------
// Branches on the caller's identity:
//
// (1) ADMIN BYPASS  - emails listed in lib/auth/admin-bypass.ts skip Cardcom
//     entirely. We grant a couple_entitlement immediately with
//     source='admin_bypass' so the team can replay the full purchase →
//     pair-code → partner-redeem journey without test charges. The bypass
//     is server-side and double-checked (never trust a client header).
//
// (2) REAL PURCHASE - every other user is sent through the real Cardcom
//     LowProfile checkout. We POST to /api/billing/checkout/create with
//     purchase_type='one_time' and target_game_id=<gameId>. The endpoint
//     opens the Cardcom session, persists a checkout_sessions row, and
//     returns { redirect_url }. The caller (AdultsHeroBuy) hard-navigates
//     to that URL. After successful payment, the indicator webhook
//     branches on purchase_type and writes a couple_entitlement with
//     source='paid'. PERMANENT entry (per spec: an Adults game stays
//     unlocked even if Journey is later cancelled).
//
// Both branches end at the same place: the buyer's couple owns the game,
// the user is bounced back to /[locale]/adults/[slug] (entitled state, pair
// code visible). The two branches differ only in *how* we got there.
// ---------------------------------------------------------------------------
export async function startAdultsSinglePurchase({
  gameId,
  locale,
  returnPath,
}: {
  gameId: string;
  /** UI locale, used to build the post-payment return URL. */
  locale: string;
  /** Path the buyer should land on after Cardcom finishes - typically the
   *  product page itself so the entitled state renders with the pair code. */
  returnPath: string;
}): Promise<
  | Ok<{ couple_id: string; entitlement_id: string; bypassed: true }>
  | Ok<{ checkout_session_id: string; redirect_url: string; bypassed: false }>
  | Err
> {
  if (!gameId) return { ok: false, error: "missing gameId" };

  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  // Verify the game exists + is active before doing anything else. Both
  // branches need this - the bypass branch to write a meaningful row, the
  // Cardcom branch to know what amount to charge.
  const { data: game } = await supabase
    .from("experience_games")
    .select("id, slug, is_active, price_ils, price_usd")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || !game.is_active) {
    return { ok: false, error: "game_unavailable" };
  }

  // ── Branch 1: admin bypass ────────────────────────────────────────────
  if (isAdminBypassUser(user)) {
    console.log(
      "[adults:purchase] admin bypass invoked",
      JSON.stringify({
        user_id: user.id,
        email:   user.email ?? null,
        game_id: gameId,
        slug:    game.slug,
      }),
    );
    return await grantBypassedEntitlement({
      userId: user.id,
      gameId,
      gamePriceIls: (game.price_ils as number | null) ?? null,
      gamePriceUsd: (game.price_usd as number | null) ?? null,
    });
  }

  // ── Branch 2: real Cardcom checkout ───────────────────────────────────
  // We call our own /api/billing/checkout/create endpoint via fetch so the
  // existing Cardcom plumbing (checkout_sessions row, openLowProfile,
  // indicator webhook) is reused untouched. The endpoint reads the
  // authenticated user from the cookie that we forward via headers().
  const h = await headers();
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${h.get("host") ?? "mioshy.com"}`;

  // Cookie passthrough so the checkout endpoint sees the same Supabase auth
  // session this server action is running under.
  const cookieHeader = h.get("cookie") ?? "";

  const checkoutBody = {
    email: user.email ?? "",
    plan: "one_time",
    product: "adults",
    purchase_type: "one_time",
    target_game_id: gameId,
    language: locale === "he" ? "he" : "en",
    is_israeli: locale === "he",
    return_path: returnPath,
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/billing/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify(checkoutBody),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[startAdultsSinglePurchase] fetch failed", err);
    return { ok: false, error: "checkout_unreachable" };
  }

  const json = (await res.json().catch(() => null)) as
    | { success: true; checkout_session_id: string; redirect_url: string }
    | { success: false; code: string; message: string }
    | null;

  if (!res.ok || !json || !("success" in json) || !json.success) {
    const code =
      json && !("success" in json && json.success) && "code" in json
        ? json.code
        : `http_${res.status}`;
    console.error("[startAdultsSinglePurchase] checkout endpoint error", code);
    return { ok: false, error: code };
  }

  console.log(
    "[adults:purchase] cardcom session opened",
    JSON.stringify({
      user_id:             user.id,
      game_id:              gameId,
      slug:                 game.slug,
      checkout_session_id:  json.checkout_session_id,
      amount_ils:           game.price_ils ?? null,
      amount_usd:           game.price_usd ?? null,
    }),
  );

  return {
    ok: true,
    checkout_session_id: json.checkout_session_id,
    redirect_url: json.redirect_url,
    bypassed: false,
  };
}

/**
 * Grants the couple_entitlement directly without a Cardcom round-trip.
 * Used by the admin bypass branch above; also reused by future internal
 * tooling (manual comp grants, customer support).
 */
async function grantBypassedEntitlement({
  userId,
  gameId,
  gamePriceIls,
  gamePriceUsd,
}: {
  userId: string;
  gameId: string;
  gamePriceIls: number | null;
  gamePriceUsd: number | null;
}): Promise<
  | Ok<{ couple_id: string; entitlement_id: string; bypassed: true }>
  | Err
> {
  const supabase = await createServerSupabaseClient();

  // Ensure couple exists (idempotent)
  const { data: coupleIdResp, error: rpcErr } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: null },
  );
  if (rpcErr || !coupleIdResp) {
    return {
      ok: false,
      error: rpcErr?.message ?? "couple_creation_failed",
    };
  }
  const coupleId = coupleIdResp as string;

  // Idempotent: if already entitled, just return the existing row.
  const { data: existing } = await supabase
    .from("couple_entitlements")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("game_id", gameId)
    .maybeSingle();
  if (existing?.id) {
    console.log(
      "[adults:purchase:bypass] entitlement already existed (idempotent)",
      JSON.stringify({
        user_id:        userId,
        game_id:        gameId,
        couple_id:      coupleId,
        entitlement_id: existing.id,
      }),
    );
    return {
      ok: true,
      couple_id: coupleId,
      entitlement_id: existing.id as string,
      bypassed: true,
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: inserted, error: insErr } = await admin
    .from("couple_entitlements")
    .insert({
      couple_id: coupleId,
      game_id: gameId,
      source: BYPASS_ENTITLEMENT_SOURCE,
      acquired_by_user_id: userId,
      price_paid: gamePriceIls ?? gamePriceUsd ?? null,
      currency:
        gamePriceIls != null
          ? "ILS"
          : gamePriceUsd != null
            ? "USD"
            : null,
      notes: "Admin bypass - no real charge processed",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "entitlement_insert_failed",
    };
  }

  revalidatePath("/[locale]/adults", "page");
  revalidatePath("/[locale]/adults/[slug]", "page");

  console.log(
    "[adults:purchase:bypass] entitlement created",
    JSON.stringify({
      user_id:        userId,
      game_id:        gameId,
      couple_id:      coupleId,
      entitlement_id: inserted.id,
      source:         BYPASS_ENTITLEMENT_SOURCE,
    }),
  );

  return {
    ok: true,
    couple_id: coupleId,
    entitlement_id: inserted.id as string,
    bypassed: true,
  };
}

// ---------------------------------------------------------------------------
// stubPurchaseGame - DEPRECATED. Kept temporarily for any caller that still
// references it; new code must use startAdultsSinglePurchase. Will be
// removed after a grep confirms no external callers remain.
// ---------------------------------------------------------------------------
export async function stubPurchaseGame(
  gameId: string,
): Promise<
  | Ok<{ couple_id: string; entitlement_id: string; already_owned: boolean }>
  | Err
> {
  if (!gameId) return { ok: false, error: "missing gameId" };

  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  // Ensure couple exists (idempotent)
  const { data: coupleIdResp, error: rpcErr } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: null },
  );
  if (rpcErr || !coupleIdResp) {
    return {
      ok: false,
      error: rpcErr?.message ?? "Could not establish couple",
    };
  }
  const coupleId = coupleIdResp as string;

  // Already entitled? Idempotent fast path.
  const { data: existing } = await supabase
    .from("couple_entitlements")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("game_id", gameId)
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: true,
      couple_id: coupleId,
      entitlement_id: existing.id as string,
      already_owned: true,
    };
  }

  // Verify the game exists + is active; reject otherwise
  const { data: game } = await supabase
    .from("experience_games")
    .select("id, is_active, price_ils, price_usd")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || !game.is_active) {
    return { ok: false, error: "Game is not available" };
  }

  // Insert entitlement via service-role client (RLS admin-only for INSERT)
  const admin = createAdminSupabaseClient();
  const { data: inserted, error: insErr } = await admin
    .from("couple_entitlements")
    .insert({
      couple_id: coupleId,
      game_id: gameId,
      source: "admin_grant",
      acquired_by_user_id: user.id,
      price_paid: game.price_ils ?? game.price_usd ?? null,
      currency: game.price_ils != null ? "ILS" : game.price_usd != null ? "USD" : null,
      notes: "Stub grant - Cardcom billing not yet integrated",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "Could not grant entitlement",
    };
  }

  revalidatePath("/[locale]/between-us", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");

  return {
    ok: true,
    couple_id: coupleId,
    entitlement_id: inserted.id as string,
    already_owned: false,
  };
}

// ---------------------------------------------------------------------------
// leaveCouple - unlinks the current user from their couple. If they were
// the only member, also deactivates the couple.
// ---------------------------------------------------------------------------
export async function leaveCouple(): Promise<Ok<object> | Err> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { ok: false, error: "Not a member of any couple" };
  }

  const coupleId = membership.couple_id as string;

  const { error: delErr } = await supabase
    .from("couple_members")
    .delete()
    .eq("user_id", user.id)
    .eq("couple_id", coupleId);
  if (delErr) return { ok: false, error: delErr.message };

  // If no members remain, deactivate the couple
  const { count } = await supabase
    .from("couple_members")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", coupleId);
  if ((count ?? 0) === 0) {
    const admin = createAdminSupabaseClient();
    await admin
      .from("couples")
      .update({ is_active: false })
      .eq("id", coupleId);
  }

  revalidatePath("/[locale]/between-us", "page");
  return { ok: true };
}
