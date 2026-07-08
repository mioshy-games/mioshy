/**
 * Template definitions for the two launch flows.
 *
 * Each builder returns the args expected by sendWhatsAppToUser / sendTemplate.
 * Keep wording transactional + user-specific so Meta keeps approving these as
 * UTILITY (cheaper, faster approval) and not MARKETING.
 *
 * IMPORTANT: the template NAME + variable ORDER here must exactly match what
 * was submitted and approved in WhatsApp Manager.
 */

import type { TemplateComponent } from "./client";

export type TemplateSend = {
  templateName: string;
  languageCode: string;
  category: "utility" | "authentication" | "marketing";
  components: TemplateComponent[];
};

function bodyText(...values: string[]): TemplateComponent {
  return {
    type: "body",
    parameters: values.map((text) => ({ type: "text", text })),
  };
}

/** URL button whose dynamic suffix is appended to the template's base URL. */
function urlButton(suffix: string): TemplateComponent {
  return {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: suffix }],
  };
}

/**
 * journey_reminder (UTILITY)
 * Body: "פרק חדש מחכה לכם... {{1}} ו{{2}}... {{3}}"
 *   {{1}} name, {{2}} partner name, {{3}} short item URL
 */
export function journeyReminderTemplate(args: {
  name: string;
  partnerName: string;
  itemUrl: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "journey_reminder",
    languageCode: args.languageCode ?? "he",
    category: "utility",
    components: [bodyText(args.name, args.partnerName, args.itemUrl)],
  };
}

/**
 * partner_invite (UTILITY)
 * Body: "{{1}} מזמין/ה אתכם להצטרף... {{2}}"
 *   {{1}} inviter name, {{2}} invite URL
 */
export function partnerInviteTemplate(args: {
  inviterName: string;
  inviteUrl: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "partner_invite",
    languageCode: args.languageCode ?? "he",
    category: "utility",
    components: [bodyText(args.inviterName, args.inviteUrl)],
  };
}

/**
 * coach_welcome (UTILITY)
 * Sent ONCE to a new journey trial/subscription joiner right after the
 * subscription is created. New wording is masculine throughout (זכר) — the
 * fixed copy uses the male form ("ממתין").
 *   {{1}} first name
 *   {{2}} assigned expert name (default "יצחק ברלב")
 *   {{3}} selected category (the assessment area the user chose)
 *
 * NOTE (2026-07-07): cherry-picked verbatim from feat/whatsapp-campaigns
 * (PR #6) so the admin test-send route works on this branch before that PR
 * merges. When PR #6 lands the two definitions are identical — resolve the
 * overlap by keeping one copy.
 */
export function coachWelcomeTemplate(args: {
  name: string;
  expertName?: string;
  category: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "coach_welcome",
    languageCode: args.languageCode ?? "he",
    category: "utility",
    components: [
      bodyText(args.name, args.expertName || "יצחק ברלב", args.category),
    ],
  };
}

/**
 * intro_price_expiry_reminder (MARKETING)
 * Sent 24h after assessment completion, ONLY to users who have not purchased
 * (checked at send time). Its URL button is STATIC in the approved template, so
 * no button parameter is sent — only the two body params.
 *   {{1}} first name
 *   {{2}} expiry day + time — a full phrase, e.g. "מחר בשעה 21:00". Build it
 *         from the promo close time with expiryLabelFromCloseTime() so BOTH the
 *         day word and the hour stay dynamic.
 *
 * NOTE (2026-07-07): cherry-picked verbatim from feat/whatsapp-campaigns
 * (PR #6) — see coachWelcomeTemplate above.
 */
export function introPriceExpiryReminderTemplate(args: {
  name: string;
  expiryLabel: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "intro_price_expiry_reminder",
    languageCode: args.languageCode ?? "he",
    category: "marketing",
    components: [bodyText(args.name, args.expiryLabel)],
  };
}

const ISRAEL_TZ = "Asia/Jerusalem";

/** Day word by calendar-day distance in Israel time. */
const EXPIRY_DAY_WORDS: Record<number, string> = {
  0: "היום",
  1: "מחר",
  2: "מחרתיים",
};

/**
 * Israel-local calendar day as an integer ordinal, so two instants can be
 * differenced into whole calendar days regardless of DST. We read the wall-clock
 * Y/M/D in Asia/Jerusalem and re-encode it via Date.UTC purely as a counter —
 * the UTC frame here is a differencing device, never displayed.
 */
function israelDayOrdinal(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/**
 * Build the intro_price_expiry_reminder {{2}} phrase from the promo close time,
 * fully DST-aware (Asia/Jerusalem). Both the day word AND the hour are derived
 * from the actual close instant:
 *   same Israel day → "היום בשעה 21:00"
 *   next day        → "מחר בשעה 21:00"
 *   two days out    → "מחרתיים בשעה 21:00"
 *   further out     → "בתאריך 12.07 בשעה 21:00"
 */
export function expiryLabelFromCloseTime(closeAt: Date, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(closeAt);

  const diff = israelDayOrdinal(closeAt) - israelDayOrdinal(now);
  const dayWord = EXPIRY_DAY_WORDS[diff];
  if (dayWord) {
    return `${dayWord} בשעה ${time}`;
  }

  const date = new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(closeAt);
  return `בתאריך ${date} בשעה ${time}`;
}

export { urlButton };
