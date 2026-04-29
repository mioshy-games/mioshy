// ============================================================
// Couple-invitation email template (bilingual, inline CSS)
// ============================================================
import "server-only";

export interface CoupleInviteEmailInput {
  locale: "he" | "en";
  inviterName: string;
  inviteeName: string | null;
  coupleDisplayName: string | null;
  inviteUrl: string;
  expiresAt: string; // ISO
  /** Optional game title to mention in the subject/body */
  gameTitle?: string | null;
}

export interface CoupleInviteEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function renderCoupleInviteEmail(
  input: CoupleInviteEmailInput,
): CoupleInviteEmail {
  const isHe = input.locale === "he";
  const dir = isHe ? "rtl" : "ltr";

  const inviter = escapeHtml(input.inviterName || (isHe ? "בן/בת זוגך" : "your partner"));
  const inviteeGreeting = input.inviteeName
    ? escapeHtml(input.inviteeName)
    : isHe
      ? "היי"
      : "Hi";

  const expires = new Date(input.expiresAt);
  const expiryLabel = expires.toLocaleDateString(isHe ? "he-IL" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subject = isHe
    ? input.gameTitle
      ? `${inviter} הזמין/ה אותך ל-${escapeHtml(input.gameTitle)} במיאושי 💜`
      : `${inviter} הזמין/ה אותך להצטרף במיאושי 💜`
    : input.gameTitle
      ? `${inviter} invited you to ${escapeHtml(input.gameTitle)} on Mioshy 💜`
      : `${inviter} invited you to join them on Mioshy 💜`;

  const ctaLabel = isHe ? "הצטרפות לחלל הזוגי" : "Join your couple space";

  const intro = isHe
    ? `<p style="margin:0 0 16px;font-size:16px;color:#1f2937;">${inviteeGreeting}, ${inviter} יצר/ה לשניכם מקום זוגי פרטי במיאושי ורוצה לשתף אותך.</p>`
    : `<p style="margin:0 0 16px;font-size:16px;color:#1f2937;">${inviteeGreeting}, ${inviter} created a private couple space on Mioshy and wants to share it with you.</p>`;

  const benefits = isHe
    ? [
        "כל המשחקים והתוכן שנרכשו — פתוחים לשניכם",
        "חלל פרטי רק לשניכם, נשמר בחשבון שלכם",
        "אפשר לשחק מכל מחשב או טלפון, גם לא זה ליד זה",
      ]
    : [
        "Every game and piece of content you've both bought — unlocked for the two of you",
        "A private space just for the two of you, tied to your account",
        "Play from any laptop or phone, even when you're not side by side",
      ];

  const benefitsHtml = `
    <ul style="margin:0 0 24px;padding-inline-start:20px;color:#334155;font-size:15px;line-height:1.6;">
      ${benefits.map((b) => `<li style="margin-bottom:6px;">${escapeHtml(b)}</li>`).join("")}
    </ul>
  `;

  const expirationNote = isHe
    ? `<p style="margin:24px 0 0;font-size:12px;color:#64748b;">הקישור תקף עד ${expiryLabel}. אם לא ביקשת את ההזמנה — אפשר פשוט להתעלם.</p>`
    : `<p style="margin:24px 0 0;font-size:12px;color:#64748b;">This link is valid until ${expiryLabel}. If you weren't expecting it, just ignore this email.</p>`;

  const footer = isHe
    ? `<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">מיאושי · משחקי זוגיות לזוגות שרוצים יותר</p>`
    : `<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Mioshy · Couples games for partners who want more</p>`;

  const url = escapeHtml(input.inviteUrl);

  const htmlContent = `<!doctype html>
<html lang="${isHe ? "he" : "en"}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#fdf2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" dir="${dir}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fdf2f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 48px rgba(236,72,153,0.15);">
            <tr>
              <td style="background:linear-gradient(135deg,#f472b6,#a855f7,#ec4899);padding:32px 28px;text-align:center;">
                <p style="margin:0;font-size:14px;letter-spacing:0.08em;color:rgba(255,255,255,0.85);text-transform:uppercase;">
                  ${isHe ? "מיאושי" : "Mioshy"}
                </p>
                <h1 style="margin:10px 0 0;font-size:24px;color:#ffffff;">
                  ${isHe ? "הוזמנת לחלל הזוגי 💜" : "You've been invited 💜"}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                ${intro}
                ${benefitsHtml}
                <div style="text-align:center;margin:28px 0;">
                  <a href="${url}"
                     style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 12px 24px rgba(236,72,153,0.3);">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </div>
                <p style="margin:0;font-size:13px;color:#64748b;">
                  ${isHe ? "או העתיקו את הקישור לדפדפן:" : "Or paste this link into your browser:"}
                </p>
                <p style="margin:6px 0 0;font-size:12px;color:#475569;word-break:break-all;direction:ltr;">
                  <a href="${url}" style="color:#a855f7;text-decoration:underline;">${url}</a>
                </p>
                ${expirationNote}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 28px;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = isHe
    ? [
        `${inviteeGreeting},`,
        "",
        `${input.inviterName || "בן/בת זוגך"} יצר/ה עבורכם חלל זוגי במיאושי.`,
        "",
        "כדי להצטרף:",
        input.inviteUrl,
        "",
        `הקישור תקף עד ${expiryLabel}.`,
        "אם לא ביקשת את ההזמנה — אפשר להתעלם.",
        "",
        "— מיאושי",
      ]
    : [
        `${inviteeGreeting},`,
        "",
        `${input.inviterName || "Your partner"} created a couple space for you on Mioshy.`,
        "",
        "To join:",
        input.inviteUrl,
        "",
        `This link is valid until ${expiryLabel}.`,
        "If you weren't expecting it, just ignore this email.",
        "",
        "— Mioshy",
      ];

  return {
    subject,
    htmlContent,
    textContent: textLines.join("\n"),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
