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
import {
  productNameForSubscription,
  brandToPaymentMethod,
} from "@/lib/uxellent-billing-helpers"
import { createAdminClient }       from "@/lib/supabase-admin"
import { notifyAdminPool }         from "@/lib/journey-content/notifications"

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
  // 'trialing' is included: a 7-day-trial sub carries next_billing_date =
  // trial_ends_at, so the same next_billing_date <= now filter makes it "due"
  // for its FIRST real charge on day 7. On success the shared branch below
  // transitions it trialing → active.
  const { data: dueSubs } = await admin
    .from("subscriptions")
    .select("*, customer_payment_methods(id, token_enc, expiry_mmyy, status, card_brand)")
    .in("status", ["active", "past_due", "trialing"])
    .lte("next_billing_date", now.toISOString())
    .order("next_billing_date", { ascending: true })
    .limit(20)

  console.log("[renewals:FOUND]", { due_count: dueSubs?.length ?? 0 })

  if (!dueSubs?.length) {
    console.log("[renewals:END]", { processed: 0, reason: "no_due_subs" })
    return NextResponse.json({ processed: 0, results })
  }

  // ── Filter out test users (Itzik 2026-06-01) ────────────────────────────────
  // Test users get all entitlements via the gate; their subscription
  // rows (if any exist from legacy purchases) must never trigger a
  // real charge. We fetch the flag for every due user in one batch.
  const userIds = Array.from(new Set(dueSubs.map((s) => s.user_id as string)))
  const { data: testFlags } = await admin
    .from("profiles")
    .select("id, is_test_user")
    .in("id", userIds)
  const testUserIdSet = new Set(
    ((testFlags ?? []) as Array<{ id: string; is_test_user: boolean }>)
      .filter((r) => r.is_test_user)
      .map((r) => r.id),
  )
  const filteredSubs = dueSubs.filter((s) => {
    const isTest = testUserIdSet.has(s.user_id as string)
    if (isTest) {
      console.log("[renewals:SKIP_TEST_USER]", {
        sub_id: s.id,
        user_id8: (s.user_id as string).slice(0, 8),
      })
    }
    return !isTest
  })
  if (filteredSubs.length === 0) {
    console.log("[renewals:END]", {
      processed: 0,
      skipped_test_users: dueSubs.length,
      reason: "all_due_are_test_users",
    })
    return NextResponse.json({ processed: 0, skipped_test_users: dueSubs.length, results })
  }

  for (const sub of filteredSubs) {
    const subId  = sub.id
    const userId = sub.user_id
    // A trialing sub reaching the cron = its FIRST real charge (day 7). We
    // capture this before any status change so failure alerts the admin.
    const wasTrialing = sub.status === "trialing"

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
      const pm = (sub as unknown as { customer_payment_methods: { id: string; token_enc: string; expiry_mmyy: string | null; status: string; card_brand: string | null } | null }).customer_payment_methods
      if (!pm || pm.status !== "active") {
        throw new Error("No active payment method")
      }

      // ── Decrypt token ───────────────────────────────────────────────────────
      const rawToken = decryptToken(pm.token_enc)

      // ── Compute next period ─────────────────────────────────────────────────
      const periodStart = new Date(sub.current_period_end ?? now)
      const periodEnd   = addPlanPeriod(periodStart, sub.plan)

      // ── First-month promo (marketing-discounts-spec §6.3) ───────────────────
      // Charge the discounted intro amount for the first N renewals, then the
      // full plan_amount. The remaining counter is decremented ONLY after a
      // successful charge (see the success branch below), so a failed charge
      // never loses or double-spends a discounted renewal.
      const useIntro = (sub.intro_charges_remaining ?? 0) > 0 && sub.intro_amount != null
      const billAmount = useIntro ? sub.intro_amount : sub.plan_amount

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
            amount:              billAmount,
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
      console.log("[renewals:CARDCOM_CALL]", { sub_id: subId, asmachta, amount: billAmount, use_intro: useIntro, intro_remaining: sub.intro_charges_remaining ?? 0, currency: sub.currency })
      const chargeResult = await chargeToken({
        token:        rawToken,
        tokenExDate:  pm.expiry_mmyy ?? undefined,
        sumToBill:    billAmount,
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

        // A3: the day-7 first charge of a trial failing is worth an admin
        // alert (card passed J2 but has no funds / was cancelled by issuer).
        // The existing grace/retry path still applies. Best-effort, throttled.
        if (wasTrialing) {
          await notifyAdminPool({
            kind: "trial_first_charge_failed",
            subject: "Mioshy: 7-day trial first charge FAILED",
            payload: {
              throttle_key: subId,
              preview: `Trial first charge failed for sub ${subId} (${sub.product}). Cardcom code ${chargeResult.responseCode}. Now in ${GRACE_PERIOD_DAYS}-day grace.`,
              sub_id: subId,
              product: sub.product,
              amount: billAmount,
              currency: sub.currency,
              cardcom_code: chargeResult.responseCode,
            },
            throttleKey: subId,
          }).catch((e) => console.error("[renewals] admin alert failed", e))
        }

        results.push({ sub_id: subId, status: wasTrialing ? "trial_charge_failed" : "charge_failed", error: chargeResult.responseCode })
        continue
      }

      // ── Charge succeeded ────────────────────────────────────────────────────
      // Update subscription. When this was a discounted intro charge, burn one
      // remaining (only here, post-success — a failed charge above never gets
      // this far, so the counter can't be lost or double-spent).
      await admin
        .from("subscriptions")
        .update({
          status:               "active",
          current_period_end:   periodEnd.toISOString(),
          next_billing_date:    periodEnd.toISOString(),
          failed_attempts:      0,
          grace_until:          null,
          ...(useIntro
            ? { intro_charges_remaining: Math.max(0, (sub.intro_charges_remaining ?? 0) - 1) }
            : {}),
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

      // ── Pull profile for invoice fields (name + phone) ─────────────────────
      // The subscriptions row carries email + is_israeli, but no display
      // name or phone. We pull both from profiles for the BKMV-compliant
      // invoice fields. Either may legitimately be NULL — we forward null
      // and the issuer renders the receipt without that line. Profile
      // lookup is best-effort: on error we proceed with nulls rather
      // than block the renewal invoice.
      let profileName:  string | null = null
      let profilePhone: string | null = null
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name, mobile")
          .eq("id", userId)
          .maybeSingle<{ full_name: string | null; mobile: string | null }>()
        profileName  = profile?.full_name?.trim() || null
        profilePhone = profile?.mobile?.trim()    || null
      } catch (err) {
        console.warn("[renewals] profile lookup failed - continuing with nulls", {
          user_id: userId, sub_id: subId, error: String(err),
        })
      }

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
              user_id:        userId,
              email:          sub.email ?? "",
              name:           profileName,
              phone:          profilePhone,
              country:        sub.is_israeli ? "IL" : "US",
              amount:         billAmount,
              currency:       sub.currency,
              language:       (sub.is_israeli ? "he" : "en") as "he" | "en",
              is_israeli:     sub.is_israeli,
              plan:           sub.plan,
              // Renewals are always recurring pillar subs — no target game.
              product_name:   productNameForSubscription(sub.product),
              // pm.card_brand was captured at the original first-purchase
              // (see indicator route's customer_payment_methods upsert).
              payment_method: brandToPaymentMethod(pm.card_brand),
              deal_number:    asmachta, // idempotency anchor for renewals
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

      if (wasTrialing) {
        await notifyAdminPool({
          kind: "trial_first_charge_failed",
          subject: "Mioshy: 7-day trial first charge ERROR",
          payload: {
            throttle_key: subId,
            preview: `Trial first charge threw for sub ${subId} (${sub.product}): ${String(err)}`,
            sub_id: subId,
            product: sub.product,
            error: String(err),
          },
          throttleKey: subId,
        }).catch((e) => console.error("[renewals] admin alert failed", e))
      }

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
