import type { SequenceEmailKind } from "@/lib/journey/mailing/sequence-emails";

/**
 * Declarative description of the marketing email FLOWS, for the admin
 * email-sequence dashboard (docs/admin-email-sequence-dashboard-spec.md) and as
 * the single source of truth for which kinds the live cron actually sends.
 *
 * View-only metadata: order, human timing labels, gates, renderer key. The
 * actual date math + send logic still live in the marketing-sequence cron; this
 * file only DESCRIBES the flow (and owns the active set the cron reads, so the
 * dashboard can never drift from what really ships).
 *
 * `import type` above is erased at compile time, so this module stays free of
 * the server-only taint that `sequence-emails` carries — it can be imported
 * from anywhere.
 */

/**
 * The kinds the GLOBAL (cron) run sends. Was an inline const in the
 * marketing-sequence route; moved here so the route and the dashboard share one
 * source. Follow-ups send at 10:00 Asia/Jerusalem (Shabbat → Sunday), and only
 * to completers past MAILING_SEQUENCE_ACTIVATION_TS (no retroactive backlog).
 *
 * LIVE as of 2026-07-10 (Itzik): results_ready + founder_story +
 * coaching_explainer + social_proof. expert_call activated 2026-07-13 (Itzik)
 * after send-test sign-off — its CTA points at the real Calendly booking link
 * (EXPERT_CALL_SCHEDULING_URL).
 */
export const ACTIVE_SEQUENCE_EMAIL_KEYS: ReadonlySet<SequenceEmailKind> = new Set([
  "results_ready",
  "founder_story",
  "coaching_explainer",
  "social_proof",
  "expert_call",
]);

/** Segments/flows. Only the first is built today; the rest are placeholders so
 *  the dashboard's filter has a forward-compatible shape. */
export type FlowSegmentId =
  | "post_assessment_no_journey"
  | "purchased_journey"
  | "churned"
  | "bought_game";

export interface FlowEmailDef {
  /** email_key / SequenceEmailKind. */
  key: SequenceEmailKind;
  /** 1-based position in the flow. */
  order: number;
  /** Human timing, relative to the previous step / flow start. */
  timingLabel: string;
  /** Gates that must pass for this email to send, in Hebrew. */
  gatesHe: string[];
}

export interface EmailFlowDef {
  id: FlowSegmentId;
  nameHe: string;
  /** Who is in this segment. */
  segmentHe: string;
  /** What the flow is for. */
  descriptionHe: string;
  /** The condition that pulls someone OUT of the flow. */
  stopConditionHe: string;
  /** Whether the flow is wired today (false = placeholder for a future flow). */
  built: boolean;
  emails: FlowEmailDef[];
}

const CONSENT = "אישור דיוור";
const NO_JOURNEY = "אין מנוי journey פעיל";
const IN_WINDOW = "בתוך חלון ההצעה";

export const EMAIL_FLOWS: EmailFlowDef[] = [
  {
    id: "post_assessment_no_journey",
    nameHe: 'פוסט-אבחון · "לא רכש journey"',
    segmentHe: "השלימו אבחון קצר, אישרו דיוור, ואין להם מנוי journey פעיל.",
    descriptionHe:
      "רצף הליווי אחרי האבחון הקצר. המטרה: להוביל לרכישת מנוי journey (7 ימי התנסות).",
    stopConditionHe:
      "הפלואו נעצר מיידית ברגע שנרכש מנוי journey פעיל (Gate-2, journey-scoped). רכישת מוצר אחר (משחקים/מבוגרים) אינה עוצרת אותו.",
    built: true,
    emails: [
      {
        key: "results_ready",
        order: 1,
        timingLabel: "30 דקות אחרי השלמת האבחון",
        gatesHe: [CONSENT, NO_JOURNEY, IN_WINDOW],
      },
      {
        key: "founder_story",
        order: 2,
        timingLabel: "יום 1 · 10:00 (למחרת results_ready)",
        gatesHe: [CONSENT, NO_JOURNEY],
      },
      {
        key: "coaching_explainer",
        order: 3,
        timingLabel: "יום 4 · 10:00 (3 ימים אחרי מייל 2)",
        gatesHe: [CONSENT, NO_JOURNEY],
      },
      {
        key: "social_proof",
        order: 4,
        timingLabel: "יום 9 · 10:00 (5 ימים אחרי מייל 3)",
        gatesHe: [CONSENT, NO_JOURNEY],
      },
      {
        key: "expert_call",
        order: 5,
        timingLabel: "יום 14 · 10:00 (5 ימים אחרי מייל 4)",
        gatesHe: [CONSENT, NO_JOURNEY],
      },
    ],
  },
  {
    id: "purchased_journey",
    nameHe: "רכשו מנוי journey",
    segmentHe: "משתמשים עם מנוי journey פעיל.",
    descriptionHe: "פלואו עתידי (אונבורדינג / שימור). עדיין לא נבנה.",
    stopConditionHe: "-",
    built: false,
    emails: [],
  },
  {
    id: "churned",
    nameHe: "עזבו (churn)",
    segmentHe: "ביטלו / פג המנוי.",
    descriptionHe: "פלואו עתידי (win-back). עדיין לא נבנה.",
    stopConditionHe: "-",
    built: false,
    emails: [],
  },
  {
    id: "bought_game",
    nameHe: "רכשו משחק",
    segmentHe: "רכשו מוצר משחקים בלבד.",
    descriptionHe: "פלואו עתידי (upsell ל-journey). עדיין לא נבנה.",
    stopConditionHe: "-",
    built: false,
    emails: [],
  },
];

export function getFlow(id: FlowSegmentId): EmailFlowDef | undefined {
  return EMAIL_FLOWS.find((f) => f.id === id);
}
