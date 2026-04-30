// ============================================================
// Brevo (formerly Sendinblue) transactional email client
// ============================================================
// Server-only. Expects env vars:
//   BREVO_API_KEY     - secret API key (required in prod; if missing
//                       in dev the sender becomes a noop + console log)
//   BREVO_SENDER_EMAIL - "from" address (e.g. hi@mioshy.co.il)
//   BREVO_SENDER_NAME  - "from" display name (e.g. "Mioshy")
// ============================================================
import "server-only";

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
  const apiKey = envOrNull("BREVO_API_KEY");
  const senderEmail = envOrNull("BREVO_SENDER_EMAIL");
  const senderName = envOrNull("BREVO_SENDER_NAME") ?? "Mioshy";

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
        to: payload.to,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        tags: payload.tags,
        params: payload.params,
        replyTo: payload.replyTo,
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
