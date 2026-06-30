/**
 * GET /api/billing/cardcom/indicator
 *
 * Server-to-server callback from Cardcom after a payment attempt.
 * Must respond HTTP 200 quickly - heavy work happens here synchronously
 * (mioshy is on Vercel edge/serverless so we process inline, not via queue).
 *
 * Cardcom sends:  ?LowProfileCode=xxx&ReturnValue=<checkout_session_id>
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { pullLowProfileIndicator, extractToken, normalizeExpiry } from "@/lib/cardcom"
import { encryptToken, tokenHashSha256 }  from "@/lib/tokenCrypto"
import { addPlanPeriod, type Plan } from "@/lib/billing"
import { createBillingDocumentWithRetry } from "@/lib/uxellent-api"
import {
  productNameForSession,
  brandToPaymentMethod,
  extractCardcomCustomerInfo,
} from "@/lib/uxellent-billing-helpers"
import { createAdminClient }         from "@/lib/supabase-admin"
import { assignJourneyOnPurchase }   from "@/lib/journey-content/auto-assign"
import type { JourneyProductSlug }   from "@/lib/journey-content/types"
import {
  tagAsJourneyMember,
  tagAsGamesSubscriber,
  tagAsAdultsBuyer,
  type AdultsTier,
} from "@/lib/email/brevo-segments-sync"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { sendMetaCapiEvent, metaEventId } from "@/lib/analytics/meta-capi"

/** Narrow the free-form checkout_sessions.product to the pillar union. */
function normalizeProduct(raw: unknown): JourneyProductSlug {
  if (raw === "games" || raw === "adults") return raw
  // Anything else - NULL, unknown strings, or legacy 'journey' - maps to
  // 'journey'. Migration 036 backfilled historical rows this way.
  return "journey"
}

/**
 * Case-insensitive query-param read.
 *
 * Cardcom is *inconsistent* about parameter casing. Their docs say
 * `LowProfileCode` / `ReturnValue` (PascalCase), but in production
 * they sometimes send `lowprofilecode` / `returnvalue` (all lowercase).
 * `URLSearchParams.get()` is case-sensitive, so the wrong casing
 * silently returns null and we exit early without recording the
 * payment. That hid a paid customer in production once already.
 *
 * This helper iterates the params manually and matches case-insensitively.
 */
function getParamCI(url: URL, ...candidates: string[]): string {
  const wanted = candidates.map(c => c.toLowerCase())
  for (const [k, v] of url.searchParams.entries()) {
    if (wanted.includes(k.toLowerCase()) && v) return v
  }
  return ""
}

