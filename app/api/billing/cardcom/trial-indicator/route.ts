/**
 * /api/billing/cardcom/trial-indicator   (GET and POST)
 *
 * Cardcom v11 webhook for the 7-day trial ONLY. SEPARATE from the standard
 * /api/billing/cardcom/indicator (old interface, charges — untouched).
 *
 * The card was tokenized + validated via J2 (NO charge, NO hold). This handler:
 *   1. pulls the authoritative v11 result (never trusts the callback body),
 *   2. on J2 pass → stores the token, records a trial_redemption (abuse
 *      fingerprint), and creates a `trialing` subscription with trial_ends_at =
 *      now + 7d and the price/promo SNAPSHOT from the checkout session,
 *   3. on J2 fail OR abuse-fingerprint match → does NOT create a trial.
 *
 * No charge and no invoice happen here — the FIRST real charge is made on day 7
 * by /api/billing/renewals/run.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getTrialLpResult, normalizeExpiry } from "@/lib/cardcom"
import { encryptToken, tokenHashSha256 }     from "@/lib/tokenCrypto"
import { createAdminClient }                 from "@/lib/supabase-admin"
import { assignJourneyOnPurchase }           from "@/lib/journey-content/auto-assign"
import type { JourneyProductSlug }           from "@/lib/journey-content/types"
import { checkRateLimit, getClientIp }       from "@/lib/rate-limit"

const TRIAL_DAYS = 7

function normalizeProduct(raw: unknown): JourneyProductSlug {
  if (raw === "games" || raw === "adults") return raw
  return "journey"
}

/**
 * Extract LowProfileId + ReturnValue from a v11 webhook regardless of how
 * Cardcom delivers them (query string on GET, or JSON/form body on POST),
 * case-insensitively. We only use these two identifiers; the authoritative
 * result is pulled server-side via getTrialLpResult().
 */
async function extractIds(req: Request): Promise<{ lowProfileId: string; returnValue: string }> {
  const out = { lowProfileId: "", returnValue: "" }
  const pick = (k: string, v: string) => {
    const key = k.toLowerCase()
    if (!v) return
    if (key === "lowprofileid") out.lowProfileId = out.lowProfileId || v
    if (key === "returnvalue")  out.returnValue  = out.returnValue  || v
  }

  try {
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) pick(k, v)
  } catch { /* ignore */ }

  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || ""
    try {
      if (ct.includes("application/json")) {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === "string" || typeof v === "number") pick(k, String(v))
        }
      } else {
        const text = await req.text()
        new URLSearchParams(text).forEach((v, k) => pick(k, v))
      }
    } catch { /* ignore */ }
  }
  return out
}

