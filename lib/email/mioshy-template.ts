import "server-only";

/**
 * Shared Mioshy email layout — a plain personal letter (Itzik 2026-07-06):
 * it should read as if Itzik wrote it in his own mailbox and sent it by hand,
 * NOT as a newsletter. White background, system font (Arial/sans-serif), black
 * text, natural width. No card, no colour blocks, no gradient button. The CTA
 * is a normal text line with a plain blue underlined link. Scores are plain
 * text lines in the body. Signs off "יצחק ממיאושי"; a small unsubscribe line
 * at the very end (marketing only).
 *
 * RTL: dir="rtl" on <html>, <body>, and every <td> (not just text-align), so
 * punctuation lands on the left and score lines read "תקשורת: 50 מתוך 100".
 *
 * Voice rules apply to every string PASSED IN (no em-dash / "!" / emoji /
 * superlatives; "אתם/שלכם"); this file only lays them out.
 *
 * Returns both the HTML and a plain-text fallback (Brevo `textContent`).
 */

const INK = "#000000";
const LINK = "#1155cc";
const MUTED = "#888888";

export interface EmailCta {
  label: string;
  url: string;
}

export interface MioshyEmailOptions {
  /** Hidden preheader (inbox preview line). Keep ≤ ~85 chars. */
  preheader: string;
  /** "היי דנה," — pass the full greeting line (already personalized). */
  greeting: string;
  /** Body paragraphs, in order. Each becomes its own <p>. */
  paragraphs: string[];
  /** Optional "score lines" rendered as plain text lines in the body (§1). */
  scoreLines?: string[];
  primaryCta?: EmailCta;
  /** Secondary link, rendered as a plain text line (e.g. "לניהול המנוי"). */
  secondaryCta?: EmailCta;
  /** Unsubscribe URL (marketing only; omitted for transactional). */
  unsubscribeUrl?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMioshyEmail(opts: MioshyEmailOptions): {
  html: string;
  text: string;
} {
  // Split only on blank lines (\n\n) into separate paragraphs; collapse any
  // single \n or run of whitespace inside a paragraph to one space, so the
  // text flows and the browser wraps it naturally — never a hard mid-sentence
  // break.
  const paras = opts.paragraphs
    .flatMap((p) => p.split(/\n[ \t]*\n/))
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${esc(
          p,
        )}</p>`,
    )
    .join("");

  // Score lines — each its own block line (no <br>), no frame.
  const scores = opts.scoreLines?.length
    ? `<div style="margin:0 0 16px">${opts.scoreLines
        .map(
          (l) =>
            `<div style="font-size:16px;line-height:1.8;color:${INK}">${esc(
              l,
            )}</div>`,
        )
        .join("")}</div>`
    : "";

  // The CTA is a plain in-line link, not a button: the label itself is the
  // blue underlined link (no visible URL), the way a person links a word.
  const ctaLine = (cta: EmailCta): string =>
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:${INK}"><a href="${cta.url}" style="color:${LINK};text-decoration:underline">${esc(
      cta.label,
    )}</a></p>`;

  const button = opts.primaryCta
    ? `<div style="margin:20px 0 4px">${ctaLine(opts.primaryCta)}</div>`
    : "";
  const secondary = opts.secondaryCta ? ctaLine(opts.secondaryCta) : "";

  const unsub = opts.unsubscribeUrl
    ? `<a href="${opts.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline">להסרה מרשימת הדיוור</a>`
    : "";

  // Nested table keeps the text column to ~480px (≈10 words/line) and pinned
  // to the right, instead of stretching across the whole screen.
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr>
    <td dir="rtl" align="right" style="padding:20px 18px">
      <table dir="rtl" role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:100%;max-width:480px">
        <tr>
          <td dir="rtl" align="right" style="text-align:right;font-family:Arial,sans-serif;color:${INK}">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${esc(
              opts.greeting,
            )}</p>
            ${paras}
            ${scores}
            ${button}
            ${secondary}
            <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${INK}">יצחק ממיאושי</p>
            <img src="https://mioshy.com/images/mioshy-email-logo.png" width="97" height="46" alt="מיאושי" style="display:block;border:0;outline:none;margin:8px 0 0;width:97px;height:46px">
            ${
              unsub
                ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">${unsub}</p>`
                : ""
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

  // Plain-text fallback — the same letter, no markup.
  const textParts: string[] = [opts.greeting, "", ...opts.paragraphs];
  if (opts.scoreLines?.length) textParts.push("", ...opts.scoreLines);
  if (opts.primaryCta)
    textParts.push("", `${opts.primaryCta.label}: ${opts.primaryCta.url}`);
  if (opts.secondaryCta)
    textParts.push(`${opts.secondaryCta.label}: ${opts.secondaryCta.url}`);
  textParts.push("", "יצחק ממיאושי");
  if (opts.unsubscribeUrl)
    textParts.push("", `להסרה מרשימת הדיוור: ${opts.unsubscribeUrl}`);
  const text = textParts.join("\n");

  return { html, text };
}
