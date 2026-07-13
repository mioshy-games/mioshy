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

export interface ChargeTokenArgs {
  token:           string
  cardExpiryMMYY?: string | null    // DB stores MMYY, e.g. "1230"
  sumToBill:       number
  coinId:          number
  uniqAsmachta:    string
  cardOwner?: {
    fullName?:       string | null
    identityNumber?: string | null   // ת.ז. — decrypted just before the call
    phone?:          string | null
    email?:          string | null
  }
}

/** True when we have cardholder details to send (FullName and/or ת.ז.). */
function hasCardOwnerInfo(o: ChargeTokenArgs["cardOwner"]): boolean {
  return !!(o && (o.fullName || o.identityNumber))
}

/**
 * Charge a stored token (for subscription renewals).
 *
 * ROUTING (2026-07-13, ResponseCode 60000004 fix — TRIAL-ONLY, protect regular):
 *   • Payment methods that carry the cardholder's FullName + IdentityNumber
 *     (ת.ז.) — i.e. 7-day-trial tokens created on the v11 CreateTokenOnly page
 *     and stored via processTrialLowProfile — charge through the v11 JSON API,
 *     which echoes those details in CardOwnerInformation. The Israeli acquirer
 *     requires them or it declines with 60000004 ("סירוב מחברת האשראי").
 *   • Everything else (regular / legacy subs with no stored owner info) keeps
 *     the PROVEN old .aspx ChargeToken path, byte-for-byte unchanged. This
 *     deliberately does NOT touch regular renewals — no owner info, no new
 *     behaviour, no regression risk. (Itzik's call: fix the trial, guard regular.)
 */
export async function chargeToken(args: ChargeTokenArgs) {
  return hasCardOwnerInfo(args.cardOwner)
    ? chargeTokenV11(args)
    : chargeTokenAspx(args)
}

/**
 * v11 charge with CardOwnerInformation — used ONLY when owner details exist.
 * A plain Transaction with a Token and NO JValidateType is a regular immediate
 * debit (JValidateType is only for J2/J5 validation flows — never set here).
 * Idempotency is via ExternalUniqTranId (a duplicate returns Cardcom error 608).
 */
async function chargeTokenV11(args: ChargeTokenArgs) {
  const c = cfg()

  const payload: Record<string, unknown> = {
    TerminalNumber:     Number(c.terminalNumber),
    ApiName:            c.apiUsername,
    Amount:             Number(args.sumToBill.toFixed(2)),
    Token:              args.token,
    ISOCoinId:          args.coinId,
    ExternalUniqTranId: args.uniqAsmachta,   // dedup → Cardcom returns 608 on repeat
    // ApiPassword lives under Advanced for v11; mirrors the auth the old .aspx
    // charge sent, and a real debit is more sensitive than tokenization.
    Advanced:           { ApiPassword: c.apiPassword },
  }
  if (args.cardExpiryMMYY) payload.CardExpirationMMYY = args.cardExpiryMMYY

  const owner = args.cardOwner
  if (owner && (owner.fullName || owner.identityNumber || owner.phone || owner.email)) {
    payload.CardOwnerInformation = {
      ...(owner.fullName       ? { FullName:        owner.fullName }       : {}),
      ...(owner.identityNumber ? { IdentityNumber:  owner.identityNumber } : {}),
      ...(owner.phone          ? { Phone:           owner.phone }          : {}),
      ...(owner.email          ? { CardOwnerEmail:  owner.email }          : {}),
    }
  }

  // NOTE (2026-07-13): sending a Document (Cardcom-issued TaxInvoiceAndReceipt)
  // was tested and REJECTED with ResponseCode 601 ("אין מודול מסמכים") — terminal
  // 183655 has no Cardcom documents module (invoices are issued via the external
  // uxellent issuer instead). Do NOT add a Document here or every charge fails
  // before it reaches the card.

  const res    = await fetch(`${CARDCOM_V11_BASE}/Transactions/Transaction`, {
    method:  "POST",
    headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
    body:    JSON.stringify(payload),
  })
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const responseCode = String(parsed.ResponseCode ?? "")
  const ok           = responseCode === "0"
  return { ok, responseCode, parsed, raw }
}

/**
 * Legacy .aspx ChargeToken — the proven path for regular/legacy renewals
 * (unchanged from before the 60000004 trial fix). Do NOT alter its behaviour.
 */
