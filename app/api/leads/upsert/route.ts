/**
 * POST /api/leads/upsert
 *
 * Creates a lead or returns the existing one if (email, device_id) already exists.
 * Uses service role so it can both INSERT and SELECT (bypasses RLS read restriction).
 *
 * Body: { email, name?, language, device_id, country_code?, country_name?, vat_rate_percent }
 * Response: { success: true, lead_id: string, created: boolean }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }       from "next/server"
import { createAdminClient }  from "@/lib/supabase-admin"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const {
    email,
    full_name        = null,
    name             = null,
    language         = "he",
    device_id,
    country_code     = null,
    country_name     = null,
    vat_rate_percent = 0,
    marketing_consent  = false,
    terms_accepted     = false,
    terms_accepted_at  = null,
    user_id            = null,
  } = body

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ success: false, message: "Invalid email" }, { status: 400 })
  }
  if (!device_id || typeof device_id !== "string" || device_id.length < 8) {
    return NextResponse.json({ success: false, message: "Invalid device_id" }, { status: 400 })
  }
  if (!["he", "en"].includes(language)) {
    return NextResponse.json({ success: false, message: "Invalid language" }, { status: 400 })
  }

  const admin = await createAdminClient()

  const resolvedName = typeof full_name === "string" && full_name.trim()
    ? full_name.trim()
    : typeof name === "string" && name.trim() ? name.trim() : null

  // ── Try to insert; on duplicate, fetch existing ─────────────────────────────
  const { data: inserted, error: insertErr } = await admin
    .from("leads")
    .insert({
      email:             email.trim().toLowerCase(),
      full_name:         resolvedName,
      name:              resolvedName,
      language,
      device_id,
      status:            "new",
      country_code:      country_code || null,
      country_name:      country_name || null,
      vat_rate_percent:  typeof vat_rate_percent === "number" ? vat_rate_percent : 0,
      marketing_consent: !!marketing_consent,
      terms_accepted:    !!terms_accepted,
      terms_accepted_at: terms_accepted && terms_accepted_at ? terms_accepted_at : null,
      user_id:           user_id || null,
    })
    .select("id")
    .maybeSingle()

  if (!insertErr && inserted?.id) {
    return NextResponse.json({ success: true, lead_id: inserted.id, created: true })
  }

  // Duplicate key (code 23505) or any other insert error → look up existing lead
  if (insertErr) {
    const isDuplicate =
      (insertErr as unknown as { code?: string }).code === "23505" ||
      String(insertErr.message).includes("duplicate") ||
      String(insertErr.message).includes("unique")

    if (!isDuplicate) {
      // Surface a human-readable message for check constraint failures
      const isCheckViolation =
        (insertErr as unknown as { code?: string }).code === "23514" ||
        String(insertErr.message).includes("violates check constraint")
      if (isCheckViolation) {
        console.error("[leads/upsert] check constraint error", insertErr.message)
        return NextResponse.json({ success: false, message: "אימייל לא תקין" }, { status: 400 })
      }
      console.error("[leads/upsert] unexpected insert error", insertErr)
      return NextResponse.json({ success: false, message: insertErr.message }, { status: 500 })
    }

    // Fetch the existing lead by (email, device_id)
    const { data: existing } = await admin
      .from("leads")
      .select("id, status")
      .eq("email", email.trim().toLowerCase())
      .eq("device_id", device_id)
      .maybeSingle()

    if (!existing?.id) {
      // Edge case: could be a different unique violation (e.g. status constraint)
      return NextResponse.json({ success: false, message: "Lead conflict, could not resolve" }, { status: 409 })
    }

    return NextResponse.json({ success: true, lead_id: existing.id, created: false })
  }

  return NextResponse.json({ success: false, message: "Unknown error" }, { status: 500 })
}
