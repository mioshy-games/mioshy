import "server-only";

/**
 * social_proof — the FOURTH post-assessment marketing email (Track A). Verbatim
 * approved copy (Itzik 2026-07-09): the measurable-improvement / social-proof
 * angle, ending on the 7-day free-trial CTA.
 *
 * Same plain-letter aesthetic as the other sequence emails (white, 18px, inline
 * "לחצו כאן" text link → /journey/subscribe). From = "מיאושי"; signs off
 * "מיאושי / mioshy.com".
 *
 * Timing/gates live in the caller: fires day 9 (10:00 IL, Shabbat→Sunday), gated
 * on marketing consent + no active journey subscription. This file only renders.
 *
 * INERT: not in ACTIVE_SEQUENCE_KINDS — only admin previews render it.
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";

export const SOCIAL_PROOF_SENDER_NAME = "מיאושי";

export interface SocialProofPersonalization {
  firstName: string | null;
  baseUrl: string;
  unsubscribeUrl?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderSocialProofEmail(p: SocialProofPersonalization): {
  subject: string;
  html: string;
  text: string;
  senderName: string;
} {
  const name = (p.firstName ?? "").trim();
  const greeting = name ? `היי ${name},` : "היי,";
  const checkoutUrl = `${p.baseUrl}/he/journey/subscribe?utm_source=email&utm_medium=social_proof&utm_campaign=trial`;

  const subject = "רוצים לראות עד כמה הזוגיות שלכם יכולה להשתפר?";

  const paras = [
    "ייעוץ זוגי כזה עוד לא היה. המומחים שלנו איתכם לאורך הדרך ודואגים לשפר את הזוגיות שלכם בתחומים הכי חשובים. ובניגוד לייעוץ זוגי שעולה אלפי שקלים בחודש, אצלנו תקבלו ליווי אישי וממוקד בעלות של קפה ועוגה, ומחיר ההיכרות הזה עומד לעלות בקרוב.",
    'רוב השירותים מבטיחים "שיפור". אנחנו יכולים למדוד אותו, כי המומחים שלכם עוקבים אחרי קצב ההתקדמות שלכם ובודקים אותה מחדש כל שמונה שבועות, מאבחון לאבחון.',
    "והנה מה שאנחנו רואים: שיפור ניכר בחמשת התחומים שאנחנו נוגעים בהם: אינטימיות, חיבור רגשי, תקשורת, חברות ומשפחה.",
    "וזה לא רק תחושה. השיפור נמדד אצל זוגות שהשתתפו באופן קבוע, וזה בדיוק היתרון של ליווי עם מומחה צמוד: רואים את ההתקדמות, לא רק מרגישים אותה.",
    "רוצים להתחיל למדוד שיפור אצלכם? יש לכם 7 ימי התנסות חינם.",
  ];
  const ctaLink = "לחצו כאן";
  const ctaTrail = " כדי להתחיל את המסלול";

  const P = (s: string) =>
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const signLine = (s: string) =>
    `<p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const unsub = p.unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: <a href="${p.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a></p>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc("שיפור נמדד, לא רק מורגש - עם ליווי של מומחה צמוד")}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P(greeting)}
            ${paras.map(P).join("\n            ")}
            <p style="margin:0 0 12px;font-size:18px;line-height:1.7;color:${INK}"><a href="${checkoutUrl}" style="color:${LINK};text-decoration:underline">${esc(ctaLink)}</a>${esc(ctaTrail)}</p>
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

  const textParts: string[] = [
    greeting,
    "",
    ...paras,
    "",
    `${ctaLink}${ctaTrail}: ${checkoutUrl}`,
    "",
    "שלכם,",
    "מיאושי",
    p.baseUrl,
  ];
  if (p.unsubscribeUrl) {
    textParts.push("", `לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: ${p.unsubscribeUrl}`);
  }

  return { subject, html, text: textParts.join("\n"), senderName: SOCIAL_PROOF_SENDER_NAME };
}
