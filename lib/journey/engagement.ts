/**
 * lib/journey/engagement.ts
 * Builds the per-user engagement schedule from an Analysis + the template library.
 *
 * Responsibilities:
 *  - buildSchedulePlan(analysis, startAt): produce a list of planned sends
 *    (template_key + offset) covering 26 weeks.
 *  - renderTemplate(body, vars): replace {{placeholders}}.
 *  - A stub `sendViaProvider` that delegates to email/SMS services via
 *    environment config. Real providers (Mailgun / Twilio / WhatsApp) plug in
 *    behind that function.
 */

import type { Analysis, Axis, Locale } from "./types";

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export interface PlannedSend {
  template_key: string; // matches message_templates.key
  offset_days: number;
  reason: string; // for audit / debugging
  condition?: (a: Analysis) => boolean;
}

/**
 * The base 26-week arc.
 * Keys must exist in `message_templates.key` once the admin seeds them.
 * Conditional sends are only added when their predicate returns true for
 * the specific user's analysis.
 */
const BASE_PLAN: PlannedSend[] = [
  { template_key: "w00_welcome_personalized", offset_days: 0, reason: "onboarding" },
  { template_key: "w01_love_map_deep_dive", offset_days: 3, reason: "week_1_love_map" },
  { template_key: "w02_seven_day_appreciation", offset_days: 10, reason: "week_2_fondness" },
  { template_key: "w03_missed_bids", offset_days: 17, reason: "week_3_turn_toward" },
  { template_key: "w04_love_language_action", offset_days: 24, reason: "week_4_love_language" },
  {
    template_key: "w05_conflict_repair_phrases",
    offset_days: 31,
    reason: "week_5_repair",
    condition: (a) => a.conflict_health < 60 || a.four_horsemen_flag,
  },
  { template_key: "w06_passion_autonomy", offset_days: 38, reason: "week_6_autonomy" },
  { template_key: "w07_passion_anticipation", offset_days: 45, reason: "week_7_anticipation" },
  { template_key: "w08_playful_rituals", offset_days: 52, reason: "week_8_play" },
  {
    template_key: "w09_shared_meaning_goals",
    offset_days: 59,
    reason: "week_9_shared_meaning",
    condition: (a) => (a.axis_scores["shared_meaning"] ?? 1) < 0.5,
  },
  { template_key: "w10_mid_program_checkin", offset_days: 66, reason: "mid_checkin" },
  { template_key: "w12_partner_invite", offset_days: 84, reason: "partner_invite" },
  { template_key: "w16_habit_consolidation", offset_days: 112, reason: "habit" },
  { template_key: "w20_second_half_reassess", offset_days: 140, reason: "reassess" },
  { template_key: "w26_program_graduation", offset_days: 182, reason: "graduation" },
];

export function buildSchedulePlan(
  analysis: Analysis,
  startAt: Date = new Date(),
): Array<{
  template_key: string;
  scheduled_for: Date;
  reason: string;
}> {
  const plan = BASE_PLAN.filter((p) => !p.condition || p.condition(analysis));
  return plan.map((p) => {
    const scheduled = new Date(startAt.getTime() + p.offset_days * 24 * 60 * 60 * 1000);
    return {
      template_key: p.template_key,
      scheduled_for: scheduled,
      reason: p.reason,
    };
  });
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

/**
 * Replace {{var}} placeholders. Unknown vars render as empty string.
 * No Turing-complete logic — that's deliberate; admins should not ship code.
 */
export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export interface TemplateVars {
  first_name: string;
  friendship_score: number;
  conflict_health: number;
  passion_risk: number;
  primary_love_language: string;
  top_gap: string;
  language: Locale;
}

export function varsFromAnalysis(
  analysis: Analysis,
  firstName: string,
  language: Locale,
): TemplateVars {
  return {
    first_name: firstName,
    friendship_score: analysis.friendship_score,
    conflict_health: analysis.conflict_health,
    passion_risk: analysis.passion_risk,
    primary_love_language: analysis.primary_love_language ?? "",
    top_gap: analysis.top_gap ?? "",
    language,
  };
}

// ---------------------------------------------------------------------------
// Sending (provider-agnostic wrapper)
// ---------------------------------------------------------------------------

export interface SendRequest {
  to: string;
  subject?: string;
  body: string;
  channel: "email" | "sms" | "whatsapp";
  locale: Locale;
}

export interface SendResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Provider adapter stub.
 * Wire these to SendGrid / Mailgun / Twilio / WhatsApp Cloud API via env vars.
 * Keep this thin — all business logic lives in the scheduler.
 */
export async function sendViaProvider(req: SendRequest): Promise<SendResult> {
  // Email path: SENDGRID_API_KEY / MAILGUN_API_KEY
  // SMS path:   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
  // WhatsApp:   WHATSAPP_CLOUD_TOKEN + WHATSAPP_PHONE_ID
  //
  // This stub returns success in DRY_RUN and logs; swap in real HTTP calls
  // in a follow-up PR. Deliberately small surface so swapping is trivial.

  if (process.env.ENGAGEMENT_DRY_RUN === "1") {
    console.info("[engagement] DRY_RUN send", {
      to: req.to,
      channel: req.channel,
      subjectLen: req.subject?.length ?? 0,
      bodyLen: req.body.length,
    });
    return { success: true, providerId: `dryrun_${Date.now()}` };
  }

  return {
    success: false,
    error: "No provider configured. Set ENGAGEMENT_DRY_RUN=1 for dev or wire a real provider.",
  };
}

// ---------------------------------------------------------------------------
// Week picker — used by admin UI to show what's next
// ---------------------------------------------------------------------------

export function weekOfProgram(startedAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - startedAt.getTime();
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(weeks, 26));
}

// ---------------------------------------------------------------------------
// Safety guards
// ---------------------------------------------------------------------------

/** Don't send to users without an active subscription. Called at send-time. */
export function shouldSendForSubscription(
  subscriptionStatus: string | null,
): boolean {
  return subscriptionStatus === "active";
}
