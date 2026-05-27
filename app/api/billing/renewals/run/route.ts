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

  console.log("[renewals:START]", { invokedAt: now.toISOString(), method: req.method })

  // ── Find due subscriptions (max 20 per run) ─────────────────────────────────
  const { data: dueSubs } = await admin
    .from("subscriptions")
    .select("*, customer_payment_methods(id, token_enc, expiry_mmyy, status)")
    .in("status", ["active", "past_due"])
    .lte("next_billing_date", now.toISOString())
    .order("next_billing_date", { ascending: true })
    .limit(20)

  console.log("[renewals:FOUND]", { due_count: dueSubs?.length ?? 0 })

  if (!dueSubs?.length) {
    console.log("[renewals:END]", { processed: 0, reason: "no_due_subs" })
    return NextResponse.json({ processed: 0, results })
  }

  for (const sub of dueSubs) {
    const subId  = sub.id
    const userId = sub.user_id

    console.log("[renewals:SUB_START]", {
      sub_id: subId,
      user_id: userId,
      email: sub.email,
      product: sub.product,
      plan: sub.plan,
      amount: sub.plan_amount,
      currency: sub.currency,
      next_billing_date: sub.next_billing_date,
      failed_attempts: sub.failed_attempts,
    })

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
      console.log("[renewals:CARDCOM_CALL]", { sub_id: subId, asmachta, amount: sub.plan_amount, currency: sub.currency })
      const chargeResult = await chargeToken({
        token:        rawToken,
        tokenExDate:  pm.expiry_mmyy ?? undefined,
        sumToBill:    sub.plan_amount,
        coinId:       sub.coin_id,
        uniqAsmachta: asmachta,
      })
      console.log("[renewals:CARDCOM_RESPONSE]", { sub_id: subId, ok: chargeResult.ok, response_code: chargeResult.responseCode })

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
          status:               "active",
          current_period_end:   periodEnd.toISOString(),
          next_billing_date:    periodEnd.toISOString(),
          failed_attempts:      0,
          grace_until:          null,
          // v3 slice 5: clear journey grace columns on a successful
          // renewal so the user re-enters 'active' state and the
          // cadence engine resumes on the next tick. Harmless on
          // non-journey products (columns just stay NULL).
          journey_grace_until:  null,
          journey_blocked_at:   null,
        })
        .eq("id", subId)

      // Create invoice (with retry, structured failure logging, and
      // forward-compatible idempotency_key based on the asmachta).
      // Country: ISO-2; subscriptions table doesn't carry it, so we
      // default by is_israeli (matches the issuer schema requirement
      // of exactly 2 chars).
      //
      // Feature flag UXELLENT_BILLING_DISABLED - see indicator route
      // for full rationale. When set, renewals charge but skip invoice.
      const billingDisabled =
        String(process.env.UXELLENT_BILLING_DISABLED || "").toLowerCase() === "true"

      const invoiceResult = billingDisabled
        ? (() => {
            console.warn("[renewals] UXELLENT_BILLING_DISABLED=true - skipping invoice creation", {
              sub_id: subId, charge_id: chargeId, asmachta,
            })
            return {
              success: false as const,
              message: "skipped:UXELLENT_BILLING_DISABLED",
              errorCode: "unknown" as const,
            }
          })()
        : await createBillingDocumentWithRetry(
            {
              user_id:     userId,
              email:       sub.email ?? "",
              country:     sub.is_israeli ? "IL" : "US",
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

      console.log("[renewals:SUB_OK]", { sub_id: subId, asmachta, invoice_url: invoiceUrl })
      results.push({ sub_id: subId, status: "charged" })

    } catch (err) {
      console.error("[renewals:SUB_ERROR]", { sub_id: subId, error: String(err) })
      // Mark subscription past_due on unexpected error
      await admin
        .from("subscriptions")
        .update({ status: "past_due", failed_attempts: (sub.failed_attempts ?? 0) + 1 })
        .eq("id", subId)
        .then(() => {})

      results.push({ sub_id: subId, status: "error", error: String(err) })
    }
  }

  console.log("[renewals:END]", {
    processed: results.length,
    summary: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {}),
  })

  // ── Block subscriptions past grace period ───────────────────────────────────
  await admin
    .from("subscriptions")
    .update({ status: "blocked" })
    .eq("status", "past_due")
    .not("grace_until", "is", null)
    .lte("grace_until", now.toISOString())

  return NextResponse.json({ processed: results.length, results })
}

// Vercel cron invokes endpoints via GET, not POST. Without this alias
// every scheduled run returned 405 Method Not Allowed (audit 2026-05-27,
// `docs/weekly-billing-audit-2026-05-27.md`). Same fix applied to
// repair-missing-invoices. The journey crons already followed this
// pattern (see grace-watcher/route.ts).
export const GET = POST
