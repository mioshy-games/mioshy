/**
 * lib/cardcom.ts
 * Cardcom payment gateway client for mioshy.
 * Terminal 183655 - same terminal as app.ux.
 */

function cfg() {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER
  const apiUsername    = process.env.CARDCOM_API_USERNAME
  const apiPassword    = process.env.CARDCOM_API_PASSWORD
  if (!terminalNumber || !apiUsername || !apiPassword) {
    throw new Error("Missing Cardcom env vars: CARDCOM_TERMINAL_NUMBER / CARDCOM_API_USERNAME / CARDCOM_API_PASSWORD")
  }
  return { terminalNumber, apiUsername, apiPassword }
}

/** Parse Cardcom's response - either JSON or &-separated key=value pairs. */
export function parseCardcomResponse(raw: string): Record<string, string> {
  const text = (raw ?? "").trim()
  if (!text) return {}
  if (text.startsWith("{")) {
    try { return JSON.parse(text) } catch { /* fall through */ }
  }
  const result: Record<string, string> = {}
  new URLSearchParams(text.replace(/^\?/, "")).forEach((v, k) => {
    result[k] = v
  })
  return result
}

/**
 * Open a LowProfile session (Operation=2: charge + create reusable token).
 * Returns the Cardcom redirect URL and LowProfileCode on success.
 */
export async function openLowProfile(args: {
  amount: number
  coinId: number           // 1 = ILS, 2 = USD
  successUrl: string
  errorUrl: string
  indicatorUrl: string
  returnValue: string      // opaque value echoed back - we use checkout session id
  pageLanguage?: string    // "he" | "en"
}) {
  const c = cfg()
  const form = new URLSearchParams({
    Operation:            "2",
    TerminalNumber:       c.terminalNumber,
    UserName:             c.apiUsername,
    UserPassword:         c.apiPassword,
    SumToBill:            args.amount.toFixed(2),
    CoinId:               String(args.coinId),
    APILevel:             "10",
    Codepage:             "65001",
    SuccessRedirectUrl:   args.successUrl,
    ErrorRedirectUrl:     args.errorUrl,
    IndicatorUrl:         args.indicatorUrl,
    ReturnValue:          args.returnValue,
  })
  if (args.pageLanguage) form.set("Language", args.pageLanguage)

  const res  = await fetch("https://secure.cardcom.solutions/Interface/LowProfile.aspx", {
    method:  "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body:    form,
  })
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const responseCode   = String(parsed.ResponseCode ?? "")
  const lowProfileCode = String(parsed.LowProfileCode ?? "").trim()
  const redirectUrl    = String(parsed.url ?? "").trim()

  return {
    ok: responseCode === "0" && !!lowProfileCode && !!redirectUrl,
    responseCode,
    lowProfileCode,
    redirectUrl,
    parsed,
    raw,
  }
}

/**
 * Pull the authoritative indicator status for a completed LowProfile.
 * Always call this server-side - never trust redirect URL params alone.
 */
export async function pullLowProfileIndicator(lowProfileCode: string) {
  const c  = cfg()
  const qs = new URLSearchParams({
    terminalnumber: c.terminalNumber,
    username:       c.apiUsername,
    lowprofilecode: lowProfileCode,
    codepage:       "65001",
  })

  const res    = await fetch(`https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx?${qs}`)
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const operationResponse = Number(parsed.OperationResponse ?? NaN)
  const paid              = Number.isFinite(operationResponse) && operationResponse === 0
  const dealNumber        = String(parsed.InternalDealNumber ?? "").trim() || null

  return { paid, operationResponse, dealNumber, parsed, raw }
}

/** Helpers to extract a token from indicator response (field names vary). */
function firstNonEmpty(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = typeof v === "string" ? v.trim() : ""
    if (s) return s
  }
  return null
}

