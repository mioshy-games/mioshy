import "server-only";

/**
 * Shared Mioshy email template — a clean, personal-letter layout (Itzik
 * 2026-07-04): mostly text, RTL Hebrew, a small "מיאושי" wordmark in the
 * signature, one brand-gradient CTA button and an optional quiet secondary link.
 * Returns both the HTML and a plain-text fallback (Brevo `textContent`).
 *
 * Voice rules apply to every string PASSED IN (no em-dash / "!" / emoji /
 * superlatives; "אתם/שלכם"); this file only lays them out.
 *
 * Kept intentionally table-free-ish and inline-styled for broad client support.
 */

const BRAND_INK = "#241726";
const BRAND_WINE = "#7a1f2b";
const GRAD = "linear-gradient(90deg,#7c3aed,#d946ef,#f59e0b)";
const MUTED = "#6f6257";

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
  /** Optional block of "score lines" rendered as a tidy list (email §1). */
  scoreLines?: string[];
  primaryCta?: EmailCta;
  /** Quiet text link under the button (e.g. "לניהול המנוי או ביטול"). */
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
  const paras = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${BRAND_INK}">${esc(
          p,
        )}</p>`,
    )
    .join("");

  const scores = opts.scoreLines?.length
    ? `<div style="margin:0 0 18px;padding:14px 16px;background:#faf1e6;border:1px solid #f0e0cc;border-radius:12px">${opts.scoreLines
        .map(
          (l) =>
            `<div style="font-size:16px;line-height:1.7;color:${BRAND_INK}">${esc(
              l,
            )}</div>`,
        )
        .join("")}</div>`
    : "";

  const button = opts.primaryCta
    ? `<div style="margin:22px 0 8px"><a href="${opts.primaryCta.url}" style="display:inline-block;background:${GRAD};color:#ffffff;text-decoration:none;font-weight:800;font-size:17px;padding:14px 28px;border-radius:999px">${esc(
        opts.primaryCta.label,
      )}</a></div>`
    : "";

  const secondary = opts.secondaryCta
    ? `<div style="margin:4px 0 8px"><a href="${opts.secondaryCta.url}" style="color:${MUTED};font-size:14px;text-decoration:underline">${esc(
        opts.secondaryCta.label,
      )}</a></div>`
    : "";

  const unsub = opts.unsubscribeUrl
    ? `<a href="${opts.unsubscribeUrl}" style="color:#a99;text-decoration:underline">להסרה מרשימת הדיוור</a>`
    : "";

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f7f1e8;font-family:Arial,'Assistant',sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<div style="max-width:480px;margin:0 auto;padding:24px 12px">
  <div style="background:#fffdf9;border:1px solid #e5dccb;border-radius:20px;padding:26px 22px">
    <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:${BRAND_INK}">${esc(
      opts.greeting,
    )}</p>
    ${paras}
    ${scores}
    ${button}
    ${secondary}
    <div style="margin-top:26px;padding-top:16px;border-top:1px solid #ece2cf">
      <span style="font-size:18px;font-weight:900;color:${BRAND_WINE}">מיאושי</span>
      <div style="font-size:13px;color:${MUTED};margin-top:2px">ייעוץ זוגי עם מיאושי</div>
    </div>
  </div>
  <div style="text-align:center;font-size:12px;color:#a99;margin-top:14px">${unsub}</div>
</div>
</body></html>`;

  // Plain-text fallback — the same letter, no markup.
  const textParts: string[] = [opts.greeting, "", ...opts.paragraphs];
  if (opts.scoreLines?.length) textParts.push("", ...opts.scoreLines);
  if (opts.primaryCta) textParts.push("", `${opts.primaryCta.label}: ${opts.primaryCta.url}`);
  if (opts.secondaryCta) textParts.push(`${opts.secondaryCta.label}: ${opts.secondaryCta.url}`);
  textParts.push("", "מיאושי — ייעוץ זוגי עם מיאושי");
  if (opts.unsubscribeUrl) textParts.push(`להסרה מרשימת הדיוור: ${opts.unsubscribeUrl}`);
  const text = textParts.join("\n");

  return { html, text };
}
