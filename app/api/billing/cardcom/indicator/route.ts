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
import { assignJourneyOnPurchase }   from "@/lib/journey-content/auto-assign"
import type { JourneyProductSlug }   from "@/lib/journey-content/types"

/** Narrow the free-form checkout_sessions.product to the pillar union. */
function normalizeProduct(raw: unknown): JourneyProductSlug {
  if (raw === "games" || raw === "adults") return raw
  // Anything else — NULL, unknown strings, or legacy 'journey' — maps to
  // 'journey'. Migration 036 backfilled historical rows this way.
  return "journey"
}

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
  const purchaseType: "subscription" | "one_time" =
    session.purchase_type === "one_time" ? "one_time" : "subscription"

  console.log(
    "[indicator] payment success",
    JSON.stringify({
      session_id:     sessionId,
      user_id:        userId,
      product:        session.product,
      purchase_type:  purchaseType,
      plan:           session.plan,
      amount:         session.amount,
      currency:       session.currency,
      target_game_id: session.target_game_id ?? null,
      deal_number:    indicator.dealNumber ?? null,
    }),
  )

  // For subscription flows we still compute periodEnd from the plan; for
  // one-time buys it stays unused (no recurrence to schedule).
  const periodEnd = purchaseType === "subscription"
    ? addPlanPeriod(now, session.plan as Plan)
    : now

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

  const product = normalizeProduct(session.product)
  let subscriptionId: string | null = null
  let entitlementId: string | null = null
  let coupleIdForLog: string | null = null

  // ── BRANCH on purchase_type ─────────────────────────────────────────────────
  // Subscriptions (Journey, Games-weekly, future Adults-bundle) → upsert into
  // public.subscriptions and let the renewal cron handle the recurrence.
  // One-time (Adults per-game purchases) → grant a permanent
  // couple_entitlement; no subscription row, no renewal schedule.
  // Both branches share the token-storage and invoice-creation steps above /
  // below this block, so we only branch on the entitlement-grant step itself.
  if (purchaseType === "one_time") {
    // ── One-time purchase: insert couple_entitlement ──────────────────────
    if (!userId) {
      console.error(
        "[indicator:one_time] missing user_id on session",
        JSON.stringify({ session_id: sessionId }),
      )
    } else if (!session.target_game_id) {
      console.error(
        "[indicator:one_time] missing target_game_id on session",
        JSON.stringify({ session_id: sessionId, user_id: userId }),
      )
    } else if (product !== "adults") {
      // We don't have a non-Adults one-time pillar yet, but defensive log
      // so when one is added someone has to wire its grant path here.
      console.warn(
        "[indicator:one_time] unsupported product for one_time purchase",
        JSON.stringify({
          session_id: sessionId,
          user_id:    userId,
          product,
        }),
      )
    } else {
      // Resolve / create the buyer's couple. Service-role RPC added in
      // migration 042 — works without auth.uid().
      const { data: coupleIdResp, error: coupleErr } = await admin.rpc(
        "ensure_couple_for_user",
        { p_user_id: userId },
      )
      if (coupleErr || !coupleIdResp) {
        console.error(
          "[indicator:one_time] couple ensure failed",
          JSON.stringify({
            session_id: sessionId,
            user_id:    userId,
            error:      coupleErr?.message ?? "no couple_id",
          }),
        )
      } else {
        const coupleId = coupleIdResp as string
        coupleIdForLog = coupleId
        const gameId   = session.target_game_id as string

        // Idempotent: already entitled? Just record the existing row id.
        const { data: existingEnt } = await admin
          .from("couple_entitlements")
          .select("id")
          .eq("couple_id", coupleId)
          .eq("game_id", gameId)
          .maybeSingle()

        if (existingEnt?.id) {
          entitlementId = existingEnt.id as string
          console.log(
            "[indicator:one_time] entitlement already existed (idempotent)",
            JSON.stringify({
              session_id:     sessionId,
              user_id:        userId,
              couple_id:      coupleId,
              game_id:        gameId,
              entitlement_id: entitlementId,
            }),
          )
        } else {
          const { data: inserted, error: insErr } = await admin
            .from("couple_entitlements")
            .insert({
              couple_id:           coupleId,
              game_id:             gameId,
              source:              "paid",
              acquired_by_user_id: userId,
              price_paid:          session.amount,
              currency:            session.currency,
              notes:               `Cardcom deal ${indicator.dealNumber ?? "?"} · session ${sessionId}`,
            })
            .select("id")
            .maybeSingle()

          if (insErr || !inserted?.id) {
            console.error(
              "[indicator:one_time] entitlement insert failed",
              JSON.stringify({
                session_id: sessionId,
                user_id:    userId,
                couple_id:  coupleId,
                game_id:    gameId,
                error:      insErr?.message ?? "insert returned no row",
              }),
            )
          } else {
            entitlementId = inserted.id as string
            console.log(
              "[indicator:one_time] entitlement created",
              JSON.stringify({
                session_id:     sessionId,
                user_id:        userId,
                couple_id:      coupleId,
                game_id:        gameId,
                entitlement_id: entitlementId,
                source:         "paid",
                amount:         session.amount,
                currency:       session.currency,
                deal_number:    indicator.dealNumber ?? null,
              }),
            )
          }
        }
      }
    }
  } else {
    // ── Subscription path (existing behaviour) ────────────────────────────
    // Migration 032 relaxed "one active sub per user" to "one active sub per
    // (user, product)", so each pillar (games / journey / adults) has its own
    // subscription row. We scope the upsert on the checkout session's product.
    if (userId) {
      const { data: existingSub } = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("product", product)
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
            product,
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

    // Auto-assign journey content (subscription-only — irrelevant for
    // one-time purchases). Fire-and-forget; the helper is idempotent and
    // never throws.
    if (userId) {
      try {
        const result = await assignJourneyOnPurchase({
          userId,
          product,
          purchasedAt: now,
          checkoutSessionId: sessionId,
          supabase: admin,
        })
        if (!result.ok) {
          console.error("[indicator] auto-assign failed", result.reason)
        } else if (result.outcome === "no_program_configured") {
          console.warn(
            `[indicator] no journey program wired for product='${product}' — skipping auto-assign`,
          )
        }
      } catch (err) {
        console.error("[indicator] auto-assign threw", err)
      }
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

  if (invoiceResult.success) {
    if (subscriptionId) {
      await admin
        .from("subscriptions")
        .update({ invoice_url: invoiceResult.document_url })
        .eq("id", subscriptionId)

      // Also record on the initial charge
      if (paymentMethodId) {
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
    }
    // For one-time purchases we don't have a subscription row to attach the
    // invoice URL to — the invoice is still created at uxellent and the
    // checkout_sessions row already carries the deal_number for tracing.
  } else {
    console.error("[indicator] invoice creation failed", invoiceResult.message)
  }

  // ── Mark event as processed ─────────────────────────────────────────────────
  await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)

  console.log(
    "[indicator] processed",
    JSON.stringify({
      session_id:      sessionId,
      user_id:         userId,
      product,
      purchase_type:   purchaseType,
      subscription_id: subscriptionId,
      entitlement_id:  entitlementId,
      couple_id:       coupleIdForLog,
      target_game_id:  session.target_game_id ?? null,
      deal_number:     indicator.dealNumber ?? null,
    }),
  )

  return new Response("ok", { status: 200 })
}
