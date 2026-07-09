import "server-only";

/**
 * results_ready — the FIRST post-assessment marketing email (Track A).
 * Dedicated renderer, separate from the shared renderMioshyEmail() used by the
 * other four sequence emails, because this one has a distinct spec
 * (docs/results-ready-email-spec.md, approved 2026-07-06):
 *
 *   • Plain personal letter: white background, no gradient header, NO buttons.
 *     The ONLY styled element is the five-domain score table.
 *   • Links are the text "לחצו כאן" (never a raw URL), inline in their line.
 *   • Three links: (1) a mailto that opens the filler's mail client with a
 *     ready, partner-gender-adapted body inviting the partner to take the
 *     assessment; (2) the 7-day-trial checkout; (3) the full analysis page.
 *   • Gender-adapted throughout (filler + partner, hetero assumption).
 *   • Signs off "יצחק ברלב / מיאושי בשבילך!"; From = "יצחק ברלב".
 *
 * The COPY is the approved wording, verbatim; dynamic slots (name, priority
 * domain + "(נבחרה להתחלה)" tag, five scores, gender forms, offer window,
 * three links) are filled here. Any copy change goes back to Itzik.
 *
 * Gate-1 (marketing consent) and Gate-2 (no active subscription) live in the
 * caller (the marketing-sequence cron); this file only renders.
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";
const BORDER = "#dddddd";
const HEADER_BG = "#f5f2ec";
const TAG = "#7A1F2B";

/** Display name used on the From line for this email specifically. */
export const RESULTS_READY_SENDER_NAME = "מיאושי";

export interface ResultsReadyScoreRow {
  labelHe: string;
  /** 0..100. */
  score: number;
  /** True for the domain the user ranked #1 (gets the "(נבחרה להתחלה)" tag). */
  isPriority: boolean;
}

/**
 * Live couple pricing for the offer bullets — resolved from the same source as
 * the checkout (never hardcoded), so the email shows exactly what Cardcom bills.
 * `*First` is the promo first-charge (null when no active promo for that option).
 */
export interface JourneyEmailPricing {
  noCoachingRegular: number;
  noCoachingFirst: number | null;
  withCoachingRegular: number;
  withCoachingFirst: number | null;
}

export interface ResultsReadyPersonalization {
  /** First name, or null → a name-less greeting. */
  firstName: string | null;
  /** Live couple pricing (dynamic — replaces the old hardcoded 37/67/89/189). */
  pricing: JourneyEmailPricing;
  /** Filler's gender. null/"other" → default to the male (unmarked) forms. */
  gender: "male" | "female" | "other" | null;
  /** The #1-ranked priority domain in Hebrew (e.g. "תקשורת"), or null. */
  focusDomainHe: string | null;
  /** The five domain scores, canonical order, priority row flagged. */
  scores: ResultsReadyScoreRow[];
  /** Offer-window expiry, split for the copy. */
  windowDayHe: string | null; // "יום שני"
  windowTime: string | null; // "21:00"
  /** Absolute site origin, e.g. "https://mioshy.com". */
  baseUrl: string;
  /** Marketing unsubscribe URL. */
  unsubscribeUrl?: string;
}


function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Gender forms. Hetero assumption: the partner is the opposite gender of the
 * filler. Unknown/"other" filler → the male (grammatically unmarked) forms;
 * safe because the live audience is consent-gated (blocked today) and the test
 * flow sets gender explicitly.
 */
function genderForms(gender: ResultsReadyPersonalization["gender"]) {
  const fillerFemale = gender === "female";
  const partnerFemale = !fillerFemale; // opposite of the filler
  return {
    // Filler-adapted:
    curious: fillerFemale ? "סקרנית" : "סקרן", // subject parenthetical
    wantWord: fillerFemale ? "תרצי" : "תרצה", // "ואם תרצה/תרצי תמונה מדויקת יותר"
    sendVerb: fillerFemale ? "שלחי" : "שלח", // imperative to the filler
    // Partner-adapted (opposite gender):
    partnerNoun: partnerFemale ? "בת הזוג" : "בן הזוג", // "של בת הזוג"
    partnerTo: partnerFemale ? "לבת" : "לבן", // "לבת הזוג"
    partnerFinish: partnerFemale ? "היא תסיים" : "הוא יסיים",
    comeVerb: partnerFemale ? "בואי" : "בוא", // mailto (partner reads it)
    youWord: partnerFemale ? "את" : "אתה", // mailto
  };
}

