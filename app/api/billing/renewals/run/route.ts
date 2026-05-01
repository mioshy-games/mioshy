/**
 * POST /api/billing/renewals/run
 *
 * Cron endpoint - charge subscriptions whose next_billing_date is due.
 * Protected by CARDCOM_BILLING_CRON_SECRET bearer token.
 *
 * Vercel cron: add to vercel.json:
 *   { "crons": [{ "path": "/api/billing/renewals/run", "schedule": "0 6 * * *" }] }
 * (runs daily at 06:00 UTC)
 */

export const runtime  = "nodejs"
export const dynamic  = "force-dynamic"
export const maxDuration = 300   // 5 min Vercel function limit

import { NextResponse }            from "next/server"
import { chargeToken }             from "@/lib/cardcom"
import { decryptToken }            from "@/lib/tokenCrypto"
import { addPlanPeriod, makeAsmachta, GRACE_PERIOD_DAYS } from "@/lib/billing"
import { createBillingDocumentWithRetry } from "@/lib/uxellent-api"
import { createAdminClient }       from "@/lib/supabase-admin"

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CARDCOM_BILLING_CRON_SECRET
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin    = await createAdminClient()
  const now      = new Date()
  const results: Array<{ sub_id: string; status: string; error?: string }> = []

  // ── Find due subscriptions (max 20 per run) ─────────────────────────────────
  const { data: dueSubs } = await admin
    .from("subscriptions")
    .select("*, customer_payment_methods(id, token_enc, expiry_mmyy, status)")
    .in("status", ["active", "past_due"])
    .lte("next_billing_date", now.toISOString())
    .order("next_billing_date", { ascending: true })
    .limit(20)

  if (!dueSubs?.length) {
    return NextResponse.json({ processed: 0, results })
  }

  for (const sub of dueSubs) {
    const subId  = sub.id
    const userId = sub.user_id

    try {
      // ── Validate payment method ─────────────────────────────────────────────
      const pm = (sub as unknown as { customer_payment_methods: { id: string; token_enc: string; expiry_mmyy: string | null; status: string } | null }).customer_payment_methods
      if (!pm || pm.status !== "active") {
        throw new Error("No active payment method")
      }

      // ── Decrypt token ───────────────────────────────────────────────────────
      const rawToken = decryptToken(pm.token_enc)

      // ── Compute next period ─────────────────────────────────────────────────
      const periodStart = new Date(sub.current_period_end ?? now)
      const periodEnd   = addPlanPeriod(periodStart, sub.plan)

      // ── Idempotent asmachta ─────────────────────────────────────────────────
      const asmachta = makeAsmachta(userId, periodStart)

      // Skip if already charged for this period
      const { data: existCharge } = await admin
        .from("subscription_charges")
        .select("id, status")
        .eq("uniq_asmachta", asmachta)
        .maybeSingle()

      if (existCharge?.status === "succeeded") {
        results.push({ sub_id: subId, status: "already_charged" })
        continue
      }

      // ── Insert charge row (pending) ─────────────────────────────────────────
      const { data: charge } = await admin
        .from("subscription_charges")
        .upsert(
          {
            user_id:             userId,
            subscription_id:     subId,
            payment_method_id:   pm.id,
            amount:              sub.plan_amount,
            currency:            sub.currency,
            status:              "created",
            uniq_asmachta:       asmachta,
            billing_period_start: periodStart.toISOString(),
            billing_period_end:   periodEnd.toISOString(),
          },
          { onConflict: "uniq_asmachta" },
        )
        .select("id")
        .maybeSingle()

      const chargeId = charge?.id

      // ── Call Cardcom ChargeToken ────────────────────────────────────────────
      const chargeResult = await chargeToken({
        token:        rawToken,
        tokenExDate:  pm.expiry_mmyy ?? undefined,
        sumToBill:    sub.plan_amount,
        coinId:       sub.coin_id,
        uniqAsmachta: asmachta,
      })

      if (!chargeResult.ok) {
        // Failed charge
        if (chargeId) {
          await admin
            .from("subscription_charges")
            .update({ status: "failed", raw_response: chargeResult.parsed, updated_at: now.toISOString() })
            .eq("id", chargeId)
        }

        const newAttempts = (sub.failed_attempts ?? 0) + 1
        const gracePeriod = new Date(now.getTime() + GRACE_PERIOD_DAYS * 86_400_000)
        await admin
          .from("subscriptions")
          .update({
            status:          "past_due",
            failed_attempts: newAttempts,
            grace_until:     gracePeriod.toISOString(),
          })
          .eq("id", subId)

        results.push({ sub_id: subId, status: "charge_failed", error: chargeResult.responseCode })
        continue
      }

      // ── Charge succeeded ────────────────────────────────────────────────────
      // Update subscription
      await admin
        .from("subscriptions")
        .update({
          status:              "active",
          current_period_end:  periodEnd.toISOString(),
          next_billing_date:   periodEnd.toISOString(),
          failed_attempts:     0,
          grace_until:         null,
        })
        .eq("id", subId)

      // Create invoice (with retry, structured failure logging, and
      // forward-compatible idempotency_key based on the asmachta).
      const invoiceResult = await createBillingDocumentWithRetry(
        {
          user_id:     userId,
          email:       sub.email ?? "",
          country:     "",
          amount:      sub.plan_amount,
          currency:    sub.currency,
          language:    (sub.is_israeli ? "he" : "en") as "he" | "en",
          is_israeli:  sub.is_israeli,
          plan:        sub.plan,
          deal_number: asmachta, // idempotency anchor for renewals
        },
        { chargeId, subscriptionId: subId },
      )

      const invoiceUrl = invoiceResult.success ? invoiceResult.document_url : null

      if (chargeId) {
        await admin
          .from("subscription_charges")
          .update({
            status:       "succeeded",
            raw_response: chargeResult.parsed,
            invoice_url:  invoiceUrl,
            updated_at:   now.toISOString(),
          })
          .eq("id", chargeId)
      }

      if (invoiceUrl) {
        await admin.from("subscriptions").update({ invoice_url: invoiceUrl }).eq("id", subId)
      }

      results.push({ sub_id: subId, status: "charged" })

    } catch (err) {
      // Mark subscription past_due on unexpected error
      await admin
        .from("subscriptions")
        .update({ status: "past_due", failed_attempts: (sub.failed_attempts ?? 0) + 1 })
        .eq("id", subId)
        .then(() => {})

      results.push({ sub_id: subId, status: "error", error: String(err) })
    }
  }

  // ── Block subscriptions past grace period ───────────────────────────────────
  await admin
    .from("subscriptions")
    .update({ status: "blocked" })
    .eq("status", "past_due")
    .not("grace_until", "is", null)
    .lte("grace_until", now.toISOString())

  return NextResponse.json({ processed: results.length, results })
}
