/**
 * lib/billing/process-trial-lowprofile.ts
 *
 * The authoritative "turn a passed J2 LowProfile into a trialing subscription"
 * routine, shared by TWO callers so the trial is created even when the Cardcom
 * webhook never arrives (Task 26, Itzik 2026-07-03 — webhooks get lost in the
 * real world too):
 *
 *   1. /api/billing/cardcom/trial-indicator  — the Cardcom v11 webhook.
 *   2. /api/billing/trial/reconcile          — called inline from the success
 *      page when the poll doesn't see 'paid' in time.
 *
 * Idempotent via billing_events (key `trial:<lowProfileId>`): whichever caller
 * runs first creates the subscription; the other short-circuits. No charge and
 * no invoice happen here — the FIRST real charge is day 7 (renewals cron).
 *
 * NEVER trusts a callback body: the result is pulled server-side via
 * getTrialLpResult(lowProfileId).
 */

import { getTrialLpResult, normalizeExpiry } from "@/lib/cardcom"
import { encryptToken, tokenHashSha256 }     from "@/lib/tokenCrypto"
import { createAdminClient }                 from "@/lib/supabase-admin"
import { assignJourneyOnPurchase }           from "@/lib/journey-content/auto-assign"
import type { JourneyProductSlug }           from "@/lib/journey-content/types"

const TRIAL_DAYS = 7

function normalizeProduct(raw: unknown): JourneyProductSlug {
  if (raw === "games" || raw === "adults") return raw
  return "journey"
}

export type TrialProcessStatus =
  | "created"        // subscription created/reactivated this run
  | "already"        // idempotent — a prior run already processed this LP
  | "validation_failed"
  | "abuse_blocked"
  | "no_session"
  | "not_a_trial"
  | "no_user"
  | "pull_failed"
  | "token_store_failed"
  | "sub_write_failed"

export interface TrialProcessResult {
  status: TrialProcessStatus
  sessionId?: string
  subscriptionId?: string | null
  /** True when access now exists (created OR already processed a success). */
  ok: boolean
}

/**
 * Process a (presumed-passed) trial LowProfile into a trialing subscription.
 * `returnValue` is the checkout session id echoed by Cardcom (optional — we
 * fall back to looking the session up by low_profile_code).
 */
