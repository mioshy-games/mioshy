/**
 * POST /api/billing/checkout/create-trial
 *
 * 7-day free-trial signup. SEPARATE from /api/billing/checkout/create (which
 * charges immediately on the old Cardcom interface and is untouched). Here we
 * open a Cardcom v11 LowProfile that tokenizes + validates the card via J2 —
 * NO charge, NO hold — and returns the redirect URL. The trial subscription is
 * created later by /api/billing/cardcom/trial-indicator once J2 passes.
 *
 * Scope (spec A3): subscriptions only (games / journey), Israeli/ILS only for
 * v1, and only for packages the admin enabled in trial_settings. One trial per
 * account (checked here) and per card fingerprint (checked in the webhook).
 *
 * Body: { plan?, product, coaching?, return_path? }
 * Response: { success, checkout_session_id, redirect_url, code?, message? }
 *
 * Error codes:
 *   UNAUTHORIZED | MISSING_CARDCOM_ENV | GEO_UNKNOWN | INVALID_PRODUCT |
 *   TRIAL_NOT_AVAILABLE (package not enabled) | TRIAL_ILS_ONLY |
 *   TRIAL_ALREADY_USED (409) | ALREADY_SUBSCRIBED | NO_ENABLED_PLAN |
 *   MISSING_EMAIL | DB_ERROR | CARDCOM_NETWORK_ERROR | CARDCOM_REJECTED
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }                    from "next/server"
import { createServerSupabaseClient }      from "@/lib/supabase/server"
import { createAdminClient }               from "@/lib/supabase-admin"
import { createTrialTokenLowProfile }      from "@/lib/cardcom"
import { getPlanPrice }                    from "@/lib/billing"
import { resolveJourneyAmount }            from "@/lib/billing/journey-coaching-pricing"
import { resolveCheckoutCadence }          from "@/lib/billing/pricing-queries"
import { findActivePromo, applyDiscount }  from "@/lib/billing/promos"
import { getPromoMode, getUserOfferExpiresAt, promoDiscountEligible } from "@/lib/billing/promo-mode"
import { geoFromRequest, localeFromGeo }   from "@/lib/geo-from-request"

function baseUrl(req: Request) {
  const envUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/+$/, "")
  try {
    return new URL(req.url).origin.replace(/\/+$/, "")
  } catch {
    return "https://mioshy.com"
  }
}

export async function POST(req: Request) {
  // ── Preflight: Cardcom credentials ──────────────────────────────────────────
  const hasCardcomEnv =
    !!process.env.CARDCOM_TERMINAL_NUMBER &&
    !!process.env.CARDCOM_API_USERNAME &&
    !!process.env.CARDCOM_API_PASSWORD
  if (!hasCardcomEnv) {
    console.error("[trial:CREATE] Missing Cardcom env vars")
    return NextResponse.json(
      { success: false, code: "MISSING_CARDCOM_ENV", message: "Payment gateway is not configured." },
      { status: 503 },
    )
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase       = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", message: "Please sign in first." },
      { status: 401 },
    )
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const {
    plan        = null,
    product     = "journey",
    return_path = null,
  } = body
  const email = auth.user.email ?? ""
  // Coaching add-on (journey only). Mirrors checkout/create: default true,
  // explicit false opts out; games never carries coaching.
  const coaching: boolean = product === "journey" ? body?.coaching !== false : false

  if (product !== "games" && product !== "journey") {
    // adults is one-time only, never a trial (spec decision 2).
    return NextResponse.json(
      { success: false, code: "INVALID_PRODUCT", message: "Trials are for games/journey subscriptions only." },
      { status: 400 },
    )
  }
  if (!email) {
    return NextResponse.json(
      { success: false, code: "MISSING_EMAIL", message: "Email required" },
      { status: 400 },
    )
  }

  // ── Server-trusted geo (same posture as checkout/create) ────────────────────
  const geo = geoFromRequest(req)
  if (geo.source === "unknown" && process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { success: false, code: "GEO_UNKNOWN", message: "Could not determine your country." },
      { status: 400 },
    )
  }
  const trustedIsIsraeli = geo.isIsraeli
  const trustedLanguage  = localeFromGeo(geo)

  // v1: Israeli/ILS only. J2 no-hold is a Shva guarantee; foreign issuers may
  // place a $1 auth. USD trials are deferred (decision 2).
  if (!trustedIsIsraeli) {
    return NextResponse.json(
      { success: false, code: "TRIAL_ILS_ONLY", message: "Free trial is currently available in Israel only." },
      { status: 400 },
    )
  }

  const serviceClient = await createAdminClient()

  // ── Eligibility: is a trial enabled for this (product, coaching)? ───────────
  {
    const { data: setting, error: settingErr } = await serviceClient
      .from("trial_settings")
      .select("enabled")
      .eq("product", product)
      .eq("coaching", coaching)
      .maybeSingle()
    if (settingErr) {
      console.error("[trial:CREATE] trial_settings lookup failed", settingErr)
      return NextResponse.json(
        { success: false, code: "DB_ERROR", message: "Could not check trial availability." },
        { status: 500 },
      )
    }
    if (!setting?.enabled) {
      return NextResponse.json(
        { success: false, code: "TRIAL_NOT_AVAILABLE", message: "No free trial available for this package." },
        { status: 400 },
      )
    }
  }

  // ── Abuse guard #1 (account): one trial per account, ever ───────────────────
  // The card-fingerprint guard (#2) runs in the webhook after tokenization.
  {
    const { data: prior } = await serviceClient
      .from("trial_redemptions")
      .select("id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle()
    if (prior?.id) {
      return NextResponse.json(
        { success: false, code: "TRIAL_ALREADY_USED", message: "You've already used a free trial." },
        { status: 409 },
      )
    }
  }

  // ── Guard: don't trial a product the user already subscribes to ─────────────
  {
    const { data: activeSub } = await serviceClient
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", auth.user.id)
      .eq("product", product)
      .in("status", ["active", "trialing", "past_due", "grace"])
      .limit(1)
      .maybeSingle()
    if (activeSub?.id) {
      return NextResponse.json(
        { success: false, code: "ALREADY_SUBSCRIBED", message: "You already have this subscription." },
        { status: 409 },
      )
    }
  }

  // ── Resolve post-trial price + promo (identical to checkout/create) ─────────
  // This is the amount that will be charged on day 7 — snapshotted onto the
  // session now so the day-7 charge is correct even if the promo later ends.
  const resolvedCadence = await resolveCheckoutCadence(
    product as "games" | "journey",
    typeof plan === "string" ? plan : null,
  )
  if (!resolvedCadence) {
    return NextResponse.json(
      { success: false, code: "NO_ENABLED_PLAN", message: "No purchasable plan is configured." },
      { status: 400 },
    )
  }

  let amount: number
  let currency: string
  let coinId: number
  if (product === "journey") {
    const j = await resolveJourneyAmount(resolvedCadence, trustedIsIsraeli, coaching)
    amount = j.amount; currency = j.currency; coinId = j.coinId
  } else {
    const p = await getPlanPrice(resolvedCadence, trustedIsIsraeli, "games")
    amount = p.amount; currency = p.currency; coinId = p.coinId
  }

  // Subscription promo (best-effort; never blocks checkout). Snapshotted the
  // same way as checkout/create: original_amount = full price, amount =
  // discounted intro, promo_id recorded → day-7 charge follows the intro rule.
  let promoId: string | null = null
  let originalAmount: number | null = null
  try {
    // Task 20 — same urgency gate as checkout/create. In personal_window the
    // intro discount snapshotted onto the trial (→ day-7 charge) is granted only
    // if the user is within their 48h window; the lock then survives the trial.
    const promoMode = await getPromoMode(serviceClient)
    const offerExpiresAt =
      promoMode === "personal_window"
        ? await getUserOfferExpiresAt(serviceClient, auth.user.id)
        : null
    const discountEligible = promoDiscountEligible(promoMode, offerExpiresAt)
    const { promo, warning } = discountEligible
      ? await findActivePromo(serviceClient, {
          product: product as "journey" | "games",
          cadence: resolvedCadence,
          coaching,
          // Task 20: personal_window's 48h window is the expiry, not ends_at.
          ignoreEndsAt: promoMode === "personal_window",
        })
      : { promo: null, warning: undefined }
    if (warning) console.warn("[trial:CREATE] promo warning", warning)
    if (!discountEligible) {
      console.log("[trial:CREATE] promo gated off", { promo_mode: promoMode, offer_expires_at: offerExpiresAt })
    }
    if (promo) {
      const res = applyDiscount({ amount, currency: currency === "USD" ? "USD" : "ILS", promo })
      if (res.promoId) {
        promoId = res.promoId
        originalAmount = res.originalAmount
        amount = res.discountedAmount
      }
    }
  } catch (err) {
    console.error("[trial:CREATE] promo lookup failed — full price snapshot", err)
  }

  // ── Create checkout session (is_trial=true) ─────────────────────────────────
  const { data: session, error: dbErr } = await serviceClient
    .from("checkout_sessions")
    .insert({
      user_id:          auth.user.id,
      email,
      plan:             resolvedCadence,
      product,
      coaching,
      purchase_type:    "subscription",
      is_trial:         true,
      amount,                              // discounted intro (or full) — charged on day 7
      currency,
      coin_id:          coinId,
      promo_id:         promoId,
      original_amount:  originalAmount,
      country_code:     geo.countryCode ?? "IL",
      language:         trustedLanguage,
      is_israeli:       trustedIsIsraeli,
      vat_rate_percent: trustedIsIsraeli ? 18 : 0,
      status:           "created",
    })
    .select("id")
    .single()

  if (dbErr || !session?.id) {
    console.error("[trial:CREATE] DB error", dbErr)
    return NextResponse.json(
      { success: false, code: "DB_ERROR", message: "Failed to create session" },
      { status: 500 },
    )
  }

  const sessionId = session.id
  const BASE_URL  = baseUrl(req)
  const urlLocale = trustedLanguage

  // ── Test-user bypass ────────────────────────────────────────────────────────
  // Same posture as checkout/create: test users skip Cardcom entirely (the
  // entitlements gate returns all-true for them). No subscription/trial row and
  // no trial_redemption is written, so QA can re-run freely.
  {
    const { data: testProfile } = await serviceClient
      .from("profiles")
      .select("is_test_user")
      .eq("id", auth.user.id)
      .maybeSingle()
    if ((testProfile as { is_test_user: boolean } | null)?.is_test_user) {
      console.log("[trial:CREATE] test-user bypass", { session_id: sessionId, product, coaching })
      await serviceClient
        .from("checkout_sessions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
      const safeReturn = typeof return_path === "string" && return_path.startsWith("/") ? return_path : null
      const q = safeReturn
        ? `session_id=${sessionId}&return_path=${encodeURIComponent(safeReturn)}&test_user=1&trial=1`
        : `session_id=${sessionId}&test_user=1&trial=1`
      return NextResponse.json({
        success: true,
        checkout_session_id: sessionId,
        redirect_url: `${BASE_URL}/${urlLocale}/billing/success?${q}`,
        test_user_bypass: true,
      })
    }
  }

  // ── Open Cardcom v11 LowProfile (token + J2, NO charge) ─────────────────────
  const safeReturnPath =
    typeof return_path === "string" && return_path.startsWith("/") ? return_path : null
  const successQuery = safeReturnPath
    ? `session_id=${sessionId}&trial=1&return_path=${encodeURIComponent(safeReturnPath)}`
    : `session_id=${sessionId}&trial=1`

  let cardcomResult: Awaited<ReturnType<typeof createTrialTokenLowProfile>>
  try {
    cardcomResult = await createTrialTokenLowProfile({
      amount,                              // recorded on the deal; NOT charged (J2)
      coinId,
      successUrl:  `${BASE_URL}/${urlLocale}/billing/success?${successQuery}`,
      errorUrl:    `${BASE_URL}/${urlLocale}/billing/error?session_id=${sessionId}`,
      webhookUrl:  `${BASE_URL}/api/billing/cardcom/trial-indicator`,
      returnValue: sessionId,
      pageLanguage: trustedLanguage,
    })
  } catch (err) {
    console.error("[trial:CREATE] Cardcom network error", err)
    await serviceClient
      .from("checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
    return NextResponse.json(
      { success: false, code: "CARDCOM_NETWORK_ERROR", message: "Payment gateway unreachable." },
      { status: 502 },
    )
  }

  if (!cardcomResult.ok) {
    console.error("[trial:CREATE] Cardcom non-ok", cardcomResult.responseCode, cardcomResult.description)
    await serviceClient
      .from("checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
    return NextResponse.json(
      {
        success: false,
        code: "CARDCOM_REJECTED",
        message: "Failed to open payment page",
        cardcom_code: cardcomResult.responseCode,
      },
      { status: 502 },
    )
  }

  await serviceClient
    .from("checkout_sessions")
    .update({
      status: "redirected",
      low_profile_code: cardcomResult.lowProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  console.log("[trial:CREATE] DONE — v11 redirect ready", {
    session_id: sessionId,
    low_profile_id: cardcomResult.lowProfileId,
    product,
    coaching,
    post_trial_amount: amount,
    currency,
  })

  return NextResponse.json({
    success: true,
    checkout_session_id: sessionId,
    redirect_url: cardcomResult.redirectUrl,
  })
}
