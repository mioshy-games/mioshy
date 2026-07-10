import "server-only";
import {
  renderResultsReadyEmail,
  type ResultsReadyScoreRow,
  type JourneyEmailPricing,
} from "@/lib/journey/mailing/results-ready-email";
import { renderFounderStoryEmail } from "@/lib/journey/mailing/founder-story-email";
import { renderCoachingExplainerEmail } from "@/lib/journey/mailing/coaching-explainer-email";
import { renderSocialProofEmail } from "@/lib/journey/mailing/social-proof-email";
import {
  renderExpertCallEmail,
  EXPERT_CALL_SCHEDULING_URL,
} from "@/lib/journey/mailing/expert-call-email";

/**
 * Post-assessment marketing sequence — the four window/nurture emails
 * (docs/mailing-schedule-2026-07-03.md §1, §2, §3ב, §21). Copy is the approved
 * final wording, verbatim. The day-5 trial reminder (§ת-1) lives in the
 * trial-reminder cron (it has the subscription data there).
 *
 * Every string obeys the voice rules (no em-dash / "!" / emoji / superlatives;
 * "אתם/שלכם"; no technical hyphen structures). Any change to copy goes back to
 * Itzik.
 */

export type SequenceEmailKind =
  | "results_ready"
  | "founder_story" // email #2 — replaces the old evening_proof slot (2026-07-09)
  | "coaching_explainer" // email #3 — replaces the old deadline slot (2026-07-09)
  | "social_proof" // email #4 — replaces the old day7_value_tip slot (2026-07-10)
  | "expert_call"; // email #5 (2026-07-10)

export interface SeqPersonalization {
  /** First name, or null → a name-less greeting ("היי,"). */
  firstName: string | null;
  /** Focus/weakest domain in Hebrew (e.g. "תקשורת"), or null. */
  focusDomainHe: string | null;
  /** Five-domain score lines, pre-formatted (e.g. "תקשורת: 50 מתוך 100"). */
  scoreLines: string[];
  /** results_ready ONLY — filler gender for the gender-adapted copy. */
  gender?: "male" | "female" | "other" | null;
  /** results_ready ONLY — the five domain scores for the styled table, in
   *  canonical order with the #1-ranked domain flagged. The other four emails
   *  ignore this. */
  scores?: ResultsReadyScoreRow[];
  /** Live couple pricing for the results_ready offer bullets (dynamic, = the
   *  Cardcom charge). The other four kinds ignore it, but it's required so a
   *  results_ready build can never fall back to stale hardcoded prices. */
  pricing: JourneyEmailPricing;
  /** Offer-window expiry, split for the copy. */
  windowDayHe: string | null; // "יום שני"
  windowTime: string | null; // "21:00"
  /** Day-7 exercise text (from the content library). Null → generic fallback. */
  exercise: string | null;
  /** Absolute site origin, e.g. "https://mioshy.com". */
  baseUrl: string;
  /** Marketing unsubscribe URL. */
  unsubscribeUrl?: string;
}

export function buildSequenceEmail(
  kind: SequenceEmailKind,
  p: SeqPersonalization,
): { subject: string; html: string; text: string; senderName?: string } {
  if (kind === "results_ready") {
    // Dedicated renderer (docs/results-ready-email-spec.md): plain personal
    // letter, styled score table, three "לחצו כאן" links, gender-adapted copy,
    // From "יצחק ברלב". Distinct from the shared renderMioshyEmail used below.
    return renderResultsReadyEmail({
      firstName: p.firstName,
      gender: p.gender ?? null,
      focusDomainHe: p.focusDomainHe,
      scores: p.scores ?? [],
      pricing: p.pricing,
      windowDayHe: p.windowDayHe,
      windowTime: p.windowTime,
      baseUrl: p.baseUrl,
      unsubscribeUrl: p.unsubscribeUrl,
    });
  }

  if (kind === "founder_story") {
    // Dedicated plain-letter renderer (like results_ready). Verbatim founder
    // story, From "מיאושי". Ignores scores/pricing/window — a personal letter.
    return renderFounderStoryEmail({
      firstName: p.firstName,
      baseUrl: p.baseUrl,
      unsubscribeUrl: p.unsubscribeUrl,
    });
  }

  if (kind === "coaching_explainer") {
    // Dedicated plain-letter renderer (like results_ready / founder_story).
    // Verbatim coaching explainer, From "מיאושי". A personal letter — ignores
    // scores/pricing/window.
    return renderCoachingExplainerEmail({
      firstName: p.firstName,
      baseUrl: p.baseUrl,
      unsubscribeUrl: p.unsubscribeUrl,
    });
  }

  if (kind === "social_proof") {
    // Dedicated plain-letter renderer. Verbatim social-proof copy, From "מיאושי".
    return renderSocialProofEmail({
      firstName: p.firstName,
      baseUrl: p.baseUrl,
      unsubscribeUrl: p.unsubscribeUrl,
    });
  }

  // expert_call — CTA points at the real Calendly booking link.
  return renderExpertCallEmail({
    firstName: p.firstName,
    baseUrl: p.baseUrl,
    schedulingUrl: EXPERT_CALL_SCHEDULING_URL,
    unsubscribeUrl: p.unsubscribeUrl,
  });
}