export async function processTrialLowProfile(args: {
  lowProfileId: string
  returnValue?: string
}): Promise<TrialProcessResult> {
  const { lowProfileId } = args
  const returnValue = args.returnValue ?? ""
  const admin = await createAdminClient()
  const idempotencyKey = `trial:${lowProfileId}`

  // ── Idempotency guard ─────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("billing_events")
    .select("id, processed")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (existing?.processed) {
    console.log("[trial-process:IDEMPOTENT_SKIP]", { idempotencyKey })
    return { status: "already", ok: true }
  }
  await admin
    .from("billing_events")
    .upsert({ idempotency_key: idempotencyKey, processed: false }, { onConflict: "idempotency_key" })

  // ── Resolve checkout session ──────────────────────────────────────────────
  let sessionId = returnValue.trim()
  if (!sessionId) {
    const { data: byLp } = await admin
      .from("checkout_sessions")
      .select("id")
      .eq("low_profile_code", lowProfileId)
      .maybeSingle()
    sessionId = byLp?.id ?? ""
  }
  if (!sessionId) {
    await admin.from("billing_events").update({ error: "session not found", processed: true }).eq("idempotency_key", idempotencyKey)
    return { status: "no_session", ok: false }
  }

  const { data: session } = await admin
    .from("checkout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle()
  if (!session) {
    await admin.from("billing_events").update({ error: `session ${sessionId} missing`, processed: true }).eq("idempotency_key", idempotencyKey)
    return { status: "no_session", ok: false }
  }
  if (!session.is_trial) {
    console.error("[trial-process:NOT_A_TRIAL] session is not a trial — refusing", { session_id: sessionId })
    await admin.from("billing_events").update({ error: "not a trial session", processed: true }).eq("idempotency_key", idempotencyKey)
    return { status: "not_a_trial", sessionId, ok: false }
  }

  // ── Pull authoritative v11 result ─────────────────────────────────────────
  let result: Awaited<ReturnType<typeof getTrialLpResult>>
  try {
    result = await getTrialLpResult(lowProfileId)
  } catch (err) {
    console.error("[trial-process:PULL_FAILED]", err)
    // Leave processed=false so a later run (webhook OR reconcile) can retry.
    await admin.from("billing_events").update({ error: String(err) }).eq("idempotency_key", idempotencyKey)
    return { status: "pull_failed", sessionId, ok: false }
  }

  const userId = session.user_id as string | null

  if (!result.validated || !result.token) {
    console.warn("[trial-process:VALIDATION_FAILED] no trial created", {
      session_id: sessionId, response_code: result.responseCode, has_token: !!result.token,
    })
    await admin.from("checkout_sessions").update({ status: "failed", failure_reason: "validation_failed", updated_at: new Date().toISOString() }).eq("id", sessionId)
    await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)
    return { status: "validation_failed", sessionId, ok: false }
  }

  if (!userId) {
    console.error("[trial-process:NO_USER] session has no user_id", { session_id: sessionId })
    await admin.from("billing_events").update({ error: "no user_id", processed: true }).eq("idempotency_key", idempotencyKey)
    return { status: "no_user", sessionId, ok: false }
  }

  const now      = new Date()
  const product  = normalizeProduct(session.product)
  const coaching = session.coaching ?? (product === "journey")
  const expiry   = normalizeExpiry(result.tokenExDate)

  // ── Card fingerprint (abuse guard #2) ─────────────────────────────────────
  const fpBasis = `${result.first6 ?? ""}|${result.last4 ?? ""}|${expiry ?? ""}`
  const cardFingerprint =
    result.first6 || result.last4
      ? tokenHashSha256(fpBasis)
      : tokenHashSha256(`tok:${result.token}`)

  // Task 26 (Itzik 2026-07-03): the one-trial-per-card guard blocks repeat E2E
  // testing on Preview (same QA card → "trial already used", no trialing row).
  // Skip it when NOT production; prod keeps the guard. Mirrors the account-guard
  // skip in create-trial.
  const isProdEnv = process.env.VERCEL_ENV === "production"
  if (isProdEnv) {
    const { data: dupe } = await admin
      .from("trial_redemptions")
      .select("id")
      .or(`user_id.eq.${userId},card_fingerprint.eq.${cardFingerprint}`)
      .limit(1)
      .maybeSingle()
    if (dupe?.id) {
      console.warn("[trial-process:ABUSE_BLOCK] account or card already used a trial", { session_id: sessionId })
      await admin.from("checkout_sessions").update({ status: "failed", failure_reason: "trial_already_used", updated_at: new Date().toISOString() }).eq("id", sessionId)
      await admin.from("billing_events").update({ error: "trial already used (fingerprint/account)", processed: true }).eq("idempotency_key", idempotencyKey)
      return { status: "abuse_blocked", sessionId, ok: false }
    }
  }

  // ── Store token (encrypted) ───────────────────────────────────────────────
  let paymentMethodId: string | null = null
  try {
    const { data: pm } = await admin
      .from("customer_payment_methods")
      .upsert(
        {
          user_id:     userId,
          provider:    "cardcom",
          token_enc:   encryptToken(result.token),
          token_hash:  tokenHashSha256(result.token),
          expiry_mmyy: expiry,
          card_brand:  result.brand  ?? null,
          last4:       result.last4  ?? null,
          first6:      result.first6 ?? null,
          status:      "active",
        },
        { onConflict: "user_id,provider,token_hash" },
      )
      .select("id")
      .maybeSingle()
    paymentMethodId = pm?.id ?? null
  } catch (err) {
    console.error("[trial-process:TOKEN_STORE_FAILED]", err)
    await admin.from("billing_events").update({ error: `token store: ${String(err)}` }).eq("idempotency_key", idempotencyKey)
    return { status: "token_store_failed", sessionId, ok: false }
  }

  // ── Snapshot & trial window ───────────────────────────────────────────────
  const fullPlanAmount = session.original_amount ?? session.amount
  let promoFields: { promo_id: string | null; intro_amount: number | null; intro_charges_remaining: number } = {
    promo_id: null, intro_amount: null, intro_charges_remaining: 0,
  }
  if (session.promo_id) {
    try {
      const { data: promoRow } = await admin
        .from("subscription_promos")
        .select("discounted_charges")
        .eq("id", session.promo_id)
        .maybeSingle()
      const charges = (promoRow as { discounted_charges?: number } | null)?.discounted_charges ?? 1
      promoFields = {
        promo_id: session.promo_id,
        intro_amount: session.amount,
        intro_charges_remaining: Math.max(0, charges),
      }
    } catch (err) {
      console.error("[trial-process:PROMO_LOCK_FAILED] full price, no intro", err)
    }
  }

  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000)

  // ── Create (or reactivate) the trialing subscription ──────────────────────
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("product", product)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const subFields = {
    status:              "trialing" as const,
    plan:                session.plan,
    plan_amount:         fullPlanAmount,
    coaching,
    ...promoFields,
    currency:            session.currency,
    coin_id:             session.coin_id,
    is_israeli:          session.is_israeli,
    vat_rate_percent:    session.vat_rate_percent,
    trial_ends_at:       trialEndsAt.toISOString(),
    current_period_end:  trialEndsAt.toISOString(),
    next_billing_date:   trialEndsAt.toISOString(),
    failed_attempts:     0,
    grace_until:         null,
    journey_grace_until: null,
    journey_blocked_at:  null,
    checkout_session_id: session.id,
    payment_method_id:   paymentMethodId,
  }

  let subscriptionId: string | null = null
  if (existingSub?.id) {
    const { error: updErr } = await admin.from("subscriptions").update(subFields).eq("id", existingSub.id)
    if (updErr) {
      console.error("[trial-process:SUB_UPDATE_FAILED]", { session_id: sessionId, user_id: userId, error: updErr.message })
      await admin.from("billing_events").update({ error: `sub update: ${updErr.message}` }).eq("idempotency_key", idempotencyKey)
      return { status: "sub_write_failed", sessionId, ok: false }
    }
    subscriptionId = existingSub.id
  } else {
    const { data: ins, error: insErr } = await admin
      .from("subscriptions")
      .insert({ user_id: userId, email: session.email, product, ...subFields })
      .select("id")
      .maybeSingle()
    if (insErr || !ins?.id) {
      console.error("[trial-process:SUB_INSERT_FAILED]", { session_id: sessionId, user_id: userId, error: insErr?.message ?? "no row returned" })
      await admin.from("billing_events").update({ error: `sub insert: ${insErr?.message ?? "no row"}` }).eq("idempotency_key", idempotencyKey)
      return { status: "sub_write_failed", sessionId, ok: false }
    }
    subscriptionId = ins.id
  }

  // ── Record the trial redemption (abuse ledger) ────────────────────────────
  await admin.from("trial_redemptions").insert({
    user_id: userId, card_fingerprint: cardFingerprint, product, coaching, subscription_id: subscriptionId,
  })

  // ── Mark session paid + ensure couple + assign journey content ────────────
  await admin.from("checkout_sessions").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", sessionId)

  try {
    await admin.rpc("ensure_couple_for_user", { p_user_id: userId })
  } catch (err) {
    console.error("[trial-process] couple ensure threw", err)
  }

  try {
    const r = await assignJourneyOnPurchase({ userId, product, purchasedAt: now, checkoutSessionId: sessionId, supabase: admin })
    if (!r.ok) console.error("[trial-process] auto-assign failed", r.reason)
  } catch (err) {
    console.error("[trial-process] auto-assign threw", err)
  }

  await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)

  console.log("[trial-process:DONE]", {
    session_id: sessionId, subscription_id: subscriptionId, product, coaching,
    trial_ends_at: trialEndsAt.toISOString(), post_trial_full_amount: fullPlanAmount,
    intro_amount: promoFields.intro_amount, note: "NO charge — first charge day 7",
  })

  return { status: "created", sessionId, subscriptionId, ok: true }
}
