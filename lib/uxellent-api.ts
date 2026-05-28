/**
 * lib/uxellent-api.ts
 * Server-side client for calling the app.uxellent.com billing API
 * to create invoice/receipt documents after a successful mioshy payment.
 *
 * Called only from server-side code (API routes / cron).
 * Uses UXELLENT_BILLING_API_URL + UXELLENT_BILLING_API_KEY env vars.
 *
 * Hard rules:
 *   - Never throw. All errors are caught and returned as
 *     { success: false, message, errorCode }.
 *   - Always send `idempotency_key` so retries do not produce duplicate
 *     invoices on the issuer side once the issuer honours the key.
 *   - The retry wrapper logs every failed attempt to
 *     mioshy_billing_failures so we have an immutable audit trail.
 */

import { logMioshyBillingFailure, type MioshyBillingErrorCode } from "@/lib/billing-failures"

export type CreateDocumentInput = {
  /** mioshy user id (Supabase auth.users.id) */
  user_id:          string
  email:            string
  /** Customer display name. Shown on the invoice as "לכבוד <name>". */
  name?:            string | null
  /** Customer phone (free-form, "054-1234567" or "+972-…"). Optional. */
  phone?:           string | null
  country:          string       // ISO-2
  amount:           number
  currency:         string       // "ILS" | "USD"
  language:         "he" | "en"
  is_israeli:       boolean
  plan:             string       // "weekly" | "monthly" | "annual" | one-time slug
  /**
   * Human-readable product description (Hebrew or English) that appears
   * on the invoice line, e.g. "הסקס של מיאושי" / "ליווי עם מיאושי" /
   * "משחקי זוגות אונליין" / a specific game title. When omitted, the
   * issuer falls back to a generic "מיאושי - עולם הזוגיות" line item,
   * which is regulatory-correct but opaque to the customer.
   */
  product_name?:    string | null
  /**
   * Real payment method label, e.g. "כרטיס אשראי" / "Bit" / "Apple Pay".
   * The issuer requires a concrete payment method on the receipt — never
   * a SaaS/service description. Defaults to "כרטיס אשראי" on the issuer
   * side when omitted (matches Cardcom's overwhelmingly-common card case).
   */
  payment_method?:  string | null
  /** Cardcom deal number for audit trail. ALSO drives the idempotency key. */
  deal_number?:     string | null
}

/**
 * VAT exemption flag — Itzik 2026-05-07.
 *
 * The mioshy advertised price is the FINAL price the customer pays
 * (e.g. ₪57/wk *includes* VAT). The uxellent issuer accepts a single
 * `is_vat_free` flag per Itzik:
 *
 *   • is_vat_free: true   → VAT-exempt (export to non-Israeli, no VAT
 *                            charged or split)
 *   • is_vat_free: false  → standard Israeli sale, the `amount` is
 *                            the gross/inclusive total — the issuer
 *                            splits VAT out backwards
 *                            (base = amount/1.17, vat = amount * 0.17/1.17).
 *
 * Without this field, the issuer was defaulting to "add 17% on top",
 * which is why a ₪1.00 charge produced a 1.17 line item.
 *
 * Mapping rule: Israeli customer → not VAT-free; non-Israeli → VAT-free.
 * Geo is server-trusted (Vercel edge headers), so we read it off the
 * `is_israeli` field that's already on the input.
 */
function deriveIsVatFree(isIsraeli: boolean): boolean {
  // Israeli customer = NOT VAT-free (VAT applies, included in amount).
  // Non-Israeli (export) = VAT-free (no VAT charged or split).
  return !isIsraeli
}

export type CreateDocumentResult =
  | { success: true;  document_url: string; document_id: string }
  | { success: false; message: string; errorCode: MioshyBillingErrorCode }

/**
 * Build a stable idempotency key. Falls back to the user_id if no deal
 * number is available (e.g. test paths) - that way retries within the
 * same call site still dedupe.
 */
export function buildIdempotencyKey(input: Pick<CreateDocumentInput, "deal_number" | "user_id">): string {
  const dn = (input.deal_number ?? "").trim()
  if (dn) return `mioshy:${dn}`
  return `mioshy:user:${input.user_id}`
}

/**
 * Single-attempt POST to the issuer.
 * Classifies failures so the retry wrapper can decide whether to retry
 * and so monitoring can group on errorCode.
 */