export function extractToken(indicator: Record<string, string>) {
  const token = firstNonEmpty(
    indicator.Token,
    indicator["ExtShvaParams.CardToken"],
    indicator["ExtShvaParams.CardToken_15"],
    indicator["TokenToCharge.Token"],
  )
  if (!token) return null

  return {
    token,
    tokenExDate: firstNonEmpty(
      indicator.TokenExDate,
      indicator.Tokef_30,
      indicator["ExtShvaParams.Tokef30"],
    ),
    brand: firstNonEmpty(
      indicator.Mutag_24,
      indicator["ExtShvaParams.Mutag24"],
      indicator.Mutag,
    ),
    cardNumStart: firstNonEmpty(indicator.CardNumStart,  indicator["ExtShvaParams.FirstCardDigits"]),
    cardNumEnd:   firstNonEmpty(indicator.CardNumEnd,    indicator["ExtShvaParams.CardNumber5"]),
  }
}

/**
 * Normalise Cardcom's token expiry date to MMYY.
 * Cardcom may return 20280201 / 202802 / 0228 / 02/28 etc.
 */
export function normalizeExpiry(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  if (digits.length === 8) {                    // 20280201
    const yr = digits.slice(2, 4)
    const mo = digits.slice(4, 6)
    return +mo >= 1 && +mo <= 12 ? `${mo}${yr}` : null
  }
  if (digits.length === 6) {                    // 202802
    const yr = digits.slice(2, 4)
    const mo = digits.slice(4, 6)
    return +mo >= 1 && +mo <= 12 ? `${mo}${yr}` : null
  }
  if (digits.length === 4) {                    // 0228
    const mo = digits.slice(0, 2)
    return +mo >= 1 && +mo <= 12 ? digits : null
  }
  return null
}

/**
 * Charge a stored token (for subscription renewals).
 */
export async function chargeToken(args: {
  token:         string
  tokenExDate?:  string | null
  sumToBill:     number
  coinId:        number
  uniqAsmachta:  string
}) {
  const c    = cfg()
  const form = new URLSearchParams({
    TerminalNumber:                  c.terminalNumber,
    UserName:                        c.apiUsername,
    CodePage:                        "65001",
    "TokenToCharge.Token":           args.token,
    "TokenToCharge.SumToBill":       args.sumToBill.toFixed(2),
    "TokenToCharge.CoinID":          String(args.coinId),
    "TokenToCharge.APILevel":        "10",
    "TokenToCharge.UniqAsmachta":    args.uniqAsmachta,
    "TokenToCharge.UserPassword":    c.apiPassword,
  })
  if (args.tokenExDate) {
    // Bug fix 2026-05-27 (round 2): Cardcom's ChargeToken API expects
    // expiry as TWO SEPARATE fields, not a single TokenExDate. Per the
    // official Cardcom example URL on their domain:
    //   TokenToCharge.CardValidityMonth=10
    //   TokenToCharge.CardValidityYear=2024
    // Sending TokenExDate (in any of MMYY/YYMM/YYYYMM formats) caused
    // ResponseCode=60000416 + Description="תאריך תוקף לא במבנה תקין".
    // Our DB stores MMYY (per normalizeExpiry above), e.g. "1230" for
    // December 2030. We split into month+full-year and send both.
    // See docs/weekly-billing-audit-2026-05-27.md.
    const mmyy = args.tokenExDate
    if (mmyy.length === 4) {
      const month = mmyy.slice(0, 2)        // "12"
      const yy    = mmyy.slice(2, 4)         // "30"
      form.set("TokenToCharge.CardValidityMonth", String(parseInt(month, 10))) // "12"
      form.set("TokenToCharge.CardValidityYear",  `20${yy}`)                   // "2030"
    }
  }
  // JParameter=5 marks this as a recurring/standing-order charge. Cardcom
  // requires this for ChargeToken renewals; without it, some terminals
  // reject the call even with a valid token + expiry. Per the official
  // example URL.
  form.set("TokenToCharge.JParameter", "5")

  const res    = await fetch("https://secure.cardcom.solutions/interface/ChargeToken.aspx", {
    method:  "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body:    form,
  })
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const responseCode = String(parsed.ResponseCode ?? "")
  const ok           = responseCode === "0"
  return { ok, responseCode, parsed, raw }
}