function windowClause(p: ResultsReadyPersonalization): string {
  if (p.windowDayHe && p.windowTime) return `${p.windowDayHe} בשעה ${p.windowTime}`;
  if (p.windowTime) return `היום בשעה ${p.windowTime}`;
  return "בקרוב";
}

/** The three links, as absolute/mailto URLs (tracked where it's a page). */
function links(p: ResultsReadyPersonalization, g: ReturnType<typeof genderForms>) {
  const base = p.baseUrl;
  const assessmentUrl = `${base}/he/journey/assessment?utm_source=email&utm_medium=results_ready&utm_campaign=partner_invite`;
  // Trial CTA → the dedicated post-login subscribe page (plan selection + trial
  // checkout). Not logged in → it redirects to login and back.
  const checkoutUrl = `${base}/he/journey/subscribe?utm_source=email&utm_medium=results_ready&utm_campaign=trial`;
  const resultsUrl = `${base}/he/journey/assessment?summary=1&utm_source=email&utm_medium=results_ready&utm_campaign=view_analysis`;

  // mailto that opens a NEW email in the filler's client, pre-filled with a
  // partner-gender-adapted body that ends with the assessment link.
  const mailSubject = `אבחון זוגי קצר, ${g.comeVerb} נשווה`;
  const mailBody = `היי, עשיתי אבחון זוגי קצר במיאושי וזה יצא מעניין. ${g.comeVerb} נעשה אותו גם ${g.youWord} ונשווה תוצאות: ${assessmentUrl}`;
  const mailto = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

  return { mailto, checkoutUrl, resultsUrl };
}