export async function createBillingDocument(
  input: CreateDocumentInput,
): Promise<CreateDocumentResult> {
  const apiUrl = process.env.UXELLENT_BILLING_API_URL
  const apiKey = process.env.UXELLENT_BILLING_API_KEY

  if (!apiUrl || !apiKey) {
    console.error("[uxellent-api] Missing UXELLENT_BILLING_API_URL or UXELLENT_BILLING_API_KEY")
    return { success: false, message: "Billing API not configured", errorCode: "missing_config" }
  }

  const idempotencyKey = buildIdempotencyKey(input)

  const body = {
    ...input,
    idempotency_key: idempotencyKey, // forward-compatible - issuer may use this to dedupe
    /* Tell the issuer whether this transaction is VAT-exempt. For
       Israeli customers (the default) the amount we send already
       includes 17% VAT, so the issuer must split it backwards instead
       of adding 17% on top. */
    is_vat_free: deriveIsVatFree(input.is_israeli),
  }

  let res: Response
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type":     "application/json",
        "x-api-key":        apiKey,
        "x-source":         "mioshy",
        "x-idempotency-key": idempotencyKey, // also send as header for issuers that read headers
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[uxellent-api] fetch threw", err)
    return {
      success: false,
      message: `Network error: ${(err as Error)?.message ?? "unknown"}`,
      errorCode: "network_error",
    }
  }

  type IssuerResponse = {
    success?:           boolean
    message?:           string
    document_url?:      string
    document_id?:       string
    idempotent_replay?: boolean
  }

  let json: IssuerResponse = {}
  try {
    json = (await res.json()) as IssuerResponse
  } catch {
    return {
      success: false,
      message: `Invalid JSON from billing API (HTTP ${res.status})`,
      errorCode: "invalid_json",
    }
  }

  if (!res.ok || !json.success) {
    console.error("[uxellent-api] create-document failed", res.status, json)
    const code: MioshyBillingErrorCode =
      res.status >= 500 ? "http_5xx" :
      res.status >= 400 ? "http_4xx" :
      "provider_error"
    return {
      success: false,
      message: String(json.message ?? `Billing API error (HTTP ${res.status})`),
      errorCode: code,
    }
  }

  return {
    success:      true,
    document_url: String(json.document_url ?? ""),
    document_id:  String(json.document_id  ?? ""),
  }
}

/**
 * Retry wrapper. Use this from every production call site.
 * - 3 attempts with exponential back-off (500ms, 1s, 2s).
 * - 4xx (client errors) are NOT retried - there is no point.
 * - Every failed attempt is logged to mioshy_billing_failures.
 * - On final failure returns { success: false, errorCode: 'retry_exhausted' }
 *   so the caller can decide what to do (typically: keep going, never block payment).
 */
export type CreateBillingDocumentWithRetryContext = {
  /** subscription_charges.id - wired into the failure rows for the repair cron. */
  chargeId?:        string | null
  /** subscriptions.id - for attribution. */
  subscriptionId?:  string | null
}

export async function createBillingDocumentWithRetry(
  input: CreateDocumentInput,
  ctx?: CreateBillingDocumentWithRetryContext,
): Promise<CreateDocumentResult> {
  const maxRetries = 3
  let lastResult: CreateDocumentResult = {
    success: false,
    message: "no_attempts_made",
    errorCode: "unknown",
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await createBillingDocument(input)
    if (res.success) return res

    lastResult = res

    // Log this attempt's failure (best-effort).
    await logMioshyBillingFailure({
      userId:         input.user_id,
      subscriptionId: ctx?.subscriptionId ?? null,
      chargeId:       ctx?.chargeId       ?? null,
      dealNumber:     input.deal_number   ?? null,
      errorMessage:   `attempt ${attempt + 1}/${maxRetries}: ${res.message}`,
      errorCode:      res.errorCode,
      payload:        input,
    })

    // 4xx - don't retry. Validation/auth issues won't fix themselves.
    if (res.errorCode === "http_4xx" || res.errorCode === "missing_config") break

    // Wait before next attempt (skip on the last iteration).
    if (attempt < maxRetries - 1) {
      const delayMs = 500 * Math.pow(2, attempt) // 500, 1000, 2000
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  // Final failure - record it under the stable retry_exhausted code so
  // alerting can fire even if the per-attempt rows are noisy.
  await logMioshyBillingFailure({
    userId:         input.user_id,
    subscriptionId: ctx?.subscriptionId ?? null,
    chargeId:       ctx?.chargeId       ?? null,
    dealNumber:     input.deal_number   ?? null,
    errorMessage:   `retry exhausted: ${lastResult.success === false ? lastResult.message : "unknown"}`,
    errorCode:      "retry_exhausted",
    payload:        input,
  })

  return {
    success: false,
    message: lastResult.success === false ? lastResult.message : "retry_exhausted",
    errorCode: "retry_exhausted",
  }
}
