/**
 * Test-user invitation email.
 *
 * Sent automatically when an admin adds an email to the test-user
 * whitelist (via /dashboard/test-users). Two flavours:
 *
 *   • "registered"  — the email already has a Mioshy account. We just
 *                     tell them they're in and to log in.
 *   • "pending"     — the email has NOT signed up yet. We tell them to
 *                     sign up with this exact email so the auto-grant
 *                     kicks in on signup (see lib/auth signupAction).
 *
 * Mirrors the existing best-effort pattern: failures are logged but
 * never thrown back to the caller. We don't want a flaky Brevo to
 * block the admin from marking a user.
 *
 * Bilingual: defaults to Hebrew. Pass `locale: 'en'` for English.
 *
 * Added 2026-06-01.
 */

import { sendBrevoEmail } from "@/lib/email/brevo";
import { makeLogger } from "@/lib/observability/log";

const log = makeLogger("admin.test_user_invite");

interface SendArgs {
  to: string;
  /** Optional display name — falls back to "" when absent. Used as the
   *  greeting in the email body. */
  name?: string | null;
  /** "registered" = profile already exists; "pending" = invitation
   *  stored, the user must sign up before the grant materializes. */
  mode: "registered" | "pending";
  /** Optional free-form note the admin left. Surfaced verbatim in the
   *  body so the recipient sees the context the admin gave them. */
  note?: string | null;
  /** Hebrew by default — pass 'en' for an English version. */
  locale?: "he" | "en";
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://mioshy.com"
  ).replace(/\/+$/, "");
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendTestUserInvite(args: SendArgs): Promise<void> {
  const locale = args.locale ?? "he";
  const isHe = locale === "he";
  const url = siteUrl();
  const ctaHref =
    args.mode === "pending" ? `${url}/${locale}/auth/signup` : `${url}/${locale}/auth`;
  const greetingName = (args.name ?? "").trim();
  const noteText = (args.note ?? "").trim();

  // Subject + body are composed inline (no template engine) so the
  // copy is auditable in this one file. Future flavours (e.g. partner
  // invite) should follow the same shape.
  const subject = isHe
    ? "הוזמנת ל‑Mioshy — עולם הזוגיות"
    : "You're invited to Mioshy — the couples world";

  const greetingLine = isHe
    ? greetingName
      ? `שלום ${htmlEscape(greetingName)},`
      : "שלום,"
    : greetingName
      ? `Hi ${htmlEscape(greetingName)},`
      : "Hi,";

  const introHe =
    args.mode === "pending"
      ? "הוזמנת להתנסות ב‑<strong>Mioshy</strong> — פלטפורמה חדשה לזוגות שרוצים לחזק את הקשר ולחיות אותו טוב יותר. הכנו לך גישה מלאה לכל המוצרים שלנו, ללא תשלום."
      : "הוספנו אותך לרשימת הבודקים שלנו ב‑<strong>Mioshy</strong>. מהרגע הזה כל המוצרים שלנו פתוחים בשבילך, ללא תשלום.";

  const introEn =
    args.mode === "pending"
      ? "You've been invited to try <strong>Mioshy</strong> — a new platform for couples who want to strengthen their connection. We've set you up with full free access to every product."
      : "We've added you to our internal tester list at <strong>Mioshy</strong>. From this moment, every product on the platform is open to you free of charge.";

  const stepHe =
    args.mode === "pending"
      ? `הירשמו עם הכתובת <strong>${htmlEscape(args.to)}</strong> — ברגע שתסיימו, הגישה החינמית תתחיל אוטומטית.`
      : "התחברו ותוכלו להמשיך משם.";
  const stepEn =
    args.mode === "pending"
      ? `Sign up with the email <strong>${htmlEscape(args.to)}</strong> — the moment you finish, free access kicks in automatically.`
      : "Just log in and you'll find everything unlocked.";

  const askHe = `
    <p style="margin:0 0 12px 0;">נשמח אם אחרי שתתנסה תכתוב לנו פידבק קצר על:</p>
    <ul style="margin:0 0 16px 1.2em;padding:0;">
      <li>איך הייתה החוויה הראשונית</li>
      <li>מה היה ברור ומה היה פחות ברור</li>
      <li>איזה מקום הוסיף לך ערך — ואיזה הרגיש חסר</li>
    </ul>
    <p style="margin:0 0 12px 0;">הכי טוב פשוט להגיב למייל הזה. כל מילה עוזרת לנו.</p>`;
  const askEn = `
    <p style="margin:0 0 12px 0;">After you try it, we'd love a short note on:</p>
    <ul style="margin:0 0 16px 1.2em;padding:0;">
      <li>What the first experience felt like</li>
      <li>What was clear and what was confusing</li>
      <li>Which moments added real value — and what felt missing</li>
    </ul>
    <p style="margin:0 0 12px 0;">Easiest is to just reply to this email. Every line helps us.</p>`;

  const ctaLabelHe = args.mode === "pending" ? "להירשם ולהתחיל" : "להתחבר ולהמשיך";
  const ctaLabelEn = args.mode === "pending" ? "Sign up & start" : "Log in & continue";

  const noteBlock = noteText
    ? (isHe
        ? `<p style="margin:16px 0 0 0;padding:12px 16px;border-radius:10px;background:#F8EEEC;color:#4A3A45;font-size:13px;"><strong>הערה אישית:</strong> ${htmlEscape(noteText)}</p>`
        : `<p style="margin:16px 0 0 0;padding:12px 16px;border-radius:10px;background:#F8EEEC;color:#4A3A45;font-size:13px;"><strong>A note for you:</strong> ${htmlEscape(noteText)}</p>`)
    : "";

  const html = `
<!doctype html>
<html lang="${locale}" dir="${isHe ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${htmlEscape(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#FBF1F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#170E14;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EAE0E3;">
            <tr>
              <td style="padding:28px 28px 0 28px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#B83C4D;">Mioshy</div>
                <h1 style="margin:8px 0 16px 0;font-size:22px;line-height:1.3;color:#170E14;">${htmlEscape(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;font-size:16px;line-height:1.7;color:#2A1B25;">
                <p style="margin:0 0 14px 0;">${greetingLine}</p>
                <p style="margin:0 0 14px 0;">${isHe ? introHe : introEn}</p>
                <p style="margin:0 0 16px 0;">${isHe ? stepHe : stepEn}</p>
                ${isHe ? askHe : askEn}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px 28px;" align="${isHe ? "right" : "left"}">
                <a href="${ctaHref}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#B83C4D;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">
                  ${isHe ? ctaLabelHe : ctaLabelEn}
                </a>
                ${noteBlock}
                <p style="margin:24px 0 0 0;font-size:12px;color:#7A6A75;">
                  ${isHe
                    ? "תודה שאתה עוזר לנו להפוך את Mioshy לטוב יותר."
                    : "Thank you for helping us make Mioshy better."}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0 0;font-size:11px;color:#7A6A75;">
            ${isHe
              ? "Mioshy · עולם הזוגיות"
              : "Mioshy · the couples world"}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const textPlain = isHe
    ? [
        greetingLine,
        "",
        args.mode === "pending"
          ? `הוזמנת ל-Mioshy. הירשם עם הכתובת ${args.to} בכתובת:`
          : "הוספנו אותך לרשימת הבודקים שלנו ב-Mioshy. התחבר ב:",
        ctaHref,
        "",
        "נשמח לפידבק קצר אחרי שתתנסה — אפשר פשוט להגיב למייל הזה.",
        noteText ? `\nהערה אישית: ${noteText}` : "",
        "",
        "Mioshy — עולם הזוגיות",
      ].join("\n")
    : [
        greetingLine,
        "",
        args.mode === "pending"
          ? `You're invited to Mioshy. Sign up with ${args.to} at:`
          : "We've added you to our tester list at Mioshy. Log in at:",
        ctaHref,
        "",
        "After you try it, we'd love a short reply with your feedback.",
        noteText ? `\nA note for you: ${noteText}` : "",
        "",
        "Mioshy — the couples world",
      ].join("\n");

  try {
    const result = await sendBrevoEmail({
      to: [{ email: args.to, name: greetingName || undefined }],
      subject,
      htmlContent: html,
      textContent: textPlain,
      tags: ["test_user_invite", args.mode],
    });
    if (!result.ok && !result.skipped) {
      log.error("send_failed", { to: args.to, reason: result.error ?? "unknown" });
    } else {
      log.info("sent", {
        to: args.to,
        mode: args.mode,
        skipped: !!result.skipped,
      });
    }
  } catch (err) {
    log.error("threw", {
      to: args.to,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