/**
 * §ת-1 · day-5 trial reminder (transactional — sent regardless of marketing
 * consent, it's a legal/anti-chargeback notice). Approved final copy (2026-07-08).
 *
 * Rendered with its own plain layout (same simple aesthetic as results_ready)
 * rather than the shared renderMioshyEmail, because the approved copy needs a
 * bulleted "מה קורה עכשיו?" block, a "צוות מיאושי" sign-off (not the shared
 * "יצחק ממיאושי"), and the manage/cancel link placed AFTER the sign-off — none
 * of which renderMioshyEmail supports. renderMioshyEmail and the other emails
 * are untouched.
 *
 * `chargeAmountHe` and `firstName` are retained on the signature for caller
 * (trial-reminder cron) compatibility but are intentionally unused: the approved
 * copy omits the amount and opens with a name-less "היי," per spec.
 */
export function buildTrialDay5Email(p: {
  firstName: string | null;
  trialEndDateHe: string; // "10 ביולי 2026"
  chargeAmountHe: string; // "37 ₪" — retained for caller compat; unused in copy
  baseUrl: string;
}): { subject: string; html: string; text: string; senderName: string } {
  const INK = "#000000";
  const LINK = "#1155cc";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const date = p.trialEndDateHe;

  // Encoded (label-as-link) CTAs. Return-to-plan → /my; manage/cancel → /account
  // (where cancellation actually lives; the spec's "/my" note would not reach the
  // cancel action — flagged for Itzik).
  const returnUrl = `${p.baseUrl}/he/my`;
  const manageUrl = `${p.baseUrl}/he/account`;

  const subject = "תזכורת ממיאושי - משהו קטן לגבי ההמשך שלנו יחד (ושלכם...) 🤍";

  const BRAND = "#B83C4D";
  const paras = [
    `רצינו להזכיר שתקופת הניסיון שלכם במיאושי תסתיים בעוד יומיים (בתאריך ${date}).`,
    "נכנסתם לתהליך הזה כי האמנתם שמגיע לזוגיות שלכם יותר. בשביל להחזיר את הניצוץ ולבנות זוגיות חזקה יותר, לא צריך מהפכות. כל מה שצריך זה להקדיש לעצמכם כמה דקות בודדות בשבוע.",
  ];
  // "בעלות של פחות ממחיר של קפה ומאפה זוגי, …" — the price phrase is brand-
  // coloured (#B83C4D) in HTML; the plain-text fallback keeps it unstyled.
  const cafeLead = "בעלות של ";
  const cafePhrase = "פחות ממחיר של קפה ומאפה זוגי";
  const cafeRest = ", התוכנית האישית שלכם והמומחה שלכם בצ'אט ממשיכים ללוות אתכם צעד אחר צעד.";
  const cafeText = `${cafeLead}${cafePhrase}${cafeRest}`;
  const bullets = [
    `אם אתם בוחרים להישאר ולהשקיע בזוגיות שלכם: אין צורך לעשות דבר. החיוב החודשי יתבצע אוטומטית בתאריך ${date}.`,
    "אם זה פחות מתאים כרגע: הכל בסדר, אפשר לבטל בקליק אחד פשוט מהאזור האישי, בלי שאלות ובלי אותיות קטנות.",
  ];
  const closer = "התוכנית שלכם מחכה לכם, וההשקעה הכי טובה שלכם היא אחד בשנייה.";

  const P = (s: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const linkLine = (label: string, url: string) =>
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:${INK}"><a href="${url}" style="color:${LINK};text-decoration:underline">${esc(label)}</a></p>`;

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(`הניסיון שלכם במיאושי מסתיים בעוד יומיים (בתאריך ${date})`)}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P("היי,")}
            ${paras.map(P).join("")}
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${esc(cafeLead)}<span style="color:${BRAND}">${esc(cafePhrase)}</span>${esc(cafeRest)}</p>
            <p style="margin:22px 0 8px;font-size:16px;font-weight:bold;line-height:1.5;color:${INK}">מה קורה עכשיו?</p>
            <ul style="margin:0 0 16px;padding:0 20px 0 0;list-style:disc">${bullets
              .map(
                (b) =>
                  `<li style="margin:0 0 8px;font-size:16px;line-height:1.6;color:${INK}">${esc(b)}</li>`,
              )
              .join("")}</ul>
            ${P(closer)}
            ${linkLine("לחזרה לתוכנית שלכם במיאושי", returnUrl)}
            <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${INK}">שלכם,</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">צוות מיאושי</p>
            ${linkLine("לניהול / ביטול המנוי", manageUrl)}
            <img src="https://mioshy.com/images/mioshy-email-logo.png" width="97" height="46" alt="מיאושי" style="display:block;border:0;outline:none;margin:8px 0 0;width:97px;height:46px">
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

  const text = [
    "היי,",
    "",
    ...paras,
    cafeText,
    "",
    "מה קורה עכשיו?",
    ...bullets.map((b) => `• ${b}`),
    "",
    closer,
    "",
    `לחזרה לתוכנית שלכם במיאושי: ${returnUrl}`,
    "",
    "שלכם,",
    "צוות מיאושי",
    "",
    `לניהול / ביטול המנוי: ${manageUrl}`,
  ].join("\n");

  // From override: trial_day5 sends as "מיאושי" (Itzik 2026-07-08). Body still
  // signs "צוות מיאושי".
  return { subject, html, text, senderName: "מיאושי" };
}