export async function GET(req: Request) {
  const url            = new URL(req.url)
  const lowProfileCode = getParamCI(url, "LowProfileCode", "lowprofilecode")
  const returnValue    = getParamCI(url, "ReturnValue",    "returnvalue")    // checkout session id

  // ── Rate limit ─────────────────────────────────────────────────────────────
  // 10 requests / minute per IP. The endpoint is a Cardcom server-to-server
  // callback (their datacenter IPs are stable, ~1 callback per real payment),
  // so legitimate traffic is well under this. The limit guards against an
  // attacker spraying fake LowProfileCode values — without it, each fake call
  // would still trigger a server-pull to Cardcom (pullLowProfileIndicator),
  // burning Cardcom API quota and our function-invocation budget. Returning
  // 200 keeps Cardcom's retry logic happy on the rare legitimate burst.
  const ip = getClientIp(req)
  const { ok: rlOk, retryAfterSec } = checkRateLimit(`cardcom-indicator:${ip}`, 10, 60)
  if (!rlOk) {
    console.warn("[indicator:RATE_LIMITED]", { ip, retry_after_sec: retryAfterSec })
    return new Response("ok", { status: 200, headers: { "Retry-After": String(retryAfterSec) } })
  }

  console.log("[indicator:START] callback received from Cardcom", {
    has_low_profile: !!lowProfileCode,
    return_value: returnValue || "(empty)",
    full_url_query: url.search,
  })

  // Always respond 200 to Cardcom immediately
  if (!lowProfileCode) {
    console.warn("[indicator:NO_CODE] missing LowProfileCode - exiting", {
      query: url.search,
    })
    return new Response("ok", { status: 200 })
  }

  const idempotencyKey = `lp:${lowProfileCode}`
  const admin          = await createAdminClient()

  // ── Idempotency guard ───────────────────────────────────────────────────────
  const idempotencyCheckStart = Date.now()
  const { data: existing, error: existingErr } = await admin
    .from("billing_events")
    .select("id, processed, error, created_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  console.log("[indicator:IDEMPOTENCY_LOOKUP] result", {
    idempotency_key:  idempotencyKey,
    elapsed_ms:       Date.now() - idempotencyCheckStart,
    existing_found:   !!existing,
    existing_id:      existing?.id ?? null,
    existing_processed: existing?.processed ?? null,
    existing_error:   existing?.error ?? null,
    existing_created_at: existing?.created_at ?? null,
    lookup_error:     existingErr ? { message: existingErr.message, code: (existingErr as { code?: string }).code ?? null } : null,
  })

  if (existing?.processed) {
    console.log("[indicator:IDEMPOTENT_SKIP] already processed - returning early", {
      idempotency_key: idempotencyKey,
      existing_id:     existing.id,
      existing_created_at: existing.created_at,
    })
    return new Response("ok", { status: 200 })
  }

  // Insert event row (ignore conflict - already handled above)
  const upsertStart = Date.now()
  const { error: upsertErr } = await admin
    .from("billing_events")
    .upsert({ idempotency_key: idempotencyKey, processed: false }, { onConflict: "idempotency_key" })
  console.log("[indicator:EVENT_UPSERTED]", {
    idempotency_key: idempotencyKey,
    elapsed_ms:      Date.now() - upsertStart,
    upsert_error:    upsertErr ? { message: upsertErr.message, code: (upsertErr as { code?: string }).code ?? null } : null,
  })

  // ── Pull authoritative indicator from Cardcom ───────────────────────────────
  let indicator: Awaited<ReturnType<typeof pullLowProfileIndicator>>
  try {
    indicator = await pullLowProfileIndicator(lowProfileCode)
    console.log("[indicator:PULLED] cardcom indicator", {
      paid: indicator.paid,
      deal_number: indicator.dealNumber ?? null,
      low_profile_code: lowProfileCode,
    })
  } catch (err) {
    console.error("[indicator:PULL_FAILED] Cardcom indicator unreachable", err)
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
    console.warn("[indicator:PAYMENT_FAILED] marking session failed", {
      session_id: sessionId,
      user_id: session.user_id,
      product: session.product,
    })
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
      // migration 042 - works without auth.uid().
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
      const lookupRes = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("product", product)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const existingSub = lookupRes.data
      console.log("[indicator:SUBSCRIPTION_LOOKUP]", {
        user_id: userId,
        product,
        existing_id: existingSub?.id ?? null,
        lookup_error: lookupRes.error
          ? { message: lookupRes.error.message, code: (lookupRes.error as { code?: string }).code ?? null }
          : null,
      })

      // ── Subscription promo lock (marketing-discounts-spec §6.2) ──────────────
      // plan_amount stays the FULL price so renewals after the intro period are
      // full. When the checkout carried a promo, also record the discounted
      // intro amount + how many discounted renewals remain (the checkout charge
      // already consumed one → remaining = discounted_charges − 1). With no
      // promo we explicitly clear the intro fields — matters on the reactivation
      // (update) path, which may carry stale values.
      const fullPlanAmount = session.original_amount ?? session.amount
      let promoFields: {
        promo_id: string | null
        intro_amount: number | null
        intro_charges_remaining: number
      } = { promo_id: null, intro_amount: null, intro_charges_remaining: 0 }
      if (session.promo_id) {
        try {
          const { data: promoRow } = await admin
            .from("subscription_promos")
            .select("discounted_charges")
            .eq("id", session.promo_id)
            .maybeSingle()
          const charges =
            (promoRow as { discounted_charges?: number } | null)?.discounted_charges ?? 1
          promoFields = {
            promo_id: session.promo_id,
            intro_amount: session.amount,
            intro_charges_remaining: Math.max(0, charges - 1),
          }
          console.log("[indicator:PROMO_LOCK]", {
            promo_id: session.promo_id,
            full_amount: fullPlanAmount,
            intro_amount: session.amount,
            intro_charges_remaining: promoFields.intro_charges_remaining,
          })
        } catch (err) {
          console.error("[indicator] promo lock lookup failed — full price, no intro", err)
        }
      }

      if (existingSub?.id) {
        const upd = await admin
          .from("subscriptions")
          .update({
            status:               "active",
            plan:                 session.plan,
            plan_amount:          fullPlanAmount,
            // Stage-1 coaching add-on — stamp the buyer's choice. Older
            // sessions (pre-migration) carry no flag → default true, which
            // matches the column default and the launch "chat-for-all" state.
            coaching:             session.coaching ?? true,
            ...promoFields,
            currency:             session.currency,
            coin_id:              session.coin_id,
            is_israeli:           session.is_israeli,
            vat_rate_percent:     session.vat_rate_percent,
            current_period_end:   periodEnd.toISOString(),
            next_billing_date:    periodEnd.toISOString(),
            failed_attempts:      0,
            grace_until:          null,
            // v3 slice 5: clear journey grace columns on a successful
            // renewal so the user re-enters 'active' state and the
            // cadence engine resumes materializing on the next tick.
            // Harmless for non-journey products (columns just stay NULL).
            journey_grace_until:  null,
            journey_blocked_at:   null,
            checkout_session_id:  session.id,
            payment_method_id:    paymentMethodId,
          })
          .eq("id", existingSub.id)
        console.log("[indicator:SUBSCRIPTION_UPDATED]", {
          sub_id: existingSub.id,
          update_error: upd.error
            ? { message: upd.error.message, code: (upd.error as { code?: string }).code ?? null }
            : null,
        })
        subscriptionId = existingSub.id
      } else {
        const ins = await admin
          .from("subscriptions")
          .insert({
            user_id:             userId,
            email:               session.email,
            status:              "active",
            product,
            plan:                session.plan,
            plan_amount:         fullPlanAmount,
            // Stage-1 coaching add-on — see update path above.
            coaching:            session.coaching ?? true,
            ...promoFields,
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
        subscriptionId = ins.data?.id ?? null
        console.log("[indicator:SUBSCRIPTION_INSERTED]", {
          user_id: userId,
          product,
          plan: session.plan,
          amount: session.amount,
          currency: session.currency,
          payment_method_id: paymentMethodId,
          inserted_id: subscriptionId,
          insert_error: ins.error
            ? {
                message: ins.error.message,
                code: (ins.error as { code?: string }).code ?? null,
                details: (ins.error as { details?: string }).details ?? null,
                hint: (ins.error as { hint?: string }).hint ?? null,
              }
            : null,
        })
      }
    }

    // Auto-create couple for subscription buyers (Itzik 2026-05-27).
    // Mirrors the one-time branch above so that Games/Journey subscribers
    // get a couple + pair_code the moment the webhook fires, not lazily
    // on their first /my visit. The RPC is idempotent — returns the
    // existing couple if the user is already a member, otherwise creates
    // a new couple with the user as 'owner' and a fresh pair_code.
    // The PartnerShareCard on /my needs ctx.pair_code to render the
    // invite-partner widget; doing it here means the code is visible
    // on first paint instead of on the second visit.
    if (userId) {
      try {
        const { data: coupleIdResp, error: coupleErr } = await admin.rpc(
          "ensure_couple_for_user",
          { p_user_id: userId },
        )
        if (coupleErr || !coupleIdResp) {
          console.error("[indicator:subscription] couple ensure failed", {
            user_id: userId,
            error: coupleErr?.message ?? "no couple_id",
          })
        } else {
          coupleIdForLog = coupleIdResp as string
          console.log("[indicator:subscription] couple ensured", {
            user_id: userId,
            couple_id: coupleIdForLog,
          })
        }
      } catch (err) {
        console.error("[indicator:subscription] couple ensure threw", err)
      }
    }

    // Auto-assign journey content (subscription-only - irrelevant for
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
        }
      } catch (err) {
        console.error("[indicator] auto-assign threw", err)
      }
    }

    // ── Auto-cancel games subscription on journey upgrade ──────────────────
    // Itzik 2026-05-22: when a user with an active "games" subscription buys
    // "journey", we cancel the games sub immediately. Rationale:
    //   • Journey already includes every game in the games pillar at the
    //     entitlement layer (`getUserEntitlements`).
    //   • Charging for both products in parallel would double-bill the user
    //     for content they already get.
    //   • Per the policy decision (אין החזרים): we do NOT refund the unused
    //     portion of the current games billing period; we simply stop future
    //     auto-renewal charges.
    // We do NOT void the existing games invoice or the partial week paid —
    // the user keeps games access through the database row, but the cron at
    // /api/billing/renewals/run will skip a cancelled row because it only
    // selects status IN ('active','past_due').
    if (userId && product === "journey") {
      const { data: gamesSub, error: gamesLookupErr } = await admin
        .from("subscriptions")
        .select("id, status, plan, current_period_end")
        .eq("user_id", userId)
        .eq("product", "games")
        .eq("status", "active")
        .maybeSingle()

      if (gamesLookupErr) {
        console.error("[indicator:JOURNEY_UPGRADE] games lookup failed", {
          user_id: userId,
          error: gamesLookupErr.message,
        })
      } else if (gamesSub?.id) {
        const { error: cancelErr } = await admin
          .from("subscriptions")
          .update({
            status: "cancelled",
            next_billing_date: null,
            cancelled_at: now.toISOString(),
            cancellation_reason: "upgraded_to_journey",
          })
          .eq("id", gamesSub.id)

        if (cancelErr) {
          console.error("[indicator:JOURNEY_UPGRADE] games cancel failed", {
            user_id: userId,
            games_sub_id: gamesSub.id,
            error: cancelErr.message,
          })
        } else {
          console.log("[indicator:JOURNEY_UPGRADE] games sub cancelled", {
            user_id: userId,
            games_sub_id: gamesSub.id,
            new_journey_sub_id: subscriptionId,
            note: "journey includes games at the entitlement layer; cron will skip cancelled row",
          })
        }
      }
    }
  }

  // ── Brevo segmentation (fire-and-forget) ────────────────────────────────────
  // Tag the buyer into the matching product list once the entitlement /
  // subscription write above actually succeeded (subscriptionId for the
  // journey/games subscription path, entitlementId for the adults one-time
  // path). A purchase is a transactional relationship, so this is NOT gated on
  // marketing consent. Brevo failures are swallowed — they must NEVER block or
  // fail the payment webhook.
  if (userId && session.email) {
    const brevoLang: "he" | "en" = session.language === "he" ? "he" : "en"
    const brevoAmount =
      typeof session.amount === "number"
        ? session.amount
        : Number(session.amount ?? 0)
    try {
      if (product === "journey" && subscriptionId) {
        const r = await tagAsJourneyMember(session.email, userId, brevoLang, brevoAmount)
        if (!r.success) console.warn("[indicator:brevo] tagAsJourneyMember non-success:", r.error)
      } else if (product === "games" && subscriptionId) {
        const r = await tagAsGamesSubscriber(session.email, userId, brevoLang, brevoAmount)
        if (!r.success) console.warn("[indicator:brevo] tagAsGamesSubscriber non-success:", r.error)
      } else if (product === "adults" && entitlementId) {
        // Adults is one-time per game today → "single"; map a future Adults
        // subscription by plan so the tier stays correct when that path lands.
        const tier: AdultsTier =
          purchaseType === "one_time"
            ? "single"
            : /annual|year/i.test(String(session.plan ?? ""))
              ? "annual"
              : "monthly"
        const r = await tagAsAdultsBuyer(session.email, userId, brevoLang, tier, brevoAmount)
        if (!r.success) console.warn("[indicator:brevo] tagAsAdultsBuyer non-success:", r.error)
      }
    } catch (brevoErr) {
      console.error("[indicator:brevo] sync failed", brevoErr)
    }
  }

  // ── Create invoice via uxellent API ─────────────────────────────────────────
  // IMPORTANT: We insert the subscription_charges row BEFORE calling the
  // billing API, with status='succeeded' and invoice_url=null. The Cardcom
  // payment already succeeded, so the charge is succeeded regardless of
  // whether we manage to issue the invoice. Storing the row first means:
  //   1. Failed invoice creation leaves a discoverable row for the daily
  //      repair cron (status='succeeded' AND invoice_url IS NULL).
  //   2. Subsequent indicator retries from Cardcom dedupe via uniq_asmachta.
  //   3. The retry wrapper attaches charge_id to mioshy_billing_failures.
  let chargeId: string | null = null

  if (subscriptionId && userId && paymentMethodId) {
    const { data: charge, error: chargeErr } = await admin
      .from("subscription_charges")
      .upsert(
        {
          user_id:              userId,
          subscription_id:      subscriptionId,
          payment_method_id:    paymentMethodId,
          amount:               session.amount,
          currency:             session.currency,
          status:               "succeeded",
          uniq_asmachta:        `initial:${sessionId}`,
          billing_period_start: now.toISOString(),
          billing_period_end:   periodEnd.toISOString(),
          invoice_url:          null,
          raw_response:         { deal_number: indicator.dealNumber ?? null },
        },
        { onConflict: "uniq_asmachta" },
      )
      .select("id, invoice_url")
      .maybeSingle()

    if (chargeErr) {
      console.error("[indicator] failed to upsert initial subscription_charges", chargeErr)
    } else {
      chargeId = charge?.id ?? null

      // Idempotency short-circuit: if this charge already has an invoice_url
      // (Cardcom retried its callback after we already issued), skip.
      if (charge?.invoice_url) {
        await admin.from("billing_events").update({ processed: true }).eq("idempotency_key", idempotencyKey)
        console.log("[indicator:IDEMPOTENT_INVOICE] charge already has invoice_url - skipping issuance", {
          session_id: sessionId, charge_id: chargeId,
        })
        return new Response("ok", { status: 200 })
      }
    }
  }

  // ISO-2 country fallback. The issuer schema requires exactly 2 chars
  // (`z.string().min(2).max(2)`); if checkout_sessions.country_code is
  // null (e.g. inline signup without a geo question) we have to default
  // - Israeli purchases are by far the common case and we already know
  // is_israeli from the session.
  //
  // IMPORTANT - DO NOT re-derive country/locale from request headers here.
  // This handler is a Cardcom webhook callback: it runs from Cardcom's
  // IP, not the user's. The trusted source is the `checkout_sessions`
  // row, which was populated at /api/billing/checkout/create from
  // Vercel's `x-vercel-ip-country` (see lib/geo-from-request.ts). Reading
  // headers here would invalidate the IP-based tax decision.
  const country2 =
    typeof session.country_code === "string" && session.country_code.trim().length === 2
      ? session.country_code.trim().toUpperCase()
      : (session.is_israeli ? "IL" : "US")

  // ─────────────────────────────────────────────────────────────────
  // Feature flag: UXELLENT_BILLING_DISABLED
  //
  // When enabled, we DO NOT call the external billing API to issue
  // an invoice/receipt. The payment + subscription flow completes
  // without a `tax invoice / receipt`. Use this when the issuer
  // (app.uxellent.com) is unavailable or its signing service is not
  // ready, so a paying user still gets immediate access.
  //
  // Once the issuer is back, run /api/billing/repair-missing-invoices
  // to retroactively create invoices for charges that were processed
  // while this flag was on (rows have status='succeeded' AND
  // invoice_url IS NULL).
  //
  // Tax compliance note: in Israel, official invoices/receipts are
  // legally required for purchases. This flag is acceptable only as a
  // short-term operational workaround - never as a permanent state.
  // ─────────────────────────────────────────────────────────────────
  const billingDisabled =
    String(process.env.UXELLENT_BILLING_DISABLED || "").toLowerCase() === "true"

  // ── Regulatory-required invoice fields (Itzik, 2026-05-28) ───────────
  // The uxellent issuer accepts name/phone/product_name/payment_method
  // as optional fields, but BKMV-compliant Israeli tax invoices require
  // a real customer name, contact, specific product description and a
  // concrete payment method. We try hard to populate all four.
  //
  //  · name           → prefer the checkout session (what the user typed
  //                     into our form); fall back to the name Cardcom
  //                     reads off the card.
  //  · phone          → checkout_sessions has no phone column, so we
  //                     take it from the Cardcom indicator only.
  //                     (Profile-fallback is intentionally NOT used here;
  //                     for renewals/repair we DO look at profiles.)
  //  · product_name   → pillar mapping; for adults one-time purchases we
  //                     look up the specific game title.
  //  · payment_method → derived from the brand string Cardcom returns
  //                     (Mutag/CardName); defaults to "כרטיס אשראי".
  const cardcomCustomer = extractCardcomCustomerInfo(
    indicator.parsed as Record<string, string>,
  )
  const customerName  = (session.name ?? "").trim() || cardcomCustomer.name || null
  const customerPhone = cardcomCustomer.phone
  const productName   = await productNameForSession({
    admin,
    product:        session.product,
    purchase_type:  purchaseType,
    target_game_id: session.target_game_id ?? null,
  })
  const paymentMethod = brandToPaymentMethod(cardcomCustomer.brand)

  const invoiceResult = billingDisabled
    ? (() => {
        console.warn("[indicator] UXELLENT_BILLING_DISABLED=true - skipping invoice creation", {
          session_id: sessionId,
          user_id:    userId,
          deal_number: indicator.dealNumber ?? null,
          charge_id:   chargeId,
        })
        return {
          success: false as const,
          message: "skipped:UXELLENT_BILLING_DISABLED",
          errorCode: "unknown" as const,
        }
      })()
    : await createBillingDocumentWithRetry(
        {
          user_id:        userId ?? "",
          email:          session.email,
          name:           customerName,
          phone:          customerPhone,
          country:        country2,
          amount:         session.amount,
          currency:       session.currency,
          language:       (session.language === "he" ? "he" : "en") as "he" | "en",
          is_israeli:     session.is_israeli,
          plan:           session.plan,
          product_name:   productName,
          payment_method: paymentMethod,
          deal_number:    indicator.dealNumber ?? null,
        },
        { chargeId, subscriptionId },
      )

  if (invoiceResult.success) {
    if (subscriptionId) {
      await admin
        .from("subscriptions")
        .update({ invoice_url: invoiceResult.document_url })
        .eq("id", subscriptionId)
    }
    if (chargeId) {
      await admin
        .from("subscription_charges")
        .update({ invoice_url: invoiceResult.document_url })
        .eq("id", chargeId)
    }
  } else {
    // Note: per-attempt and final failures are already logged by the
    // retry wrapper. We do NOT block the response - Cardcom must get 200
    // and the user keeps their subscription. The daily repair cron at
    // /api/billing/repair-missing-invoices will retry.
    console.error("[indicator] invoice creation failed (after retries)", {
      message: invoiceResult.message,
      errorCode: invoiceResult.errorCode,
    })
  }

  // ── Meta Purchase (CAPI) — the critical campaign conversion ─────────────────
  // CONTRACT (Itzik 2026-06-21): this ALWAYS fires on a confirmed payment, but a
  // Meta outage must NEVER break the flow above (entitlements are already
  // granted + the invoice already issued by this point). sendMetaCapiEvent is
  // try/catch + 3s-timeout-bounded and never throws; we await it so the event
  // reliably leaves a serverless function before it freezes. It runs ONCE per
  // real payment — Cardcom retries hit the idempotent short-circuits above and
  // return before reaching here; even if one slipped through, the deterministic
  // event_id dedupes against the browser Purchase. No client IP is used (not
  // stored); fbp/fbc/UA come off the checkout_sessions row + hashed email/phone.
  await sendMetaCapiEvent({
    eventName: "Purchase",
    eventId: metaEventId.purchase(sessionId),
    userData: {
      email:           session.email,
      phone:           customerPhone,
      externalId:      userId,
      fbp:             session.fbp,
      fbc:             session.fbc,
      clientUserAgent: session.client_user_agent,
    },
    customData: {
      value:        session.amount,
      currency:     session.currency,
      content_name: productName,
      content_type: "product",
    },
  })

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