export function renderResultsReadyEmail(p: ResultsReadyPersonalization): {
  subject: string;
  html: string;
  text: string;
  senderName: string;
} {
  const g = genderForms(p.gender);
  const name = (p.firstName ?? "").trim();
  // Name lives in the subject only; the opening greeting is name-less.
  const greeting = "היי,";
  const focus = p.focusDomainHe ?? "התחום שהכי חשוב לך";
  const win = windowClause(p);
  const { mailto, checkoutUrl, resultsUrl } = links(p, g);

  const subject = `${name ? `${name}, ` : ""}הניתוח שלך מוכן! (${g.curious} לדעת מה הציון של ${g.partnerNoun}? 👀)`;

  // ── Body copy (approved wording, dynamic slots filled) ─────────────────────
  // Opening. Only the category NAME is bold (<b>) in HTML; the plain-text
  // fallback keeps it unstyled. Split so we can wrap just the category.
  const introLead = `תוצאות האבחון הקצר שלך מוכנות! דירגת את "`;
  const introTail = `" כתחום שהכי חשוב לך, וממנו נתחיל. ואם ${g.wantWord} תמונה מדויקת יותר, האבחון המלא נפתח מיד עם ההצטרפות.`;
  const introHtml = `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK}">${esc(introLead)}<b>${esc(focus)}</b>${esc(introTail)}</p>`;
  const introText = `${introLead}${focus}${introTail}`;

  const partnerHead = `👥 רגע, ומה הציון של ${g.partnerNoun}?`;
  const partnerBody = `האבחון שלך הוא רק חצי מהתמונה. כדי שתוכלו לראות איפה אתם לגמרי מסונכרנים ואיפה יש פערים, ${g.sendVerb} את האבחון גם ${g.partnerTo} הזוג. ברגע ש${g.partnerFinish}, תוכלו להשוות בין הדירוגים שלכם ולראות:`;
  const partnerBullets = [
    "האם שניכם מרגישים אותו דבר לגבי התקשורת שלכם?",
    "איפה הציונים שלכם דומים ואיפה הם שונים?",
    "מהן נקודות החוזק האמיתיות שלכם כזוג?",
  ];

  const scoresHead = "📊 הצצה לציונים שלך:";

  const miosheyHead = "🚀 מחכים לכם במיאושי";
  const miosheyIntro =
    "אנחנו פה בשבילכם עם מומחי זוגיות שמלווים אתכם בצ'אט אישי, ותוכנית זוגית עם פרק חדש שמחכה לכם מדי שבוע.";
  const gamesOpen = "וגם כל המשחקים פתוחים להנאתכם, לשניכם וללא תוספת תשלום:";
  const gamesBullets = ["הסקס של מיאושי", "משחקי זוגות אונליין"];
  const gamesNewEachMonth = "כל חודש מתווסף משחק חדש.";
  const miosheyTrial =
    "אתם יכולים להתחיל עם 7 ימי ניסיון ללא חיוב (צריך להזין אשראי, אבל החיוב יתחיל רק אחרי שבוע, ותקבלו תזכורת אחרי 5 ימים, ואפשר לבטל מתי שרוצים).";

  // Dynamic pricing (from p.pricing, resolved live = the Cardcom charge). Promo
  // line when there's an active first-month discount, plain regular otherwise.
  const priceBullet = (label: string, regular: number, first: number | null) =>
    first != null && first < regular
      ? `${label}: רק ${first} ₪ לחודש הראשון לשניכם (במקום ${regular} ₪)`
      : `${label}: ${regular} ₪ לחודש לשניכם`;
  const hasPromo =
    (p.pricing.noCoachingFirst != null && p.pricing.noCoachingFirst < p.pricing.noCoachingRegular) ||
    (p.pricing.withCoachingFirst != null && p.pricing.withCoachingFirst < p.pricing.withCoachingRegular);
  const offerHead = hasPromo
    ? `💰 הטבה לחברים חדשים (בתוקף עד ${win}):`
    : "💰 המסלולים שלנו:";
  const offerBullets = [
    priceBullet("מסלול זוגי ללא ליווי", p.pricing.noCoachingRegular, p.pricing.noCoachingFirst),
    priceBullet("מסלול זוגי עם מומחה צמוד", p.pricing.withCoachingRegular, p.pricing.withCoachingFirst),
  ];
  // Framing for the trial CTA → the subscription-selection view.
  const subscribeFraming =
    "להצטרפות לשירות, בחרו את המנוי הנוח ביותר לכם, מנוי זוגי כלול לשניכם ללא תוספת.";

  // ── HTML helpers ───────────────────────────────────────────────────────────
  const P = (s: string, extra = "") =>
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK};${extra}">${esc(s)}</p>`;
  const HEAD = (s: string) =>
    `<p style="margin:22px 0 8px;font-size:18px;font-weight:bold;line-height:1.5;color:${INK}">${esc(s)}</p>`;
  const bullets = (items: string[]) =>
    `<ul style="margin:0 0 16px;padding:0 20px 0 0;list-style:disc">${items
      .map(
        (b) =>
          `<li style="margin:0 0 6px;font-size:18px;line-height:1.6;color:${INK}">${esc(b)}</li>`,
      )
      .join("")}</ul>`;
  /** A "לחצו כאן"-style line: the anchor text is the link, plain text follows. */
  const linkLine = (linkText: string, url: string, trailing: string) =>
    `<p style="margin:0 0 12px;font-size:18px;line-height:1.7;color:${INK}"><a href="${url}" style="color:${LINK};text-decoration:underline">${esc(
      linkText,
    )}</a>${trailing ? esc(trailing) : ""}</p>`;

  // The one styled element: the score table.
  const tag = ' <span style="color:' + TAG + ';font-weight:bold">(נבחרה להתחלה)</span>';
  // No scores → render nothing here (avoids an empty bordered box). The heading
  // is gated the same way in the HTML/text below.
  const scoreTable = p.scores.length === 0 ? "" : `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:420px;margin:0 0 20px;border:1px solid ${BORDER}">
${p.scores
  .map(
    (row, i) => `  <tr style="background:${i % 2 ? "#ffffff" : HEADER_BG}">
    <td dir="rtl" align="right" style="padding:10px 14px;font-size:17px;color:${INK};border-bottom:1px solid ${BORDER}">${esc(
      row.labelHe,
    )}${row.isPriority ? tag : ""}</td>
    <td dir="ltr" align="left" style="padding:10px 14px;font-size:17px;font-weight:bold;color:${INK};border-bottom:1px solid ${BORDER};white-space:nowrap">${Math.round(
      row.score,
    )} / 100</td>
  </tr>`,
  )
  .join("\n")}
</table>`;

  const unsub = p.unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: <a href="${p.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a></p>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(`${name || "היי"}, הניתוח הזוגי שלך מוכן`)}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P(greeting)}
            ${introHtml}
            ${HEAD(partnerHead)}
            ${P(partnerBody)}
            ${bullets(partnerBullets)}
            ${p.scores.length ? HEAD(scoresHead) : ""}
            ${scoreTable}
            ${HEAD(miosheyHead)}
            ${P(miosheyIntro)}
            ${P(gamesOpen)}
            ${bullets(gamesBullets)}
            ${P(gamesNewEachMonth)}
            ${P(miosheyTrial)}
            ${HEAD(offerHead)}
            ${bullets(offerBullets)}
            ${linkLine("לחצו כאן", mailto, ` כדי לשלוח את האבחון ${g.partnerTo} הזוג ולהשוות תוצאות`)}
            ${P(subscribeFraming)}
            ${linkLine("לחצו כאן", checkoutUrl, " כדי להתחיל את 7 ימי הניסיון שלכם")}
            ${linkLine("לצפייה בניתוח המלא שלך", resultsUrl, "")}
            <p style="margin:24px 0 0;font-size:18px;line-height:1.6;color:${INK}">שלך,</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">יצחק ברלב</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">מיאושי בשבילך!</p>
            <img src="https://mioshy.com/images/mioshy-email-logo.png" width="97" height="46" alt="מיאושי" style="display:block;border:0;outline:none;margin:12px 0 0;width:97px;height:46px">
            ${unsub}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

  // ── Plain-text fallback ────────────────────────────────────────────────────
  const textParts: string[] = [
    greeting,
    "",
    introText,
    "",
    partnerHead,
    partnerBody,
    ...partnerBullets.map((b) => `• ${b}`),
    "",
    ...(p.scores.length
      ? [
          scoresHead,
          ...p.scores.map(
            (r) => `${r.labelHe}${r.isPriority ? " (נבחרה להתחלה)" : ""}: ${Math.round(r.score)} / 100`,
          ),
          "",
        ]
      : []),
    miosheyHead,
    miosheyIntro,
    gamesOpen,
    ...gamesBullets.map((b) => `• ${b}`),
    gamesNewEachMonth,
    miosheyTrial,
    "",
    offerHead,
    ...offerBullets.map((b) => `• ${b}`),
    "",
    `לשליחת האבחון ${g.partnerTo} הזוג ולהשוואת תוצאות: ${mailto}`,
    "",
    subscribeFraming,
    `להתחלת 7 ימי הניסיון: ${checkoutUrl}`,
    `לצפייה בניתוח המלא שלך: ${resultsUrl}`,
    "",
    "שלך,",
    "יצחק ברלב",
    "מיאושי בשבילך!",
  ];
  if (p.unsubscribeUrl) {
    textParts.push("", `לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: ${p.unsubscribeUrl}`);
  }

  return { subject, html, text: textParts.join("\n"), senderName: RESULTS_READY_SENDER_NAME };
}