async function chargeTokenAspx(args: ChargeTokenArgs) {
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
  if (args.cardExpiryMMYY) {
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
    const mmyy = args.cardExpiryMMYY
    if (mmyy.length === 4) {
      const month = mmyy.slice(0, 2)        // "12"
      const yy    = mmyy.slice(2, 4)         // "30"
      form.set("TokenToCharge.CardValidityMonth", String(parseInt(month, 10))) // "12"
      form.set("TokenToCharge.CardValidityYear",  `20${yy}`)                   // "2030"
    }
  }
  // NOTE (2026-06-16 audit): we intentionally do NOT send a J parameter here.
  // Per Cardcom's official docs, JParameter=5 is "אישור בלבד" (authorization
  // only / credit-limit hold) — it does NOT actually charge the card, it just
  // reserves the amount and auto-releases after days/weeks. The previous J5
  // caused issuer declines (60000004) across multiple valid cards and
  // ghost "successful" renewals that never settled.
  // The default ChargeToken transaction is a regular, immediate debit —
  // identical to the initial purchase (LowProfile Operation=2), which works.
  // See docs/cardcom-token-charge-audit-2026-06-16.md.

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

// ════════════════════════════════════════════════════════════════════════════
// Cardcom v11 JSON API — 7-day trial signup (₪1 charge-and-tokenize)
//
// ⚠️ ISOLATION: these functions are SEPARATE from openLowProfile/chargeToken
// above (old .aspx interface, all regular purchases). Do NOT touch those.
//
// MODEL CHANGE (2026-07-13): the trial used to tokenize with J2
// (Operation="CreateTokenOnly" + JValidateType=2) — validation only, NO charge.
// J2 proved a card *valid* but NOT *chargeable*: cards …5229/…5336 passed J2 yet
// declined the real day-7 debit with 60000004. We now mint the token exactly
// like a regular purchase — a real ₪1 charge that creates an Operation=2 token
// (Operation="ChargeAndCreateToken") — and REFUND the ₪1 immediately
// (refundTransaction, CancelOnly). A card that can't be charged fails at signup
// instead of on day 7. Verified against the live OpenAPI (swagger/v11).
// ════════════════════════════════════════════════════════════════════════════

const CARDCOM_V11_BASE = "https://secure.cardcom.solutions/api/v11"

/**
 * Open a v11 LowProfile page that CHARGES `amount` (the ₪1 validation charge)
 * and creates a reusable Operation=2 token. Used exclusively by the 7-day trial
 * signup. The ₪1 is refunded immediately after by the webhook/reconcile path
 * (processTrialLowProfile → refundTransaction). `amount` here is the validation
 * charge (₪1), NOT the post-trial price (that is snapshotted on the session).
 */
export async function createTrialTokenLowProfile(args: {
  amount: number           // validation charge (₪1) — actually charged, then refunded
  coinId: number           // 1 = ILS, 2 = USD
  successUrl: string
  errorUrl: string
  webhookUrl: string
  returnValue: string      // opaque echo value — we use the checkout session id
  pageLanguage?: string    // "he" | "en"
}) {
  const c = cfg()
  const payload: Record<string, unknown> = {
    TerminalNumber:     Number(c.terminalNumber),
    ApiName:            c.apiUsername,
    // Charge + create a reusable token (same as a regular purchase). NOTE: no
    // AdvancedDefinition/JValidateType — that is only for J2/J5 validation flows.
    Operation:          "ChargeAndCreateToken",
    Amount:             Number(args.amount.toFixed(2)),
    ISOCoinId:          args.coinId,
    ReturnValue:        args.returnValue,
    SuccessRedirectUrl: args.successUrl,
    FailedRedirectUrl:  args.errorUrl,
    WebHookUrl:         args.webhookUrl,
  }
  if (args.pageLanguage) payload.Language = args.pageLanguage

  const res = await fetch(`${CARDCOM_V11_BASE}/LowProfile/Create`, {
    method:  "POST",
    headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
    body:    JSON.stringify(payload),
  })
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const responseCode = String(parsed.ResponseCode ?? "")
  const lowProfileId = String(parsed.LowProfileId ?? "").trim()
  const redirectUrl  = String(parsed.Url ?? "").trim()

  return {
    ok: responseCode === "0" && !!lowProfileId && !!redirectUrl,
    responseCode,
    description: String(parsed.Description ?? ""),
    lowProfileId,
    redirectUrl,
    parsed,
    raw,
  }
}

/**
 * Pull the authoritative v11 result for a completed trial LowProfile.
 * `validated` (ResponseCode===0) means the J2 validation passed AND a token
 * was created. Always call this server-side from the trial webhook — never
 * trust redirect params.
 *
 * NOTE: for CreateTokenOnly the card digits live in `TranzactionInfo`, which
 * Cardcom documents as "may be null" for token-only operations. J2 runs a real
 * Shva transaction so it is usually populated, but callers MUST treat
 * last4/first6/brand as best-effort (used only for the abuse fingerprint, which
 * falls back to the token hash). The token itself comes from `TokenInfo`.
 */
export async function getTrialLpResult(lowProfileId: string) {
  const c = cfg()
  const res = await fetch(`${CARDCOM_V11_BASE}/LowProfile/GetLpResult`, {
    method:  "POST",
    headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
    body:    JSON.stringify({
      TerminalNumber: Number(c.terminalNumber),
      ApiName:        c.apiUsername,
      LowProfileId:   lowProfileId,
    }),
  })
  const raw    = await res.text()

  // v11 returns nested JSON — parse fully (not the flat &-pair helper).
  let obj: Record<string, unknown> = {}
  try { obj = JSON.parse(raw) } catch { /* leave empty → validated=false */ }

  const responseCode = Number((obj.ResponseCode as number | string | undefined) ?? NaN)
  const validated    = responseCode === 0

  const tokenInfo = (obj.TokenInfo ?? {}) as Record<string, unknown>
  const tranInfo  = (obj.TranzactionInfo ?? {}) as Record<string, unknown>
  const uiVals    = (obj.UIValues ?? {}) as Record<string, unknown>

  const token = firstNonEmpty(tokenInfo.Token as string) || null

  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    return s || null
  }

  return {
    validated,
    responseCode: String(responseCode),
    description:  String((obj.Description as string | undefined) ?? ""),
    token,
    // TokenExDate is yyyyMMdd — normalizeExpiry() turns it into MMYY.
    tokenExDate:  str(tokenInfo.TokenExDate),
    last4:        str(tranInfo.Last4CardDigitsString) ?? str(tranInfo.Last4CardDigits),
    first6:       str(tranInfo.FirstCardDigits),
    brand:        str(tranInfo.Brand) ?? str(tranInfo.CardName),
    // Cardholder identity captured on the Cardcom payment page. REQUIRED by the
    // v11 charge API (CardOwnerInformation) — without it the acquirer declines
    // token charges with ResponseCode 60000004 ("סירוב מחברת האשראי"). Prefer
    // TranzactionInfo (clean values) over UIValues/TokenInfo (which may carry a
    // trailing space on the id). str() trims either way.
    cardOwnerName:           str(tranInfo.CardOwnerName) ?? str(uiVals.CardOwnerName),
    cardOwnerIdentityNumber: str(tranInfo.CardOwnerIdentityNumber)
                             ?? str(uiVals.CardOwnerIdentityNumber)
                             ?? str(tokenInfo.CardOwnerIdentityNumber),
    cardOwnerPhone:          str(tranInfo.CardOwnerPhone) ?? str(uiVals.CardOwnerPhone),
    cardOwnerEmail:          str(tranInfo.CardOwnerEmail) ?? str(uiVals.CardOwnerEmail),
    // TranzactionId of the ₪1 ChargeAndCreateToken deal — the id refundTransaction
    // voids/refunds immediately after the trial is created. Prefer TranzactionInfo,
    // fall back to the top-level TranzactionId.
    dealNumber:   str(tranInfo.TranzactionId) ?? str(obj.TranzactionId),
    parsed:       obj,
    raw,
  }
}

/**
 * Refund (or void) a Cardcom transaction by its TranzactionId.
 * Used to reverse the ₪1 trial validation charge immediately after signup.
 *
 * `cancelOnly` (default true) → CancelOnly: void the deal BEFORE it settles —
 * cleaner than a post-settlement refund and produces no separate refund movement.
 * If the deal has already settled, retry with cancelOnly:false for a real refund.
 */
export async function refundTransaction(args: {
  transactionId: number | string
  cancelOnly?:   boolean
}) {
  const c = cfg()
  const res = await fetch(`${CARDCOM_V11_BASE}/Transactions/RefundByTransactionId`, {
    method:  "POST",
    headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
    body:    JSON.stringify({
      ApiName:       c.apiUsername,
      ApiPassword:   c.apiPassword,
      TransactionId: Number(args.transactionId),
      CancelOnly:    args.cancelOnly ?? true,
    }),
  })
  const raw    = await res.text()
  const parsed = parseCardcomResponse(raw)

  const responseCode   = String(parsed.ResponseCode ?? "")
  const ok             = responseCode === "0"
  const newTransactionId = parsed.NewTranzactionId != null ? String(parsed.NewTranzactionId) : null
  return { ok, responseCode, newTransactionId, parsed, raw }
}
