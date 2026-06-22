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
 * coach_nudge (UTILITY)
 * The out-of-window "you have a new message" nudge sent from the admin compose
 * when free text isn't allowed. Body (per spec §6): a greeting with {{1}} name
 * and {{2}} a link to the conversation in the app. The full message content
 * stays in-app / email; this just pulls the user back in.
 *
 * IMPORTANT: the visible wording lives in the Meta-approved template, NOT here.
 * This builder only fixes the template NAME + variable ORDER. Itzik finalises
 * the copy and submits it to WhatsApp Manager separately. If the approved
 * template adds a URL button, wire urlButton(suffix) into `components`.
 */
export function coachNudgeTemplate(args: {
  name: string;
  conversationUrl: string;
  languageCode?: "he" | "en";
}): TemplateSend {
  return {
    templateName: "coach_nudge",
    languageCode: args.languageCode ?? "he",
    category: "utility",
    components: [bodyText(args.name, args.conversationUrl)],
  };
}

export { urlButton };
