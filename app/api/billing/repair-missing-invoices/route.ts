/**
 * POST /api/billing/repair-missing-invoices
 *
 * Daily cron — heals subscriptions that paid successfully but never got
 * an invoice URL from the issuer.
 *
 * Auth: Bearer token in Authorization header, must equal
 *       CARDCOM_BILLING_CRON_SECRET (same secret used by /renewals/run).
 *
 * Selection (matches the user spec):
 *     status     = 'succeeded'
 *     invoice_url IS NULL
 *     created_at > now() - interval '30 days'
 *
 * For each row:
 *   1. Compose the same payload the original call used.
 *   2. Run createBillingDocumentWithRetry — which already retries 3x
 *      with back-off and logs every failure to mioshy_billing_failures.
 *   3. On success → update subscription_charges.invoice_url AND
 *      subscriptions.invoice_url.
 *   4. On failure → already logged by the retry wrapper. Continue loop.
 *
 * Hard rules:
 *   - Per-row failures NEVER stop the loop.
 *   - Endpoint always returns 200 with a structured summary.
 *   - Idempotent: re-running is a no-op for already-repaired rows.
 *
 * vercel.json:
 *   { "crons": [{ "path": "/api/billing/repair-missing-invoices", "schedule": "30 6 * * *" }] }
 *   (06:30 UTC daily, half an hour after /renewals/run)
 */

export const runtime     = "nodejs"
export const dynamic     = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { createBillingDocumentWithRetry } from "@/lib/uxellent-api"
import { logMioshyBillingFailure } from "@/lib/billing-failures"

type RepairRow = {
  charge_id:       string
  subscription_id: string | null
  user_id:         string | null
  deal_number:     string | null
  outcome:         "repaired" | "still_failed" | "skipped_no_data"
  error?:          string
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.CARDCOM_BILLING_CRON_SECRET
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url      = new URL(req.url)
  const dryRun   = url.searchParams.get("dry_run") === "true"
  const limit    = clampInt(Number(url.searchParams.get("limit") || "100"), 1, 500)

  const admin = await createAdminClient()
  const cutoffIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // ── Find candidates ─────────────────────────────────────────────────────
  // Join via the FK so we have the subscription metadata we need to compose
  // the issuer call (email, plan, currency, is_israeli).
  const { data: charges, error: chargesErr } = await admin
    .from("subscription_charges")
    .select(`
      id,
      user_id,
      subscription_id,
      amount,
      currency,
      uniq_asmachta,
      raw_response,
      created_at,
      subscriptions:subscription_id (
        id, email, plan, is_israeli, currency, status
      )
    `)
    .eq("status", "succeeded")
    .is("invoice_url", null)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (chargesErr) {
    return NextResponse.json(
      { ok: false, message: "Failed to list charges", error: chargesErr.message },
      { status: 500 },
    )
  }

  const rows: RepairRow[] = []
  let scanned  = 0
  let repaired = 0
  let failed   = 0

  for (const c of (charges || []) as any[]) {
    scanned++
    const sub = c.subscriptions as
      | { id: string; email: string; plan: string; is_israeli: boolean; currency: string; status: string }
      | null

    const dealNumber = extractDealNumber(c.raw_response, c.uniq_asmachta)

    const baseRow: RepairRow = {
      charge_id:       String(c.id),
      subscription_id: c.subscription_id ? String(c.subscription_id) : null,
      user_id:         c.user_id ? String(c.user_id) : null,
      deal_number:     dealNumber,
      outcome:         "skipped_no_data",
    }

    // Subscription required to compose the issuer payload.
    if (!sub || !c.user_id) {
      await logMioshyBillingFailure({
        userId:         c.user_id ? String(c.user_id) : null,
        chargeId:       String(c.id),
        dealNumber,
        errorMessage:   "repair-cron: missing subscription join data",
        errorCode:      "validation_error",
        payload:        { charge_id: c.id },
      })
      failed++
      rows.push(baseRow)
      continue
    }

    if (dryRun) {
      rows.push({ ...baseRow, outcome: "still_failed", error: "dry_run" })
      continue
    }

    const res = await createBillingDocumentWithRetry(
      {
        user_id:     String(c.user_id),
        email:       sub.email ?? "",
        country:     "", // not stored on charges; issuer accepts empty
        amount:      Number(c.amount),
        currency:    String(c.currency || sub.currency || "ILS"),
        language:    (sub.is_israeli ? "he" : "en") as "he" | "en",
        is_israeli:  Boolean(sub.is_israeli),
        plan:        String(sub.plan || ""),
        deal_number: dealNumber,
      },
      { chargeId: String(c.id), subscriptionId: String(sub.id) },
    )

    if (!res.success) {
      // Already logged inside the retry wrapper as 'retry_exhausted'.
      failed++
      rows.push({ ...baseRow, outcome: "still_failed", error: res.message })
      continue
    }

    try {
      await admin
        .from("subscription_charges")
        .update({ invoice_url: res.document_url, updated_at: new Date().toISOString() })
        .eq("id", c.id)

      if (sub?.id) {
        await admin
          .from("subscriptions")
          .update({ invoice_url: res.document_url })
          .eq("id", sub.id)
      }
      repaired++
      rows.push({ ...baseRow, outcome: "repaired" })
    } catch (e: any) {
      // Issuer succeeded but our local update failed — count it as a
      // failure so we re-run next cycle. Idempotent issuer means no
      // duplicate invoice; the local UPDATE will retry tomorrow.
      await logMioshyBillingFailure({
        userId:         String(c.user_id),
        subscriptionId: String(sub.id),
        chargeId:       String(c.id),
        dealNumber,
        errorMessage:   `repair-cron: invoice issued but local update failed: ${e?.message ?? String(e)}`,
        errorCode:      "unknown",
        payload:        { document_url: res.document_url, document_id: res.document_id },
      })
      failed++
      rows.push({ ...baseRow, outcome: "still_failed", error: String(e?.message ?? e) })
    }
  }

  return NextResponse.json({
    ok:       true,
    dry_run:  dryRun,
    scanned,
    repaired,
    failed,
    rows,
  })
}

// ─── helpers ────────────────────────────────────────────────────────────

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
}

/**
 * Best-effort extraction of the Cardcom InternalDealNumber so the
 * idempotency key is stable across the original call and the repair.
 * Falls back to `uniq_asmachta` so retries still dedupe.
 */
function extractDealNumber(rawResponse: any, uniqAsmachta: string | null): string | null {
  try {
    if (rawResponse && typeof rawResponse === "object") {
      const dn =
        rawResponse.deal_number ??
        rawResponse.InternalDealNumber ??
        rawResponse.internal_deal_number ??
        null
      if (dn) return String(dn)
    }
  } catch {
    // ignore
  }
  return uniqAsmachta ? String(uniqAsmachta) : null
}