async function handle(req: Request): Promise<Response> {
  // Rate limit (same posture as the standard indicator).
  const ip = getClientIp(req)
  const { ok: rlOk, retryAfterSec } = checkRateLimit(`trial-indicator:${ip}`, 10, 60)
  if (!rlOk) {
    return new Response("ok", { status: 200, headers: { "Retry-After": String(retryAfterSec) } })
  }

  const { lowProfileId, returnValue } = await extractIds(req)
  console.log("[trial-indicator:START]", {
    has_lp: !!lowProfileId,
    return_value: returnValue || "(empty)",
    method: req.method,
  })

  // Always respond 200 to Cardcom.
  if (!lowProfileId) {
    console.warn("[trial-indicator:NO_ID] missing LowProfileId")
    return new Response("ok", { status: 200 })
  }

  const admin          = await createAdminClient()
  const idempotencyKey = `trial:${lowProfileId}`

  // ── Idempotency guard ───────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("billing_events")
    .select("id, processed")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (existing?.processed) {
    console.log("[trial-indicator:IDEMPOTENT_SKIP]", { idempotencyKey })
    return new Response("ok", { status: 200 })
  }
  await admin
    .from("billing_events")
    .upsert({ idempotency_key: idempotencyKey, processed: false }, { onConflict: "idempotency_key" })

  // ── Resolve checkout session ────────────────────────────────────────────────
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
    return new Response("ok", { status: 200 })
  }

  const { data: session } = await admin
    .from("checkout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle()
  if (!session) {
    await admin.from("billing_events").update({ error: `session ${sessionId} missing`, processed: true }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }
  if (!session.is_trial) {
    // Safety: a non-trial session must never be processed by this handler.
    console.error("[trial-indicator:NOT_A_TRIAL] session is not a trial — refusing", { session_id: sessionId })
    await admin.from("billing_events").update({ error: "not a trial session", processed: true }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }

  // ── Pull authoritative v11 result ───────────────────────────────────────────
  let result: Awaited<ReturnType<typeof getTrialLpResult>>
  try {
    result = await getTrialLpResult(lowProfileId)
  } catch (err) {
    console.error("[trial-indicator:PULL_FAILED]", err)
    await admin.from("billing_events").update({ error: String(err) }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })   // let Cardcom retry
  }

  const userId = session.user_id as string | null

  // ── J2 validation failed OR no token → no trial ─────────────────────────────
  if (!result.validated || !result.token) {
    console.warn("[trial-indicator:VALIDATION_FAILED] no trial created", {
      session_id: sessionId,
      response_code: result.responseCode,
      has_token: !!result.token,
    })
    await admin
      .from("checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
    await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }

  if (!userId) {
    console.error("[trial-indicator:NO_USER] session has no user_id", { session_id: sessionId })
    await admin.from("billing_events").update({ error: "no user_id", processed: true }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }

  const now      = new Date()
  const product  = normalizeProduct(session.product)
  const coaching = session.coaching ?? (product === "journey")
  const expiry   = normalizeExpiry(result.tokenExDate)

  // ── Card fingerprint (abuse guard #2) ───────────────────────────────────────
  // sha256(first6 + last4 + expiry). Cardcom tokens aren't stable across
  // tokenizations, so we fingerprint the card. If digits are unavailable for
  // this token-only op, fall back to the token hash (still a stable per-card
  // signal for THIS terminal). The account guard already ran in create-trial.
  const fpBasis = `${result.first6 ?? ""}|${result.last4 ?? ""}|${expiry ?? ""}`
  const cardFingerprint =
    result.first6 || result.last4
      ? tokenHashSha256(fpBasis)
      : tokenHashSha256(`tok:${result.token}`)

  {
    const { data: dupe } = await admin
      .from("trial_redemptions")
      .select("id")
      .or(`user_id.eq.${userId},card_fingerprint.eq.${cardFingerprint}`)
      .limit(1)
      .maybeSingle()
    if (dupe?.id) {
      console.warn("[trial-indicator:ABUSE_BLOCK] account or card already used a trial", {
        session_id: sessionId,
        user_id8: userId.slice(0, 8),
      })
      await admin
        .from("checkout_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
      await admin.from("billing_events").update({ error: "trial already used (fingerprint/account)", processed: true }).eq("idempotency_key", idempotencyKey)
      return new Response("ok", { status: 200 })
    }
  }

  // ── Store token (encrypted) ─────────────────────────────────────────────────
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
    console.error("[trial-indicator:TOKEN_STORE_FAILED]", err)
    await admin.from("billing_events").update({ error: `token store: ${String(err)}` }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })   // retry
  }

  // ── Snapshot & trial window ─────────────────────────────────────────────────
  // plan_amount = FULL price (renewals after the intro are full). When the
  // checkout carried a promo, intro_amount/intro_charges_remaining make the
  // day-7 charge (and following intro renewals) use the promo price — even if
  // the promo has since ended. Mirrors the standard indicator's promo lock.
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
        // No charge was consumed at signup (unlike the paid flow), so the FULL
        // discounted-charge count applies starting from the day-7 charge.
        intro_charges_remaining: Math.max(0, charges),
      }
    } catch (err) {
      console.error("[trial-indicator:PROMO_LOCK_FAILED] full price, no intro", err)
    }
  }

  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000)

  // ── Create (or reactivate) the trialing subscription ────────────────────────
  // Scope on (user, product), matching the standard indicator. A user with a
  // prior cancelled/expired sub for this product can start a trial (the
  // create-trial route blocks active/trialing dupes and prior trial usage).
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
    // On day 7 the cron treats current_period_end as the period start.
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
    await admin.from("subscriptions").update(subFields).eq("id", existingSub.id)
    subscriptionId = existingSub.id
  } else {
    const { data: ins } = await admin
      .from("subscriptions")
      .insert({ user_id: userId, email: session.email, product, ...subFields })
      .select("id")
      .maybeSingle()
    subscriptionId = ins?.id ?? null
  }

  // ── Record the trial redemption (abuse ledger) ──────────────────────────────
  await admin.from("trial_redemptions").insert({
    user_id: userId,
    card_fingerprint: cardFingerprint,
    product,
    coaching,
    subscription_id: subscriptionId,
  })

  // ── Mark session + ensure couple + assign journey content ───────────────────
  await admin
    .from("checkout_sessions")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  try {
    await admin.rpc("ensure_couple_for_user", { p_user_id: userId })
  } catch (err) {
    console.error("[trial-indicator] couple ensure threw", err)
  }

  try {
    const r = await assignJourneyOnPurchase({
      userId, product, purchasedAt: now, checkoutSessionId: sessionId, supabase: admin,
    })
    if (!r.ok) console.error("[trial-indicator] auto-assign failed", r.reason)
  } catch (err) {
    console.error("[trial-indicator] auto-assign threw", err)
  }

  await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)

  console.log("[trial-indicator:DONE]", {
    session_id: sessionId,
    subscription_id: subscriptionId,
    product,
    coaching,
    trial_ends_at: trialEndsAt.toISOString(),
    post_trial_full_amount: fullPlanAmount,
    intro_amount: promoFields.intro_amount,
    note: "NO charge made — first charge on day 7 via renewals cron",
  })

  return new Response("ok", { status: 200 })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
