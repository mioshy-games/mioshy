import "server-only";

/**
 * expert_call — the FIFTH (final) post-assessment marketing email (Track A).
 * Verbatim approved copy (Itzik 2026-07-09): a low-pressure invite to a short
 * call with a Mioshy relationship expert.
 *
 * Same plain-letter aesthetic (white, 18px). From = "מיאושי"; signs off
 * "מיאושי / mioshy.com".
 *
 * The CTA ("לתיאום שיחה בזמן שנוח לכם") links to the real booking system
 * (Calendly, EXPERT_CALL_SCHEDULING_URL below). Callers may override via
 * `schedulingUrl`; when omitted the Calendly link is used (the earlier
 * site-home placeholder is gone now that booking exists).
 *
 * Timing/gates live in the caller: fires day 14 (10:00 IL, Shabbat→Sunday),
 * gated on marketing consent + no active journey subscription. Renders only.
 *
 * INERT: not in ACTIVE_SEQUENCE_KINDS — only admin previews / send-test render
 * it until it is added to ACTIVE_SEQUENCE_EMAIL_KEYS.
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";

export const EXPERT_CALL_SENDER_NAME = "מיאושי";

/**
 * Real scheduling/booking link for the expert_call CTA (Itzik 2026-07-10).
 * Central config point — the caller and the renderer default both use this.
 */
export const EXPERT_CALL_SCHEDULING_URL = "https://calendly.com/mioshy-support/30min";

export interface ExpertCallPersonalization {
  firstName: string | null;
  baseUrl: string;
  /** Override for the booking link. Omit → EXPERT_CALL_SCHEDULING_URL (Calendly). */
  schedulingUrl?: string;
  unsubscribeUrl?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderExpertCallEmail(p: ExpertCallPersonalization): {
  subject: string;
  html: string;
  text: string;
  senderName: string;
} {
  const name = (p.firstName ?? "").trim();
  const greeting = name ? `היי ${name},` : "היי,";
  // Real Calendly booking link (caller may override via schedulingUrl).
  const schedulingUrl = p.schedulingUrl ?? EXPERT_CALL_SCHEDULING_URL;

  const subject = "מגיע לכם שיחה קצרה עם מומחה לייעוץ זוגי";

  const intro = [
    "לפעמים כל מה שצריך כדי לזוז זו שיחה אחת עם מישהו שמבין.",
    "אנחנו מזמינים אתכם לשיחה קצרה עם מומחה זוגיות ממיאושי. בלי לחץ ובלי מכירה. נעבור יחד על האבחון ועל מה שחשוב לכם בזוגיות, ונבין איפה אתם עומדים ולאן הייתם רוצים להגיע.",
    "אולי אתם חושבים לעצמכם:",
  ];
  const doubts = [
    "זה לא יעזור לנו?",
    "כבר ניסינו הכל ולא עזר?",
    "היינו אצל יועצת זוגית וזה לא עזר?",
  ];
  const closing = "אנחנו פה בשבילכם, ובשיחה קצרה נענה על כל השאלות.";
  const ctaLink = "לתיאום שיחה בזמן שנוח לכם";

  const P = (s: string) =>
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const bullets = (items: string[]) =>
    `<ul style="margin:0 0 16px;padding:0 20px 0 0;list-style:disc">${items
      .map(
        (b) =>
          `<li style="margin:0 0 8px;font-size:18px;line-height:1.6;color:${INK}">${esc(b)}</li>`,
      )
      .join("")}</ul>`;
  const signLine = (s: string) =>
    `<p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const unsub = p.unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: <a href="${p.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a></p>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc("שיחה קצרה אחת עם מומחה זוגיות - בלי לחץ ובלי מכירה")}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P(greeting)}
            ${intro.map(P).join("\n            ")}
            ${bullets(doubts)}
            ${P(closing)}
            <p style="margin:0 0 12px;font-size:18px;line-height:1.7;color:${INK}"><a href="${schedulingUrl}" style="color:${LINK};text-decoration:underline">${esc(ctaLink)}</a></p>
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
    ...intro,
    ...doubts.map((b) => `• ${b}`),
    "",
    closing,
    "",
    `${ctaLink}: ${schedulingUrl}`,
    "",
    "שלכם,",
    "מיאושי",
    p.baseUrl,
  ];
  if (p.unsubscribeUrl) {
    textParts.push("", `לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: ${p.unsubscribeUrl}`);
  }

  return { subject, html, text: textParts.join("\n"), senderName: EXPERT_CALL_SENDER_NAME };
}
