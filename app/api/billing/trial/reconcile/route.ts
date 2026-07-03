/**
 * POST /api/billing/trial/reconcile
 *
 * Webhook-independent trial activation (Task 26, Itzik 2026-07-03). The success
 * page calls this when the poll hasn't seen 'paid' in time. It looks up the
 * caller's OWN trial checkout session, finds the Cardcom LowProfileId stored at
 * create time, and runs the SAME processTrialLowProfile routine the webhook uses
 * — which pulls the authoritative J2 result server-side and creates the trialing
 * subscription. Idempotent with the webhook (shared billing_events key), so a
 * late webhook and this reconcile never double-create.
 *
 * Body: { session_id }
 * Response: { ok, status }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse }                 from "next/server"
import { createServerSupabaseClient }   from "@/lib/supabase/server"
import { createAdminClient }            from "@/lib/supabase-admin"
import { processTrialLowProfile }       from "@/lib/billing/process-trial-lowprofile"

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, status: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === "string" ? body.session_id : ""
  if (!sessionId) {
    return NextResponse.json({ ok: false, status: "missing_session" }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: session } = await admin
    .from("checkout_sessions")
    .select("id, user_id, is_trial, low_profile_code, status")
    .eq("id", sessionId)
    .maybeSingle()

  // Ownership + shape checks (never reconcile someone else's session).
  if (!session || session.user_id !== auth.user.id) {
    return NextResponse.json({ ok: false, status: "not_found" }, { status: 404 })
  }
  if (!session.is_trial) {
    return NextResponse.json({ ok: false, status: "not_a_trial" }, { status: 400 })
  }
  if (session.status === "paid") {
    return NextResponse.json({ ok: true, status: "already" })
  }
  const lowProfileId = (session.low_profile_code as string | null) ?? ""
  if (!lowProfileId) {
    // The redirect landed before create-trial stamped the LP code, or the user
    // abandoned Cardcom. Nothing to reconcile yet.
    return NextResponse.json({ ok: false, status: "no_lowprofile" })
  }

  try {
    const r = await processTrialLowProfile({ lowProfileId, returnValue: sessionId })
    return NextResponse.json({ ok: r.ok, status: r.status })
  } catch (err) {
    console.error("[trial/reconcile] threw", err)
    return NextResponse.json({ ok: false, status: "error" }, { status: 500 })
  }
}
