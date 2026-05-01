/**
 * lib/billing-failures.ts
 * Best-effort persistence of post-payment failures into
 * public.mioshy_billing_failures (migration 048).
 *
 * Hard rule: this helper NEVER throws. Logging is a side-channel.
 * If the DB itself is sick, we still console.error so at least the
 * Vercel function logs capture the original failure.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin"

export type MioshyBillingErrorCode =
  | "network_error"
  | "http_5xx"
  | "http_4xx"
  | "invalid_json"
  | "provider_error"
  | "retry_exhausted"
  | "missing_config"
  | "validation_error"
  | "unknown"

export type LogMioshyBillingFailureParams = {
  /** End-user (auth.users.id) who paid. Null for cron/system events. */
  userId?:         string | null
  /** Subscription row id for attribution. Optional for one-time buys. */
  subscriptionId?: string | null
  /** subscription_charges.id (so the repair cron can join). */
  chargeId?:       string | null
  /** Cardcom InternalDealNumber for cross-system tracing. */
  dealNumber?:     string | null
  /** Human-readable description (kept short, used in dashboards). */
  errorMessage:    string
  /** Stable code for alert grouping. Defaults to "unknown". */
  errorCode?:      MioshyBillingErrorCode
  /** Original request body (PII-light only — never card data). */
  payload?:        unknown
}

/**
 * Persist a failure row. Always returns — never throws.
 * Returns the inserted row id when known, or null on any error path.
 */
export async function logMioshyBillingFailure(
  params: LogMioshyBillingFailureParams,
): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    if (!admin) {
      console.error("[mioshy-billing-failures] no service-role client; failure NOT persisted", {
        error_code: params.errorCode ?? "unknown",
        error_message: params.errorMessage,
        deal_number: params.dealNumber ?? null,
      })
      return null
    }

    const { data, error } = await admin
      .from("mioshy_billing_failures")
      .insert({
        user_id:         params.userId         ?? null,
        subscription_id: params.subscriptionId ?? null,
        charge_id:       params.chargeId       ?? null,
        deal_number:     params.dealNumber     ?? null,
        error_message:   params.errorMessage,
        error_code:      params.errorCode      ?? "unknown",
        payload:         sanitizePayload(params.payload),
      })
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[mioshy-billing-failures] insert failed", {
        error_code: params.errorCode ?? "unknown",
        error_message: params.errorMessage,
        db_error: error.message,
      })
      return null
    }
    return (data?.id as string) ?? null
  } catch (err) {
    // Last resort: do not let logging itself break the caller.
    console.error("[mioshy-billing-failures] threw while logging", {
      error_code: params.errorCode ?? "unknown",
      error_message: params.errorMessage,
      log_error: String((err as Error)?.message ?? err),
    })
    return null
  }
}

/**
 * Defensive PII scrub. We don't expect card data in payload (the
 * uxellent API never sees it), but we strip a few obvious keys just
 * in case a future caller is sloppy.
 */
function sanitizePayload(p: unknown): unknown {
  if (!p || typeof p !== "object") return p ?? null
  const blocked = new Set(["card", "card_number", "cvv", "token", "token_enc", "password"])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (blocked.has(k.toLowerCase())) continue
    out[k] = v
  }
  return out
}
