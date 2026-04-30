/**
 * POST /api/leads/upsert
 *
 * Creates a lead or returns the existing one if (email, device_id) already
 * exists. Uses service role so it can both INSERT and SELECT.
 *
 * Hardening:
 *   - Per-(IP + device_id) sliding-window rate limit (20 reqs / 10 min).
 *   - Never trusts a `user_id` sent from the client. We ignore whatever is
 *     in the body and re-derive `user_id` from the session cookie instead -
 *     the client sends a Bearer-less fetch, so the cookie is authoritative.
 *     If the caller is signed-out, the lead is stored with `user_id = null`.
 *   - Graceful recovery if the FK still fails (race with fresh auth rows):
 *     we retry the insert once with `user_id = null` so the lead is captured
 *     even if auth.users hasn't propagated yet.
 *
 * Body: { email, full_name?|name?, language, device_id, country_code?,
 *         country_name?, vat_rate_percent?, marketing_consent?,
 *         terms_accepted?, terms_accepted_at? }
 * Response: { success: true, lead_id: string, created: boolean }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }             from "next/server"
import { createAdminClient }        from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const FK_VIOLATION_CODE = "23503"

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
    // NOTE: we intentionally ignore `user_id` from the body - it is
    // re-derived server-side from the session cookie. This prevents a
    // malicious client from associating a lead with someone else's account
    // and it sidesteps Supabase's synthetic-user-id quirk that triggered the
    // leads_user_id_fkey violation in the wild.
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

  // ── Rate limit: 20 upserts / 10 min per (ip + device) ──────────────────────
  const ip  = getClientIp(req)
  const rl  = checkRateLimit(`leads:upsert:${ip}:${device_id}`, 20, 600)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, code: "RATE_LIMITED", message: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  // ── Re-derive user_id from session (authoritative) ─────────────────────────
  let trusted_user_id: string | null = null
  try {
    const supa = await createServerSupabaseClient()
    const { data: { user } } = await supa.auth.getUser()
    trusted_user_id = user?.id ?? null
  } catch {
    trusted_user_id = null
  }

  const admin = await createAdminClient()

  const resolvedName = typeof full_name === "string" && full_name.trim()
    ? full_name.trim()
    : typeof name === "string" && name.trim() ? name.trim() : null

  async function tryInsert(uid: string | null) {
    return admin
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
        user_id:           uid,
      })
      .select("id")
      .maybeSingle()
  }

  // ── Try to insert; on duplicate, fetch existing; on FK, retry w/ null ──────
  let { data: inserted, error: insertErr } = await tryInsert(trusted_user_id)

  // If the FK check blew up even though we trust the session - an auth.users
  // row might not be committed yet - retry once with null so we still capture
  // the lead.
  if (insertErr && (insertErr as unknown as { code?: string }).code === FK_VIOLATION_CODE) {
    console.warn("[leads/upsert] FK violation on user_id, retrying with null", {
      trusted_user_id,
      message: insertErr.message,
    })
    const retry = await tryInsert(null)
    inserted  = retry.data
    insertErr = retry.error
  }

  if (!insertErr && inserted?.id) {
    return NextResponse.json({ success: true, lead_id: inserted.id, created: true })
  }

  // Duplicate key (23505) → look up existing lead by (email, device_id).
  if (insertErr) {
    const code      = (insertErr as unknown as { code?: string }).code
    const isDuplicate =
      code === "23505" ||
      String(insertErr.message).includes("duplicate") ||
      String(insertErr.message).includes("unique")

    if (!isDuplicate) {
      const isCheckViolation =
        code === "23514" ||
        String(insertErr.message).includes("violates check constraint")
      if (isCheckViolation) {
        console.error("[leads/upsert] check constraint error", insertErr.message)
        return NextResponse.json({ success: false, message: "אימייל לא תקין" }, { status: 400 })
      }
      console.error("[leads/upsert] unexpected insert error", insertErr)
      return NextResponse.json({ success: false, message: insertErr.message }, { status: 500 })
    }

    const { data: existing } = await admin
      .from("leads")
      .select("id, status")
      .eq("email", email.trim().toLowerCase())
      .eq("device_id", device_id)
      .maybeSingle()

    if (!existing?.id) {
      return NextResponse.json(
        { success: false, message: "Lead conflict, could not resolve" },
        { status: 409 },
      )
    }

    // Backfill user_id on the existing row if the caller is now signed in.
    if (trusted_user_id) {
      await admin
        .from("leads")
        .update({ user_id: trusted_user_id })
        .eq("id", existing.id)
        .is("user_id", null)
    }

    return NextResponse.json({ success: true, lead_id: existing.id, created: false })
  }

  return NextResponse.json({ success: false, message: "Unknown error" }, { status: 500 })
}
