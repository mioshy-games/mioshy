import "server-only";

/**
 * coaching_explainer — the THIRD post-assessment marketing email (Track A),
 * which REPLACES the old deadline slot (Itzik, 2026-07-09). Verbatim approved
 * copy: what "ייעוץ זוגי עם מיאושי" actually is — the five core domains, the
 * personal tasks, the expert-in-chat + 8-week re-check — ending on the 7-day
 * free-trial CTA.
 *
 * Same plain-letter aesthetic as results_ready / founder_story (white, 18px, no
 * buttons — the CTA is an inline "לחצו כאן" text link). From = "מיאושי"; body
 * signs off "מיאושי / mioshy.com".
 *
 * Timing/gates live in the caller (marketing-sequence cron): fires 3 days after
 * founder_story (email #2), gated on marketing consent + no active journey
 * subscription (NOT window-gated — the trial CTA is always valid). This file
 * only renders. Any copy change goes back to Itzik.
 *
 * INERT: not in ACTIVE_SEQUENCE_KINDS, so the live cron never sends it yet —
 * only scoped admin previews (send-test / onlyUserId) render it.
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";

/** Display name used on the From line for this email specifically. */
export const COACHING_EXPLAINER_SENDER_NAME = "מיאושי";

export interface CoachingExplainerPersonalization {
  /** First name, or null → a name-less greeting ("היי,"). */
  firstName: string | null;
  /** Absolute site origin, e.g. "https://mioshy.com". */
  baseUrl: string;
  /** Marketing unsubscribe URL. */
  unsubscribeUrl?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderCoachingExplainerEmail(p: CoachingExplainerPersonalization): {
  subject: string;
  html: string;
  text: string;
  senderName: string;
} {
  const name = (p.firstName ?? "").trim();
  const greeting = name ? `היי ${name},` : "היי,";

  // Trial CTA → the dedicated post-login subscribe page (same target as the
  // other sequence emails). Not logged in → it redirects to login and back.
  const checkoutUrl = `${p.baseUrl}/he/journey/subscribe?utm_source=email&utm_medium=coaching_explainer&utm_campaign=trial`;

  const subject = "מומחה לייעוץ זוגי צמוד ומעקב אמיתי אחרי הזוגיות שלכם";

  // ── Body copy (approved wording, verbatim) ─────────────────────────────────
  const intro = [
    "אולי אתם שואלים את עצמכם איך נראה הליווי שלנו בפועל. אז בואו נספר לכם.",
    '"ייעוץ זוגי עם מיאושי" הוא לא עוד סדרת עצות, זה ליווי אישי לאורך מסלול מובנה שנבנה בשיטה של יצחק ברלב, מייסד מיאושי.',
    "המסלול נוגע בחמישה תחומי ליבה בזוגיות:",
  ];
  // Five core domains — emoji-led lines, label in bold, in the approved order.
  const domainBullets = [
    { emoji: "🔥", label: "אינטימיות", text: "להחזיר את התשוקה והמגע." },
    { emoji: "❤️", label: "חיבור רגשי", text: "להרגיש שוב קרובים." },
    { emoji: "💬", label: "תקשורת", text: "לדעת איך לנהל שיחה גם ברגעים קשים." },
    { emoji: "🤝", label: "חברות", text: "לגלות את החבר הכי טוב שלכם בבן/בת הזוג." },
    { emoji: "👨‍👩‍👧", label: "משפחה", text: "לחזק את התא המשפחתי שלכם ואת המקום שלכם בתוכו." },
  ];
  const body = [
    "בכל תחום מחכות לכם משימות אישיות ובקשות שאתם משתפים. אתם חוזרים אל המומחה עם החוויות וההתלבטויות שעולות מהתוכן שנפתח בפניכם, והוא שם בשבילכם.",
    "והכי חשוב, המומחה לומד אתכם ומדייק את התוכן שתקבלו שיהיה מכוון בדיוק עבורכם. אחת לשמונה שבועות עושים בדיקה מחודשת, כדי לראות כמה הזוגיות שלכם השתפרה ואיפה חשוב לכם לשים את הדגש.",
    "יש לכם 7 ימי התנסות חינם.",
  ];
  const ctaLead = "רוצים לפתוח דף חדש בזוגיות שלכם? ";
  const ctaLink = "לחצו כאן";

  // ── HTML helpers (mirror results_ready / founder_story: 18px plain letter) ──
  const P = (s: string) =>
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  // Emoji IS the bullet marker → list-style:none so there's no double marker.
  // Category label is bold; the description follows in normal weight.
  const emojiList = (items: { emoji: string; label: string; text: string }[]) =>
    `<ul style="margin:0 0 16px;padding:0;list-style:none">${items
      .map(
        (b) =>
          `<li style="margin:0 0 8px;font-size:18px;line-height:1.6;color:${INK}">${esc(b.emoji)} <b>${esc(b.label)}:</b> ${esc(b.text)}</li>`,
      )
      .join("")}</ul>`;
  const signLine = (s: string) =>
    `<p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;

  const unsub = p.unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: <a href="${p.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a></p>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc("ליווי אישי לאורך מסלול מובנה, עם מומחה צמוד ומעקב כל שמונה שבועות")}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P(greeting)}
            ${intro.map(P).join("\n            ")}
            ${emojiList(domainBullets)}
            ${body.map(P).join("\n            ")}
            <p style="margin:0 0 12px;font-size:18px;line-height:1.7;color:${INK}">${esc(ctaLead)}<a href="${checkoutUrl}" style="color:${LINK};text-decoration:underline">${esc(ctaLink)}</a></p>
            <p style="margin:24px 0 0;font-size:18px;line-height:1.6;color:${INK}">שלכם,</p>
            ${signLine("מיאושי")}
            <p style="margin:0;font-size:18px;line-height:1.6;color:${INK}"><a href="${p.baseUrl}" style="color:${LINK};text-decoration:underline">mioshy.com</a></p>
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
    ...intro,
    ...domainBullets.map((b) => `${b.emoji} ${b.label}: ${b.text}`),
    "",
    ...body,
    "",
    `${ctaLead}${checkoutUrl}`,
    "",
    "שלכם,",
    "מיאושי",
    p.baseUrl,
  ];
  if (p.unsubscribeUrl) {
    textParts.push("", `לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: ${p.unsubscribeUrl}`);
  }

  return { subject, html, text: textParts.join("\n"), senderName: COACHING_EXPLAINER_SENDER_NAME };
}
