import "server-only";

/**
 * founder_story — the SECOND post-assessment marketing email (Track A), which
 * REPLACES the old evening_proof slot (Itzik, 2026-07-09). Verbatim approved
 * copy: Itzik's founder story, ending on the 7-day free-trial CTA.
 *
 * Same plain-letter aesthetic as results_ready (white background, 18px, no
 * buttons — the CTA is an inline "לחצו כאן" text link), so it reads as a
 * personal letter, not a marketing template. From = "מיאושי"; body signs off
 * "יצחק ברלב / מייסד מיאושי ומוביל צוות המומחים".
 *
 * Timing/gates live in the caller (marketing-sequence cron): fires 48h after
 * results_ready, gated on marketing consent + no purchase (NOT window-gated —
 * the trial CTA is always valid). This file only renders. Any copy change goes
 * back to Itzik.
 *
 * INERT: not in ACTIVE_SEQUENCE_KINDS, so the live cron never sends it yet —
 * only scoped admin previews (send-test / onlyUserId) render it.
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";

/** Display name used on the From line for this email specifically. */
export const FOUNDER_STORY_SENDER_NAME = "מיאושי";

export interface FounderStoryPersonalization {
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

export function renderFounderStoryEmail(p: FounderStoryPersonalization): {
  subject: string;
  html: string;
  text: string;
  senderName: string;
} {
  const name = (p.firstName ?? "").trim();
  const greeting = name ? `היי ${name},` : "היי,";

  // Trial CTA → the dedicated post-login subscribe page (same target as
  // results_ready). Not logged in → it redirects to login and back.
  const checkoutUrl = `${p.baseUrl}/he/journey/subscribe?utm_source=email&utm_medium=founder_story&utm_campaign=trial`;

  const subject = "הסיפור שמאחורי מיאושי (וזה התחיל אצלי בבית)";

  // ── Body copy (approved wording, verbatim) ─────────────────────────────────
  const paras = [
    "לפני שנספר לכם מה מיאושי עושה, קחו רגע לשמוע איך היא נולדה.",
    "אני יצחק, בן 48, נשוי 19 שנה ואבא. כמו אצל הרבה זוגות, אצלנו זה התחיל בלי דרמה: הילדים קטנים, החיים זזו מהר, ויום אחד הבטנו זה בזה וכבר לא זיהינו את עצמנו. ניסינו ייעוץ זוגי, דיברנו ובכינו, וזה לא עזר.",
    "אז החלטתי משהו אחר: אם אף אחד לא הולך להציל את הזוגיות שלנו, אני אעשה את זה בעצמי. קראתי מאות ספרים בשלוש שפות, למדתי ייעוץ זוגי בארץ, והוספתי השתלמויות בארצות הברית: NLP, תרפיה זוגית וטנטרה. וגיליתי שהסיפור שלנו לא יוצא דופן. זוגות נופלים שוב ושוב לאותן מלכודות, אבל יש דרכים אחרות לצאת מהן, קלות וחמות יותר, ולעשות את זה ביחד.",
    "החזרנו את התשוקה ואת המבטים החמים. ומשם הבנתי שאני לא יכול לשמור את זה לעצמי. ככה נולדה מיאושי, בית שייתן לכם בדיוק מה שעזר לנו, בלי הדרך הארוכה שאני עברתי.",
    'אל תחיו "ליד". תכתבו מחדש את הסיפור שלכם.',
  ];
  // Single trial mention, on the CTA line: leading text + "לחצו כאן" + trailing.
  const ctaLead = "אתם יכולים להתחיל עם 7 ימי התנסות ללא חיוב. ";
  const ctaTrail = " כדי להתחיל.";
  const signoff = ["באהבה,", "יצחק ברלב", "מייסד מיאושי ומוביל צוות המומחים"];

  // ── HTML helpers (mirror results_ready: 18px plain letter) ─────────────────
  const P = (s: string) =>
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;
  const signLine = (s: string) =>
    `<p style="margin:0;font-size:18px;line-height:1.6;color:${INK}">${esc(s)}</p>`;

  const unsub = p.unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: <a href="${p.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a></p>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            ${P(greeting)}
            ${paras.map(P).join("\n            ")}
            <p style="margin:0 0 12px;font-size:18px;line-height:1.7;color:${INK}">${esc(ctaLead)}<a href="${checkoutUrl}" style="color:${LINK};text-decoration:underline">לחצו כאן</a>${esc(ctaTrail)}</p>
            <p style="margin:24px 0 0;font-size:18px;line-height:1.6;color:${INK}">${esc(signoff[0])}</p>
            ${signLine(signoff[1])}
            ${signLine(signoff[2])}
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
    ...paras,
    "",
    `אתם יכולים להתחיל עם 7 ימי התנסות ללא חיוב. לחצו כאן כדי להתחיל: ${checkoutUrl}`,
    "",
    ...signoff,
  ];
  if (p.unsubscribeUrl) {
    textParts.push("", `לא רוצה לקבל מאיתנו מיילים יותר? אפשר להסיר מכאן: ${p.unsubscribeUrl}`);
  }

  return { subject, html, text: textParts.join("\n"), senderName: FOUNDER_STORY_SENDER_NAME };
}
