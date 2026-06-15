/**
 * Phone normalization for the WhatsApp Cloud API.
 *
 * Meta expects the recipient as digits only, with country code, no leading '+'
 * and no leading zeros. e.g. Israeli 050-123-4567 -> "972501234567".
 *
 * profiles.mobile is free-text and may arrive as:
 *   "050-1234567" | "0501234567" | "+972 50 123 4567" | "972501234567" | "972-50-1234567"
 */

const IL_COUNTRY_CODE = "972";

/**
 * Returns the WhatsApp-ready phone (digits only, country code, no '+'),
 * or null if the input cannot be confidently normalized.
 */
export function normalizePhoneForWhatsApp(
  raw: string | null | undefined,
  defaultCountryCode = IL_COUNTRY_CODE
): string | null {
  if (!raw) return null;

  // Keep digits only. A leading "+" is dropped (we never send '+').
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  // Already in international form for IL: "972XXXXXXXXX"
  if (digits.startsWith(defaultCountryCode)) {
    // Guard against "9720..." (country code followed by a national leading 0)
    const rest = digits.slice(defaultCountryCode.length);
    digits = defaultCountryCode + rest.replace(/^0+/, "");
    return isPlausible(digits) ? digits : null;
  }

  // National form starting with 0: "0501234567" -> drop the 0, prepend CC.
  if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.replace(/^0+/, "");
    return isPlausible(digits) ? digits : null;
  }

  // Bare national number without leading 0 (e.g. "501234567") — assume IL mobile.
  if (digits.length === 9) {
    digits = defaultCountryCode + digits;
    return isPlausible(digits) ? digits : null;
  }

  // Some other country already includes its CC — accept if plausibly long.
  return isPlausible(digits) ? digits : null;
}

function isPlausible(digits: string): boolean {
  // E.164 allows up to 15 digits; require at least a country code + subscriber.
  return digits.length >= 11 && digits.length <= 15;
}
