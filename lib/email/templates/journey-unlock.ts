// ============================================================
// Journey unlock notification email (bilingual, inline CSS).
//
// Sent by the unlock-notifier cron when one or more scheduled items
// flip from locked → available for an owner. Supports 1..N items in a
// single email so partners don't get spammed when several chapters
// unlock on the same day.
// ============================================================
import "server-only";

export interface JourneyUnlockEmailItem {
  /** Localized title - caller picks the right language. */
  title: string;
  /** Optional category name for context. */
  categoryName: string | null;
  /** Deep link to the item detail page. */
  url: string;
}

export interface JourneyUnlockEmailInput {
  locale: "he" | "en";
  recipientName: string | null;
  items: JourneyUnlockEmailItem[];
  /** Fallback "go to my timeline" URL for the footer / multi-item CTA. */
  timelineUrl: string;
}

export interface JourneyUnlockEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function renderJourneyUnlockEmail(
  input: JourneyUnlockEmailInput,
): JourneyUnlockEmail {
  const isHe = input.locale === "he";
  const dir = isHe ? "rtl" : "ltr";
  const multi = input.items.length > 1;
  // Subject uses the raw name (mail clients render the subject as plain
  // text); HTML body uses the escaped version.
  const rawGreetingName = input.recipientName?.trim() || (isHe ? "היי" : "Hi");
  const greetingName = escapeHtml(rawGreetingName);

  const subject = multi
    ? isHe
      ? `${rawGreetingName}, ${input.items.length} פרקים חדשים מחכים לכם ✨`
      : `${rawGreetingName}, ${input.items.length} new chapters are waiting ✨`
    : isHe
      ? `${rawGreetingName}, הרגע הזה שלכם ✨`
      : `${rawGreetingName}, this moment is yours ✨`;

  // A personal opener at the very top ("Hi {name},"), followed by a
  // quiet credibility micro-line so the email lands as a note from a
  // real person with 25 years behind it - not a system notification.
  const greetingLine = isHe
    ? `<p style="margin:0 0 6px;font-size:18px;color:#1f2937;line-height:1.4;font-weight:600;">היי ${greetingName},</p>`
    : `<p style="margin:0 0 6px;font-size:18px;color:#1f2937;line-height:1.4;font-weight:600;">Hi ${greetingName},</p>`;

  const trustLine = isHe
    ? `<p style="margin:0 0 16px;font-size:12px;color:#64748b;line-height:1.5;letter-spacing:0.02em;">איציק ברלב · מלווה זוגות מאז 2001 · שיטה שנבחנה עם מאות זוגות</p>`
    : `<p style="margin:0 0 16px;font-size:12px;color:#64748b;line-height:1.5;letter-spacing:0.02em;">Itzik Berlav · Coaching couples since 2001 · A method tested with hundreds of couples</p>`;

  const intro = multi
    ? isHe
      ? `${greetingLine}${trustLine}
         <p style="margin:0 0 18px;font-size:16px;color:#334155;line-height:1.6;">כמה פרקים חדשים נפתחו במסע שלכם. אני יודע שהחיים עמוסים - לכן הם לא ילחצו עליכם. הם פשוט מחכים לרגע השקט ביניכם, לשיחה הקצרה שתעשו ביחד. כל פרק נבנה בזהירות על סמך עבודה עם זוגות אמיתיים.</p>`
      : `${greetingLine}${trustLine}
         <p style="margin:0 0 18px;font-size:16px;color:#334155;line-height:1.6;">A few new chapters just opened on your journey. I know life is full - that's why they won't rush you. They're simply waiting for a quiet moment between you, a short conversation you'll have together. Each chapter was carefully built from real work with real couples.</p>`
    : isHe
      ? `${greetingLine}${trustLine}
         <p style="margin:0 0 18px;font-size:16px;color:#334155;line-height:1.6;">פרק חדש במסע שלכם מחכה לכם עכשיו. הוא נבנה כדי לקחת רק כמה דקות - אבל עם הרגע הנכון והשיחה הנכונה, הוא יכול לשנות את היום שלכם כזוג. זה הצעד הקטן שבונה את הקשר הגדול.</p>`
      : `${greetingLine}${trustLine}
         <p style="margin:0 0 18px;font-size:16px;color:#334155;line-height:1.6;">A new chapter is waiting for you on your journey. It's built to take just a few minutes - but with the right moment and the right conversation, it can quietly change your day as a couple. Small steps like this are what build the relationship that lasts.</p>`;

  const itemsHtml = input.items
    .map((it) => {
      const cat = it.categoryName
        ? `<div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">${escapeHtml(
            it.categoryName,
          )}</div>`
        : "";
      return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px;background:#faf5ff;border-radius:16px;border:1px solid #e9d5ff;">
          <tr>
            <td style="padding:16px 18px;">
              ${cat}
              <div style="font-size:17px;font-weight:600;color:#1f2937;margin:0 0 10px;line-height:1.35;">
                ${escapeHtml(it.title)}
              </div>
              <a href="${escapeHtml(it.url)}"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1,#14b8a6);color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600;font-size:14px;line-height:1.2;min-height:44px;box-sizing:border-box;">
                ${isHe ? "פתיחת הפרק" : "Open this chapter"}
              </a>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  const timelineCta = multi
    ? `<div style="text-align:center;margin:24px 0 8px;">
        <a href="${escapeHtml(input.timelineUrl)}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 12px 24px rgba(99,102,241,0.3);">
          ${isHe ? "פתיחת ציר המסע" : "Open my timeline"}
        </a>
      </div>`
    : "";

  // Signature block - turns the email from "system notification" to
  // "a note from Itzik". The small since-2001 line builds trust without
  // feeling like a sales footer.
  const signature = isHe
    ? `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 6px;font-size:15px;color:#1f2937;">בהצלחה ובאהבה,</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#4338ca;">איציק ברלב</p>
        <p style="margin:2px 0 0;font-size:12px;color:#64748b;">מומחה ליחסים זוגיים · מלווה זוגות מאז 2001</p>
      </div>`
    : `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 6px;font-size:15px;color:#1f2937;">With you on the journey,</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#4338ca;">Itzik Berlav</p>
        <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Couples specialist · Coaching couples since 2001</p>
      </div>`;

  const footer = isHe
    ? `<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">מיאושי · המסע הזוגי שלכם · נוסד ב-2001</p>`
    : `<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Mioshy · Your couple's journey · Founded 2001</p>`;

  const htmlContent = `<!doctype html>
<html lang="${isHe ? "he" : "en"}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" dir="${dir}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f3ff;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 48px rgba(99,102,241,0.18);">
            <tr>
              <td style="background:linear-gradient(135deg,#6366f1,#14b8a6,#10b981);padding:32px 28px;text-align:center;">
                <p style="margin:0;font-size:13px;letter-spacing:0.1em;color:rgba(255,255,255,0.85);text-transform:uppercase;">
                  ${isHe ? "מיאושי · המסע" : "Mioshy · Journey"}
                </p>
                <h1 style="margin:10px 0 0;font-size:24px;color:#ffffff;line-height:1.2;">
                  ${
                    multi
                      ? isHe
                        ? "פרקים חדשים מחכים לכם"
                        : "New chapters are waiting"
                      : isHe
                        ? "פרק חדש מחכה לכם"
                        : "A new chapter is waiting"
                  }
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 12px;">
                ${intro}
                ${itemsHtml}
                ${timelineCta}
                <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
                  ${
                    isHe
                      ? "אין לחץ של זמן - הפרק ישאר פתוח כל עוד המסלול פעיל."
                      : "No time pressure - this chapter stays open as long as your program is active."
                  }
                </p>
                ${signature}
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

  const textLines: string[] = [];
  textLines.push(
    multi
      ? isHe
        ? `${input.items.length} פרקים חדשים נפתחו במסע שלכם:`
        : `${input.items.length} new chapters are open on your journey:`
      : isHe
        ? `פרק חדש נפתח במסע שלכם:`
        : `A new chapter is open on your journey:`,
  );
  textLines.push("");
  for (const it of input.items) {
    if (it.categoryName) textLines.push(`• ${it.categoryName}`);
    textLines.push(`  ${it.title}`);
    textLines.push(`  ${it.url}`);
    textLines.push("");
  }
  textLines.push(
    isHe ? `ציר המסע: ${input.timelineUrl}` : `Timeline: ${input.timelineUrl}`,
  );
  textLines.push("");
  textLines.push(
    isHe
      ? "בהצלחה ובאהבה,\nאיציק ברלב - מלווה זוגות מאז 2001"
      : "With you on the journey,\nItzik Berlav - Coaching couples since 2001",
  );

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
