/**
 * lib/uxellent-api.ts
 * Server-side client for calling the app.uxellent.com billing API
 * to create invoice/receipt documents after a successful mioshy payment.
 *
 * Called only from server-side code (API routes).
 * Uses UXELLENT_BILLING_API_URL + UXELLENT_BILLING_API_KEY env vars.
 */

export type CreateDocumentInput = {
  /** mioshy user id */
  user_id:          string
  email:            string
  name?:            string | null
  country:          string       // ISO-2
  amount:           number
  currency:         string       // "ILS" | "USD"
  language:         "he" | "en"
  is_israeli:       boolean
  plan:             string       // "weekly" | "monthly" | "annual"
  /** Cardcom deal number for audit trail */
  deal_number?:     string | null
}

export type CreateDocumentResult =
  | { success: true;  document_url: string; document_id: string }
  | { success: false; message: string }

/**
 * POST to the uxellent billing API to issue an invoice/receipt.
 * Returns the document URL to save on the subscription.
 */
export async function createBillingDocument(
  input: CreateDocumentInput,
): Promise<CreateDocumentResult> {
  const apiUrl = process.env.UXELLENT_BILLING_API_URL
  const apiKey = process.env.UXELLENT_BILLING_API_KEY

  if (!apiUrl || !apiKey) {
    console.error("[uxellent-api] Missing UXELLENT_BILLING_API_URL or UXELLENT_BILLING_API_KEY")
    return { success: false, message: "Billing API not configured" }
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key":    apiKey,
        "x-source":     "mioshy",
      },
      body: JSON.stringify(input),
    })

    const json = await res.json().catch(() => ({ success: false, message: "Invalid JSON from billing API" }))

    if (!res.ok || !json.success) {
      console.error("[uxellent-api] create-document failed", res.status, json)
      return { success: false, message: String(json?.message ?? "Billing API error") }
    }

    return {
      success:      true,
      document_url: String(json.document_url ?? ""),
      document_id:  String(json.document_id  ?? ""),
    }
  } catch (err) {
    console.error("[uxellent-api] fetch error", err)
    return { success: false, message: "Network error calling billing API" }
  }
}
