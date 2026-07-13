/**
 * POST /api/billing/trial/refund-repair   (GET = POST for Vercel cron)
 *
 * Retries the ₪1 trial-validation refund for any charge that didn't reverse on
 * the first attempt (trial_validation_charges.refund_status = 'pending'). The
 * trial itself is already granted — this cron only chases the outstanding ₪1 so
 * we never leave a dangling charge on a user's card.
 *
 * Auth: Bearer CARDCOM_BILLING_CRON_SECRET (same secret as /renewals/run).
 *
 * Per row:
 *   1. refundTransaction(CancelOnly) — void the ₪1 deal.
 *   2. Success → refund_status='refunded', refund_deal_id, refunded_at.
 *   3. Failure → attempts++, last_error. After MAX_ATTEMPTS → refund_status='failed'
 *      + admin alert (needs a manual refund in the Cardcom dashboard).
 *
 * Hard rules: per-row failures never stop the loop; always 200 with a summary;
 * idempotent (already-refunded rows are not selected).
 *
 * vercel.json cron: path "/api/billing/trial/refund-repair", every 2 hours.
 */

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 300

import { NextResponse }        from "next/server"
import { createAdminClient }   from "@/lib/supabase-admin"
import { refundTransaction }   from "@/lib/cardcom"
import { notifyAdminPool }     from "@/lib/journey-content/notifications"

const MAX_ATTEMPTS = 6   // ~12h of 2-hourly retries before we give up + alert

export async function POST(req: Request) {
  const secret = process.env.CARDCOM_BILLING_CRON_SECRET
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await createAdminClient()
  const now   = new Date()
  const results: Array<{ id: string; outcome: string; rc?: string }> = []

  // Outstanding refunds only. Cap per run; the cron reruns every 2h.
  const { data: pending } = await admin
    .from("trial_validation_charges")
    .select("id, deal_id, attempts, checkout_session_id")
    .eq("refund_status", "pending")
    .order("created_at", { ascending: true })
    .limit(50)

  console.log("[trial-refund-repair:START]", { pending: pending?.length ?? 0 })

  for (const row of pending ?? []) {
    const attempts = (row.attempts ?? 0) + 1
    try {
      const refund = await refundTransaction({ transactionId: row.deal_id, cancelOnly: true })
      if (refund.ok) {
        await admin.from("trial_validation_charges").update({
          refund_status:  "refunded",
          refund_deal_id: refund.newTransactionId,
          refunded_at:    now.toISOString(),
          attempts,
        }).eq("id", row.id)
        results.push({ id: row.id, outcome: "refunded" })
        continue
      }

      const giveUp = attempts >= MAX_ATTEMPTS
      await admin.from("trial_validation_charges").update({
        refund_status: giveUp ? "failed" : "pending",
        attempts,
        last_error: `RC=${refund.responseCode}`,
      }).eq("id", row.id)
      results.push({ id: row.id, outcome: giveUp ? "gave_up" : "retry", rc: refund.responseCode })

      if (giveUp) {
        await notifyAdminPool({
          kind: "trial_validation_refund_failed",
          subject: "Mioshy: trial ₪1 refund STILL failing — manual refund needed",
          payload: {
            throttle_key: row.deal_id,
            preview: `₪1 refund for deal ${row.deal_id} failed ${attempts}× (last RC ${refund.responseCode}). Marked 'failed' — refund manually in Cardcom.`,
            deal_id: row.deal_id,
            session_id: row.checkout_session_id,
            cardcom_code: refund.responseCode,
          },
          throttleKey: row.deal_id,
        }).catch((e) => console.error("[trial-refund-repair] alert failed", e))
      }
    } catch (err) {
      await admin.from("trial_validation_charges").update({
        attempts, last_error: String(err),
      }).eq("id", row.id)
      results.push({ id: row.id, outcome: "error", rc: String(err) })
    }
  }

  console.log("[trial-refund-repair:END]", {
    processed: results.length,
    summary: results.reduce<Record<string, number>>((a, r) => { a[r.outcome] = (a[r.outcome] ?? 0) + 1; return a }, {}),
  })
  return NextResponse.json({ processed: results.length, results })
}

// Vercel cron invokes endpoints via GET, not POST — alias to avoid 405.
export const GET = POST
