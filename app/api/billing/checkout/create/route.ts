/**
 * POST /api/billing/checkout/create
 *
 * Creates a Cardcom LowProfile checkout session and returns the payment
 * redirect URL. Called from the SubscriptionModal when a user picks a plan.
 *
 * Body: { email, name?, plan, country_code, language, is_israeli, vat_rate_percent, lead_id? }
 * Response: { checkout_session_id, redirect_url }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { createAdminClient }   from "@/lib/supabase-admin"
import { openLowProfile }      from "@/lib/cardcom"
import { getPlanPrice }        from "@/lib/billing"

const BASE_URL = (process.env.PUBLIC_BASE_URL ?? "https://mioshy.com").replace(/\/+$/, "")

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase     = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const {
    email          = auth.user.email ?? "",
    name           = null,
    plan,
    country_code   = "",
    language       = "he",
    is_israeli     = false,
    vat_rate_percent = 0,
    lead_id        = null,
  } = body

  if (!plan || !["weekly", "monthly", "annual"].includes(plan)) {
    return NextResponse.json({ success: false, message: "Invalid plan" }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ success: false, message: "Email required" }, { status: 400 })
  }

  const { amount, currency, coinId } = getPlanPrice(plan, is_israeli)

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
      amount,
      currency,
      coin_id:          coinId,
      country_code:     country_code || null,
      language,
      is_israeli,
      vat_rate_percent,
      status:           "created",
    })
    .select("id")
    .single()

  if (dbErr || !session?.id) {
    console.error("[checkout/create] DB error", dbErr)
    return NextResponse.json({ success: false, message: "Failed to create session" }, { status: 500 })
  }

  const sessionId = session.id

  // ── Open Cardcom LowProfile ─────────────────────────────────────────────────
  const cardcomLang = (language === "he" || is_israeli) ? "he" : "en"

  let cardcomResult: Awaited<ReturnType<typeof openLowProfile>>
  try {
    cardcomResult = await openLowProfile({
      amount,
      coinId,
      successUrl:   `${BASE_URL}/billing/success?session_id=${sessionId}`,
      errorUrl:     `${BASE_URL}/billing/error?session_id=${sessionId}`,
      indicatorUrl: `${BASE_URL}/api/billing/cardcom/indicator`,
      returnValue:  sessionId,
      pageLanguage: cardcomLang,
    })
  } catch (err) {
    console.error("[checkout/create] Cardcom error", err)
    return NextResponse.json({ success: false, message: "Payment gateway error" }, { status: 502 })
  }

  if (!cardcomResult.ok) {
    console.error("[checkout/create] Cardcom non-ok", cardcomResult.responseCode, cardcomResult.raw)
    return NextResponse.json(
      { success: false, message: "Failed to open payment page", cardcom_code: cardcomResult.responseCode },
      { status: 502 },
    )
  }

  // ── Update session with LowProfileCode ─────────────────────────────────────
  await serviceClient
    .from("checkout_sessions")
    .update({ status: "redirected", low_profile_code: cardcomResult.lowProfileCode, updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  return NextResponse.json({
    success:              true,
    checkout_session_id:  sessionId,
    redirect_url:         cardcomResult.redirectUrl,
  })
}
