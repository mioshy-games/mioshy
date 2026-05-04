/**
 * POST /api/billing/checkout/create
 *
 * Creates a Cardcom LowProfile checkout session and returns the payment
 * redirect URL. Called from the SubscriptionModal when a user picks a plan.
 *
 * Body: { email, name?, plan, country_code, language, is_israeli, vat_rate_percent, lead_id? }
 * Response: { success, checkout_session_id, redirect_url, code?, message? }
 *
 * Error codes (for localized UI messages):
 *   - UNAUTHORIZED           - user not signed in
 *   - INVALID_PLAN           - plan not weekly/monthly/annual
 *   - MISSING_EMAIL          - no email on account
 *   - MISSING_CARDCOM_ENV    - server missing Cardcom credentials (ops issue)
 *   - DB_ERROR               - cannot create checkout session row
 *   - CARDCOM_NETWORK_ERROR  - fetch to Cardcom failed
 *   - CARDCOM_REJECTED       - Cardcom returned a non-ok response
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }        from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient }   from "@/lib/supabase-admin"
import { openLowProfile }      from "@/lib/cardcom"
import { getPlanPrice }        from "@/lib/billing"
import { geoFromRequest, localeFromGeo, currencyFromGeo } from "@/lib/geo-from-request"

function baseUrl(req: Request) {
  const envUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/+$/, "")
  // Fall back to the host the request came from - avoids hard-coded mioshy.com
  // breaking preview deployments.
  try {
    const origin = new URL(req.url).origin
    return origin.replace(/\/+$/, "")
  } catch {
    return "https://mioshy.com"
  }
}

export async function POST(req: Request) {
  console.log("[checkout:CREATE] start", {
    has_terminal: !!process.env.CARDCOM_TERMINAL_NUMBER,
    has_api_user: !!process.env.CARDCOM_API_USERNAME,
    has_api_pass: !!process.env.CARDCOM_API_PASSWORD,
    cardcom_mode: process.env.CARDCOM_MODE ?? "(unset)",
  })

  // ── Preflight: Cardcom credentials must be present ──────────────────────────
  const hasCardcomEnv =
    !!process.env.CARDCOM_TERMINAL_NUMBER &&
    !!process.env.CARDCOM_API_USERNAME &&
    !!process.env.CARDCOM_API_PASSWORD
  if (!hasCardcomEnv) {
    console.error("[checkout/create] Missing Cardcom env vars")
    return NextResponse.json(
      {
        success: false,
        code: "MISSING_CARDCOM_ENV",
        message: "Payment gateway is not configured. Please contact support.",
      },
      { status: 503 },
    )
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase     = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", message: "Please sign in before paying." },
      { status: 401 },
    )
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  // NOTE: `country_code`, `language`, `is_israeli`, and `vat_rate_percent`
  // are still accepted in the request body but are advisory only — the
  // server-trusted values come from `geoFromRequest(req)` below. The
  // audit log reads them off `body?.*` directly, so we don't destructure
  // them as locals.
  const {
    email          = auth.user.email ?? "",
    name           = null,
    plan,
    product        = "journey",           // which pillar this purchase unlocks
    purchase_type  = "subscription",       // 'subscription' | 'one_time'
    target_game_id = null,                 // required when purchase_type='one_time'
    lead_id        = null,
    return_path   = null,                  // optional post-payment landing path
  } = body

  // ── Server-trusted locale/tax fields, derived from request IP ───────────────
  // Tax compliance: we cannot let the client decide whether they're charged
  // 17% Israeli VAT or 0%. Vercel's edge attaches an ISO-2 country code via
  // `x-vercel-ip-country` (see lib/geo-from-request.ts). This becomes the
  // single source of truth for downstream pricing, VAT, currency, and
  // invoice language. The client-supplied fields above are kept only for
  // logging so we can spot mismatches.
  const geo = geoFromRequest(req)
  console.log("[checkout:CREATE] geo", {
    ip_country: geo.countryCode,
    source: geo.source,
    client_country_code: typeof body?.country_code === "string" ? body.country_code : null,
    client_is_israeli: typeof body?.is_israeli === "boolean" ? body.is_israeli : null,
    client_language: typeof body?.language === "string" ? body.language : null,
    client_vat_rate_percent:
      typeof body?.vat_rate_percent === "number" ? body.vat_rate_percent : null,
  })

  // In production, refuse the checkout when we genuinely don't know the
  // user's country. Issuing a tax invoice without a defensible country
  // value (defaulting to either IL or US) is a worse outcome than asking
  // the user to retry/contact support.
  if (geo.source === "unknown" && process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      {
        success: false,
        code: "GEO_UNKNOWN",
        message: "Could not determine your country. Please contact support.",
      },
      { status: 400 },
    )
  }

  const trustedCountryCode = geo.countryCode ?? "XX"
  const trustedIsIsraeli   = geo.isIsraeli
  const trustedLanguage    = localeFromGeo(geo)
  const trustedVatPercent  = trustedIsIsraeli ? 17 : 0
  const trustedCurrency    = currencyFromGeo(geo)

  // Subscription plans must be one of weekly/monthly/annual.
  // One-time purchases use plan='one_time' and an explicit target_game_id;
  // amount is derived server-side from the experience_games row so the
  // client can never spoof the price.
  if (purchase_type !== "subscription" && purchase_type !== "one_time") {
    return NextResponse.json(
      { success: false, code: "INVALID_PURCHASE_TYPE", message: "Invalid purchase_type" },
      { status: 400 },
    )
  }
  if (purchase_type === "subscription") {
    if (!plan || !["weekly", "monthly", "annual"].includes(plan)) {
      return NextResponse.json(
        { success: false, code: "INVALID_PLAN", message: "Invalid plan" },
        { status: 400 },
      )
    }
  } else {
    if (plan !== "one_time") {
      return NextResponse.json(
        { success: false, code: "INVALID_PLAN", message: "One-time purchase must use plan='one_time'" },
        { status: 400 },
      )
    }
    if (!target_game_id || typeof target_game_id !== "string") {
      return NextResponse.json(
        { success: false, code: "MISSING_TARGET", message: "target_game_id is required for one-time purchases" },
        { status: 400 },
      )
    }
  }
  if (!["games", "journey", "adults"].includes(product)) {
    return NextResponse.json(
      { success: false, code: "INVALID_PRODUCT", message: "Invalid product pillar" },
      { status: 400 },
    )
  }
  if (!email) {
    return NextResponse.json(
      { success: false, code: "MISSING_EMAIL", message: "Email required" },
      { status: 400 },
    )
  }

  // Pricing: subscriptions go through getPlanPrice() (settings-driven matrix);
  // one-time purchases read the fixed price off the game row. We refuse the
  // request if the game is missing / inactive so a stale link can't open a
  // checkout for nothing.
  let amount: number
  let currency: string
  let coinId: number | undefined
  if (purchase_type === "subscription") {
    const planPrice = getPlanPrice(plan, trustedIsIsraeli)
    amount = planPrice.amount
    currency = planPrice.currency
    coinId = planPrice.coinId
  } else {
    const adminClient = await createAdminClient()
    const { data: game } = await adminClient
      .from("experience_games")
      .select("id, is_active, price_ils, price_usd")
      .eq("id", target_game_id)
      .maybeSingle()
    if (!game || !game.is_active) {
      return NextResponse.json(
        { success: false, code: "GAME_UNAVAILABLE", message: "Game not available for purchase" },
        { status: 400 },
      )
    }
    if (trustedIsIsraeli) {
      const ils = game.price_ils as number | null
      if (ils == null || ils <= 0) {
        return NextResponse.json(
          { success: false, code: "GAME_UNPRICED", message: "Game has no ILS price set" },
          { status: 400 },
        )
      }
      amount = ils
      currency = "ILS"
      coinId = 1 // Cardcom coinId for ILS
    } else {
      const usd = game.price_usd as number | null
      if (usd == null || usd <= 0) {
        return NextResponse.json(
          { success: false, code: "GAME_UNPRICED", message: "Game has no USD price set" },
          { status: 400 },
        )
      }
      amount = usd
      currency = "USD"
      coinId = 2 // Cardcom coinId for USD
    }
  }

  // Determine locale for redirect URLs - avoids the middleware double-redirect bug
  // where /billing/success gets turned into /he/billing/success?session_id=he/billing/success?...
  const urlLocale = trustedLanguage

  // ── Create checkout session in DB ───────────────────────────────────────────
  const serviceClient = await createAdminClient()

  const { data: session, error: dbErr } = await serviceClient
    .from("checkout_sessions")
    .insert({
      user_id:          auth.user.id,
      lead_id:          lead_id || null,
      email,
      name:             name || null,
      plan,
      product,
      // One-time vs subscription is distinguished here; the indicator
      // webhook reads this back to know which entitlement code path to
      // run on success (couple_entitlement vs subscriptions row).
      purchase_type,
      target_game_id:   purchase_type === "one_time" ? target_game_id : null,
      amount,
      currency:         trustedCurrency,
      coin_id:          coinId,
      // Server-trusted values (IP-derived). The client-supplied versions
      // were destructured above for audit logging only — never persisted.
      country_code:     trustedCountryCode,
      language:         trustedLanguage,
      is_israeli:       trustedIsIsraeli,
      vat_rate_percent: trustedVatPercent,
      status:           "created",
    })
    .select("id")
    .single()

  if (dbErr || !session?.id) {
    console.error("[checkout:CREATE] DB error", dbErr)
    return NextResponse.json(
      { success: false, code: "DB_ERROR", message: "Failed to create session" },
      { status: 500 },
    )
  }

  const sessionId = session.id
  const BASE_URL  = baseUrl(req)
  console.log("[checkout:CREATE] session row inserted", {
    session_id: sessionId,
    user_id: auth.user.id,
    plan,
    product,
    purchase_type,
    amount,
    currency,
    base_url: BASE_URL,
  })

  // ── Open Cardcom LowProfile ─────────────────────────────────────────────────
  const cardcomLang = trustedLanguage

  // For one-time Adults purchases the natural success destination is the
  // product page itself (the entitled state surfaces the pair code there).
  // We pass return_path through to /billing/success so it can route
  // accordingly; the legacy billing-success page handles missing return_path
  // by falling back to its current /my redirect.
  const safeReturnPath =
    typeof return_path === "string" && return_path.startsWith("/")
      ? return_path
      : null
  const successQuery = safeReturnPath
    ? `session_id=${sessionId}&return_path=${encodeURIComponent(safeReturnPath)}`
    : `session_id=${sessionId}`

  let cardcomResult: Awaited<ReturnType<typeof openLowProfile>>
  try {
    cardcomResult = await openLowProfile({
      amount,
      coinId,
      // Include locale directly in the URL to avoid next-intl middleware double-redirecting
      // and corrupting the session_id query param.
      successUrl:   `${BASE_URL}/${urlLocale}/billing/success?${successQuery}`,
      errorUrl:     `${BASE_URL}/${urlLocale}/billing/error?session_id=${sessionId}`,
      indicatorUrl: `${BASE_URL}/api/billing/cardcom/indicator`,
      returnValue:  sessionId,
      pageLanguage: cardcomLang,
    })
  } catch (err) {
    console.error("[checkout/create] Cardcom network error", err)
    await serviceClient
      .from("checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
    return NextResponse.json(
      {
        success: false,
        code: "CARDCOM_NETWORK_ERROR",
        message: "Payment gateway unreachable. Please try again.",
      },
      { status: 502 },
    )
  }

  if (!cardcomResult.ok) {
    console.error(
      "[checkout/create] Cardcom non-ok",
      cardcomResult.responseCode,
      cardcomResult.raw,
    )
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

  // ── Update session with LowProfileCode ─────────────────────────────────────
  await serviceClient
    .from("checkout_sessions")
    .update({
      status: "redirected",
      low_profile_code: cardcomResult.lowProfileCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  console.log("[checkout:CREATE] DONE — Cardcom redirect ready", {
    session_id: sessionId,
    low_profile_code: cardcomResult.lowProfileCode,
    redirect_url: cardcomResult.redirectUrl,
  })

  return NextResponse.json({
    success:              true,
    checkout_session_id:  sessionId,
    redirect_url:         cardcomResult.redirectUrl,
  })
}
