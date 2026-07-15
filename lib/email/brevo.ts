// ============================================================
// Brevo (formerly Sendinblue) transactional email client
// ============================================================
// Server-only. Expects env vars:
//   BREVO_API_KEY     - secret API key (required in prod; if missing
//                       in dev the sender becomes a noop + console log)
//   BREVO_SENDER_EMAIL - "from" address (e.g. no-reply@mioshy.com)
//   BREVO_SENDER_NAME  - "from" display name (e.g. "יצחק ממיאושי")
//   BREVO_REPLY_TO_EMAIL - default "reply-to" address for replies to a
//                       no-reply "from" (defaults to support@mioshy.com).
//                       A per-call payload.replyTo always wins.
// ============================================================
import "server-only";

import { getBrevoApiKeyOrNull } from "./brevo-client";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoPayload {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
  params?: Record<string, unknown>;
  replyTo?: BrevoRecipient;
  /** Per-send "from" display-name override. Defaults to BREVO_SENDER_NAME
   *  ("יצחק ממיאושי"). Only results_ready uses this today ("יצחק ברלב"); every
   *  other caller omits it and keeps the default. The from ADDRESS is never
   *  overridden (deliverability/SPF stays on the verified sender). */
  senderName?: string;
  /** Custom email headers, e.g. RFC 8058 List-Unsubscribe / -Post for the mail
   *  client's native one-click unsubscribe button. Omitted when empty. */
  headers?: Record<string, string>;
}

export interface BrevoSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

function envOrNull(key: string): string | null {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Send a transactional email through Brevo. Returns an OK result even
 * when skipped (dev mode without API key) so callers don't need to
 * branch on the environment - they just treat "email was dispatched".
 */
export async function sendBrevoEmail(
  payload: BrevoPayload,
): Promise<BrevoSendResult> {
  // The API key is resolved through getBrevoApiKeyOrNull(), which decodes
  // the base64-wrapped JSON shape stored in .env.local
  // ({"api_key":"xkeysib-..."}) and falls back to the raw value when
  // BREVO_API_KEY is already in xkeysib- form (e.g., on Vercel).
  const apiKey = getBrevoApiKeyOrNull();
  const senderEmail = envOrNull("BREVO_SENDER_EMAIL");
  // Per-send override wins over the env default; the from ADDRESS never changes.
  const senderName =
    (payload.senderName && payload.senderName.trim()) ||
    envOrNull("BREVO_SENDER_NAME") ||
    "יצחק ממיאושי";
  // The "from" is a no-reply address, so a bare reply bounces. Default a
  // reply-to (support@mioshy.com) unless the caller set one explicitly
  // (e.g. couple invitations route replies to the inviter).
  const replyToEmail = envOrNull("BREVO_REPLY_TO_EMAIL") ?? "support@mioshy.com";

  if (!apiKey || !senderEmail) {
    // Don't throw in dev - just log so devs can see the message we
    // would have sent.
    console.warn(
      "[brevo] BREVO_API_KEY/BREVO_SENDER_EMAIL not set - skipping send",
      {
        to: payload.to.map((r) => r.email),
        subject: payload.subject,
      },
    );
    return { ok: true, skipped: true };
  }

  // Hard-bounce guard: never send to a suppressed address (a fake/broken
  // address that hard-bounced). Best-effort — a DB hiccup must NOT block real
  // mail, so on any error we fall back to the original recipient list.
  let recipients = payload.to;
  try {
    const admin = createServiceRoleClient();
    if (admin && recipients.length > 0) {
      const emails = recipients.map((r) => r.email.toLowerCase());
      const { data: bounced } = await admin
        .from("email_hard_bounces")
        .select("email")
        .in("email", emails);
      if (bounced && bounced.length > 0) {
        const suppressed = new Set(
          bounced.map((b) => String(b.email).toLowerCase()),
        );
        recipients = recipients.filter(
          (r) => !suppressed.has(r.email.toLowerCase()),
        );
      }
    }
  } catch {
    /* proceed with the original recipients */
  }
  if (recipients.length === 0) {
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: recipients,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        tags: payload.tags,
        params: payload.params,
        replyTo: payload.replyTo ?? { email: replyToEmail, name: senderName },
        ...(payload.headers && Object.keys(payload.headers).length > 0
          ? { headers: payload.headers }
          : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[brevo] send failed", res.status, text);
      return { ok: false, error: `brevo_${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      messageId?: string;
    };
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "brevo_error";
    console.error("[brevo] exception", err);
    return { ok: false, error: msg };
  }
}
