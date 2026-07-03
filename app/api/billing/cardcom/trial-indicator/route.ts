/**
 * /api/billing/cardcom/trial-indicator   (GET and POST)
 *
 * Cardcom v11 webhook for the 7-day trial ONLY. SEPARATE from the standard
 * /api/billing/cardcom/indicator (old interface, charges — untouched).
 *
 * Thin transport wrapper: it extracts LowProfileId + ReturnValue from the
 * callback (query on GET, JSON/form on POST) and hands off to the shared
 * processTrialLowProfile() routine. The SAME routine also backs the success
 * page's reconcile fallback, so the trial is created even if this webhook is
 * never delivered. Never trusts the callback body — the authoritative result is
 * pulled server-side inside the routine.
 *
 * No charge and no invoice happen here — the FIRST real charge is made on day 7
 * by /api/billing/renewals/run.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { processTrialLowProfile }      from "@/lib/billing/process-trial-lowprofile"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * Extract LowProfileId + ReturnValue from a v11 webhook regardless of how
 * Cardcom delivers them (query string on GET, or JSON/form body on POST),
 * case-insensitively.
 */
async function extractIds(req: Request): Promise<{ lowProfileId: string; returnValue: string }> {
  const out = { lowProfileId: "", returnValue: "" }
  const pick = (k: string, v: string) => {
    const key = k.toLowerCase()
    if (!v) return
    if (key === "lowprofileid") out.lowProfileId = out.lowProfileId || v
    if (key === "returnvalue")  out.returnValue  = out.returnValue  || v
  }

  try {
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) pick(k, v)
  } catch { /* ignore */ }

  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || ""
    try {
      if (ct.includes("application/json")) {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === "string" || typeof v === "number") pick(k, String(v))
        }
      } else {
        const text = await req.text()
        new URLSearchParams(text).forEach((v, k) => pick(k, v))
      }
    } catch { /* ignore */ }
  }
  return out
}

async function handle(req: Request): Promise<Response> {
  // Rate limit (same posture as the standard indicator).
  const ip = getClientIp(req)
  const { ok: rlOk, retryAfterSec } = checkRateLimit(`trial-indicator:${ip}`, 10, 60)
  if (!rlOk) {
    return new Response("ok", { status: 200, headers: { "Retry-After": String(retryAfterSec) } })
  }

  const { lowProfileId, returnValue } = await extractIds(req)
  console.log("[trial-indicator:START]", {
    has_lp: !!lowProfileId,
    return_value: returnValue || "(empty)",
    method: req.method,
  })

  // Always respond 200 to Cardcom.
  if (!lowProfileId) {
    console.warn("[trial-indicator:NO_ID] missing LowProfileId")
    return new Response("ok", { status: 200 })
  }

  // All the real work (idempotency, J2 result pull, token vault, trialing sub,
  // abuse ledger, mark-paid) lives in the shared routine so the success-page
  // reconcile fallback runs the EXACT same path.
  try {
    const r = await processTrialLowProfile({ lowProfileId, returnValue })
    console.log("[trial-indicator:RESULT]", { status: r.status, session_id: r.sessionId })
  } catch (err) {
    console.error("[trial-indicator:THREW]", err)
  }
  return new Response("ok", { status: 200 })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
