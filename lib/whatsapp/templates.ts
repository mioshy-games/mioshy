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
 * marathon_day (UTILITY)
 * The daily 7-day-marathon message. Fixed scaffolding lives in the
 * Meta-approved template; only the three variables change per day, so editing
 * the day's copy (domain + activity, from CMS) needs NO template re-approval:
 *   Body: "יום {{1}} מתוך 7 · {{2}}\n\nהמשימה שלכם להיום, 5 דקות יחד:\n{{3}}\n\nנתראה מחר 💛"
 *   {{1}} day number (1-7), {{2}} domain/theme, {{3}} the activity text.
 * Sent proactively (outside the 24h window) → MUST be an approved template.
 */
export function marathonDayTemplate(args: {
  day: number;
  domain: string;
  activity: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "marathon_day",
    languageCode: args.languageCode ?? "he",
    category: "utility",
    components: [bodyText(String(args.day), args.domain, args.activity)],
  };
}

/**
 * marathon_welcome (UTILITY)
 * Enrollment confirmation, sent once on signup. Static (no variables) — the
 * wording lives in the Meta-approved template; Itzik supplies the final copy
 * (the §6 draft, aligned to 7 days). Also proactive → must be a template.
 */
export function marathonWelcomeTemplate(args?: {
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "marathon_welcome",
    languageCode: args?.languageCode ?? "he",
    category: "utility",
    components: [],
  };
}

export { urlButton };
