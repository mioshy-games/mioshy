/**
 * GET /api/billing/cardcom/indicator
 *
 * Server-to-server callback from Cardcom after a payment attempt.
 * Must respond HTTP 200 quickly — heavy work happens here synchronously
 * (mioshy is on Vercel edge/serverless so we process inline, not via queue).
 *
 * Cardcom sends:  ?LowProfileCode=xxx&ReturnValue=<checkout_session_id>
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { pullLowProfileIndicator, extractToken, normalizeExpiry } from "@/lib/cardcom"
import { encryptToken, tokenHashSha256 }  from "@/lib/tokenCrypto"
import { addPlanPeriod, type Plan } from "@/lib/billing"
import { createBillingDocument }     from "@/lib/uxellent-api"
import { createAdminClient }         from "@/lib/supabase-admin"

export async function GET(req: Request) {
  const url            = new URL(req.url)
  const lowProfileCode = url.searchParams.get("LowProfileCode") ?? ""
  const returnValue    = url.searchParams.get("ReturnValue")    ?? ""   // checkout session id

  // Always respond 200 to Cardcom immediately
  if (!lowProfileCode) {
    return new Response("ok", { status: 200 })
  }

  const idempotencyKey = `lp:${lowProfileCode}`
  const admin          = await createAdminClient()

  // ── Idempotency guard ───────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("billing_events")
    .select("processed")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existing?.processed) {
    return new Response("ok", { status: 200 })
  }

  // Insert event row (ignore conflict — already handled above)
  await admin
    .from("billing_events")
    .upsert({ idempotency_key: idempotencyKey, processed: false }, { onConflict: "idempotency_key" })

  // ── Pull authoritative indicator from Cardcom ───────────────────────────────
  let indicator: Awaited<ReturnType<typeof pullLowProfileIndicator>>
  try {
    indicator = await pullLowProfileIndicator(lowProfileCode)
  } catch (err) {
    await admin.from("billing_events").update({ error: String(err) }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }

  // ── Find checkout session ───────────────────────────────────────────────────
  // Prefer ReturnValue (session id), fall back to LowProfileCode lookup
  let sessionId = returnValue.trim()
  if (!sessionId) {
    const { data: byLp } = await admin
      .from("checkout_sessions")
      .select("id")
      .eq("low_profile_code", lowProfileCode)
      .maybeSingle()
    sessionId = byLp?.id ?? ""
  }

  if (!sessionId) {
    await admin.from("billing_events").update({ error: "checkout session not found", processed: true }).eq("idempotency_key", idempotencyKey)
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

  // ── Payment failed ──────────────────────────────────────────────────────────
  if (!indicator.paid) {
    await admin
      .from("checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
    await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)
    return new Response("ok", { status: 200 })
  }

  // ── Payment successful ──────────────────────────────────────────────────────
  await admin
    .from("checkout_sessions")
    .update({
      status:      "paid",
      deal_number: indicator.dealNumber ?? null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", sessionId)

  const userId = session.user_id
  const now    = new Date()
  const periodEnd = addPlanPeriod(now, session.plan as Plan)

  // ── Store encrypted token ───────────────────────────────────────────────────
  let paymentMethodId: string | null = null
  const tokenInfo = extractToken(indicator.parsed as Record<string, string>)
  if (tokenInfo?.token && userId) {
    try {
      const tokenEnc  = encryptToken(tokenInfo.token)
      const tokenHash = tokenHashSha256(tokenInfo.token)
      const expiry    = normalizeExpiry(tokenInfo.tokenExDate)

      const { data: pm } = await admin
        .from("customer_payment_methods")
        .upsert(
          {
            user_id:     userId,
            provider:    "cardcom",
            token_enc:   tokenEnc,
            token_hash:  tokenHash,
            expiry_mmyy: expiry,
            card_brand:  tokenInfo.brand  ?? null,
            last4:       tokenInfo.cardNumEnd   ?? null,
            first6:      tokenInfo.cardNumStart ?? null,
            status:      "active",
          },
          { onConflict: "user_id,provider,token_hash" },
        )
        .select("id")
        .maybeSingle()

      paymentMethodId = pm?.id ?? null
    } catch (err) {
      console.error("[indicator] token store failed", err)
    }
  }

  // ── Create / update subscription ────────────────────────────────────────────
  let subscriptionId: string | null = null
  if (userId) {
    // Upsert: one active subscription per user
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSub?.id) {
      await admin
        .from("subscriptions")
        .update({
          status:              "active",
          plan:                session.plan,
          plan_amount:         session.amount,
          currency:            session.currency,
          coin_id:             session.coin_id,
          is_israeli:          session.is_israeli,
          vat_rate_percent:    session.vat_rate_percent,
          current_period_end:  periodEnd.toISOString(),
          next_billing_date:   periodEnd.toISOString(),
          failed_attempts:     0,
          grace_until:         null,
          checkout_session_id: session.id,
          payment_method_id:   paymentMethodId,
        })
        .eq("id", existingSub.id)
      subscriptionId = existingSub.id
    } else {
      const { data: newSub } = await admin
        .from("subscriptions")
        .insert({
          user_id:             userId,
          email:               session.email,
          status:              "active",
          plan:                session.plan,
          plan_amount:         session.amount,
          currency:            session.currency,
          coin_id:             session.coin_id,
          is_israeli:          session.is_israeli,
          vat_rate_percent:    session.vat_rate_percent,
          current_period_end:  periodEnd.toISOString(),
          next_billing_date:   periodEnd.toISOString(),
          failed_attempts:     0,
          checkout_session_id: session.id,
          payment_method_id:   paymentMethodId,
        })
        .select("id")
        .maybeSingle()
      subscriptionId = newSub?.id ?? null
    }
  }

  // ── Create invoice via uxellent API ─────────────────────────────────────────
  const invoiceResult = await createBillingDocument({
    user_id:     userId ?? "",
    email:       session.email,
    name:        session.name ?? null,
    country:     session.country_code ?? "",
    amount:      session.amount,
    currency:    session.currency,
    language:    (session.language === "he" ? "he" : "en") as "he" | "en",
    is_israeli:  session.is_israeli,
    plan:        session.plan,
    deal_number: indicator.dealNumber ?? null,
  })

  if (invoiceResult.success && subscriptionId) {
    await admin
      .from("subscriptions")
      .update({ invoice_url: invoiceResult.document_url })
      .eq("id", subscriptionId)

    // Also record on the initial charge
    if (subscriptionId && paymentMethodId) {
      await admin.from("subscription_charges").insert({
        user_id:             userId!,
        subscription_id:     subscriptionId,
        payment_method_id:   paymentMethodId,
        amount:              session.amount,
        currency:            session.currency,
        status:              "succeeded",
        uniq_asmachta:       `initial:${sessionId}`,
        billing_period_start: now.toISOString(),
        billing_period_end:   periodEnd.toISOString(),
        invoice_url:          invoiceResult.document_url,
      }).then(() => { /* ignore errors */ })
    }
  } else if (!invoiceResult.success) {
    console.error("[indicator] invoice creation failed", invoiceResult.message)
  }

  // ── Mark event as processed ─────────────────────────────────────────────────
  await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)

  return new Response("ok", { status: 200 })
}
