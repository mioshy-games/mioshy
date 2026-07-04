import "server-only";
import { renderMioshyEmail } from "@/lib/email/mioshy-template";

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
  | "evening_proof"
  | "deadline"
  | "day7_value_tip";

export interface SeqPersonalization {
  /** First name, or null → a name-less greeting ("היי,"). */
  firstName: string | null;
  /** Focus/weakest domain in Hebrew (e.g. "תקשורת"), or null. */
  focusDomainHe: string | null;
  /** Five-domain score lines, pre-formatted (e.g. "תקשורת: 50 מתוך 100"). */
  scoreLines: string[];
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

// Intro prices for §1 (matches the live personal-window promo; wire to live
// pricing when the sequence resolves per-user amounts).
const PROMO_NO_COACHING = 37;
const REG_NO_COACHING = 67;
const PROMO_COACHING = 89;
const REG_COACHING = 189;

function greeting(firstName: string | null): string {
  return firstName && firstName.trim() ? `היי ${firstName.trim()},` : "היי,";
}

function windowClause(p: SeqPersonalization): string {
  if (p.windowDayHe && p.windowTime) return `${p.windowDayHe} בשעה ${p.windowTime}`;
  if (p.windowTime) return `היום בשעה ${p.windowTime}`;
  return "בקרוב";
}

export function buildSequenceEmail(
  kind: SequenceEmailKind,
  p: SeqPersonalization,
): { subject: string; html: string; text: string } {
  const g = greeting(p.firstName);
  const join = { label: "להצטרפות עם 7 ימים חינם", url: `${p.baseUrl}/he/journey/assessment` };
  const viewAnalysis = { label: "לצפייה בניתוח המלא", url: `${p.baseUrl}/he/journey/assessment?summary=1` };
  const focus = p.focusDomainHe ?? "התחום המרכזי שלכם";
  const win = windowClause(p);

  if (kind === "results_ready") {
    // One letter: analysis summary + the five domain scores + the join offer.
    // Primary CTA = join (the money action); secondary = view the full analysis.
    const { html, text } = renderMioshyEmail({
      preheader: "הניתוח הזוגי שלכם מוכן",
      greeting: g,
      paragraphs: [
        `הניתוח שלכם מוכן. באבחון עלה ש${focus} הוא המקום עם הפוטנציאל הגדול ביותר לשינוי אצלכם.`,
        "במיאושי מחכים לכם מומחי זוגיות זמינים בצ'אט אישי, ותוכנית זוגית עם פרק חדש כל שבוע, שהופכת את הזוגיות שלכם לאינטימית ואוהבת יותר.",
        "מתחילים עם 7 ימי ניסיון בלי חיוב. נדרש כרטיס אשראי, והחיוב הראשון רק אחרי 7 הימים.",
        `מחיר ההיכרות לחודש הראשון שמור לכם: ${PROMO_NO_COACHING} ₪ במקום ${REG_NO_COACHING} ₪ בלי ליווי, או ${PROMO_COACHING} ₪ במקום ${REG_COACHING} ₪ עם מומחה צמוד. ההטבה בתוקף עד ${win}.`,
      ],
      scoreLines: p.scoreLines.length ? p.scoreLines : undefined,
      primaryCta: join,
      secondaryCta: viewAnalysis,
      unsubscribeUrl: p.unsubscribeUrl,
    });
    return { subject: "הניתוח הזוגי שלכם מוכן", html, text };
  }

  if (kind === "evening_proof") {
    const { html, text } = renderMioshyEmail({
      preheader: "איך תדעו שזה באמת עובד?",
      greeting: g,
      paragraphs: [
        "דבר אחד מבדיל ליווי אמיתי מעוד עצות טובות: מדידה. במיאושי נערך מעקב כל 8 שבועות יחד עם המומחה שלכם: רואים כמה התקדמתם בכל תחום, ומדייקים את הצעדים הבאים.",
        `כך התשוקה והאינטימיות לא נשארות משאלה, הן נבנות שבוע אחרי שבוע, עם ליווי צמוד. מתחילים עם 7 ימי ניסיון בלי חיוב, ומחיר ההיכרות עדיין שמור לכם, עד ${win}.`,
      ],
      primaryCta: join,
      unsubscribeUrl: p.unsubscribeUrl,
    });
    return { subject: "איך תדעו שזה באמת עובד?", html, text };
  }

  if (kind === "deadline") {
    const { html, text } = renderMioshyEmail({
      preheader: `ההצעה שלכם בתוקף עד ${win}`,
      greeting: g,
      paragraphs: [
        `תזכורת אחרונה וקצרה: מחיר ההיכרות ששמרנו לכם לחודש הראשון עדיין בתוקף, עד ${win}. אחרי זה המחיר חוזר לרגיל.`,
      ],
      primaryCta: { label: "ממשיכים למיאושי", url: `${p.baseUrl}/he/journey/assessment` },
      unsubscribeUrl: p.unsubscribeUrl,
    });
    return { subject: `ההצעה שלכם בתוקף עד ${win}`, html, text };
  }

  // day7_value_tip
  const exercise = p.exercise ?? "בחרו רגע אחד מהיום ותשתפו זה את זה במה שהוא עורר בכם, בלי לתקן ובלי לפתור, רק להקשיב.";
  const { html, text } = renderMioshyEmail({
    preheader: "הטיפ הראשון שלכם, לפי האבחון",
    greeting: g,
    paragraphs: [
      `באבחון שלכם ${focus} קיבל את הציון הנמוך ביותר, וזה דווקא טוב לדעת: זה המקום שבו צעד קטן מרגיש הכי מהר.`,
      `הנה תרגיל אחד להערב: ${exercise} עשר דקות, בלי הכנות.`,
    ],
    primaryCta: { label: "לתרגיל המלא", url: `${p.baseUrl}/he/journey/assessment?summary=1` },
    unsubscribeUrl: p.unsubscribeUrl,
  });
  return { subject: "הטיפ הראשון שלכם, לפי האבחון", html, text };
}

/**
 * §ת-1 · day-5 trial reminder (transactional — sent regardless of marketing
 * consent, it's a legal/anti-chargeback notice). Approved final copy.
 */
export function buildTrialDay5Email(p: {
  firstName: string | null;
  trialEndDateHe: string; // "10 ביולי 2026"
  chargeAmountHe: string; // "37 ₪"
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const g = greeting(p.firstName);
  const { html, text } = renderMioshyEmail({
    preheader: "הניסיון שלכם במיאושי מסתיים בעוד יומיים",
    greeting: g,
    paragraphs: [
      `רצינו להזכיר: 7 ימי הניסיון שלכם מסתיימים ב-${p.trialEndDateHe}.`,
      `אם תבחרו להישאר, לא צריך לעשות כלום. החיוב הראשון, ${p.chargeAmountHe}, יתבצע ב-${p.trialEndDateHe}. ואם זה לא הזמן שלכם, אפשר לבטל בקליק אחד מהאזור האישי, בלי שאלות.`,
      "בינתיים מחכה לכם המומחה שלכם בצ'אט, וכל התוכנית האישית שלכם.",
    ],
    primaryCta: { label: "להמשיך למיאושי", url: `${p.baseUrl}/he/my` },
    secondaryCta: { label: "לניהול המנוי או ביטול", url: `${p.baseUrl}/he/account` },
    // Transactional — no unsubscribe link.
  });
  return { subject: "הניסיון שלכם במיאושי מסתיים בעוד יומיים", html, text };
}
