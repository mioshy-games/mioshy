/**
 * Webhook signature verification.
 *
 * Meta signs every webhook POST with X-Hub-Signature-256 = "sha256=<hmac>",
 * computed over the RAW request body using the App Secret. We must verify it
 * against the raw bytes (not a re-serialized JSON object).
 */

import crypto from "crypto";

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** GET handshake check used when registering the webhook in the App Dashboard. */
export function verifyWebhookChallenge(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return challenge;
  }
  return null;
}
