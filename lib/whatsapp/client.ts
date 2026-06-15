/**
 * Low-level WhatsApp Cloud API client.
 *
 * Mirrors the lib/uxellent-api.ts contract: NEVER throws — always returns a
 * structured result. Retries transient failures with exponential backoff.
 *
 * Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
 */

type WhatsAppConfig = {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
};

export type SendResult =
  | { ok: true; waMessageId: string; raw: unknown }
  | { ok: false; status: number; errorCode?: string; message: string; raw?: unknown };

/** Reads config from env. Returns null if not configured (so callers fall back to email). */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { apiVersion, phoneNumberId, accessToken };
}

function endpoint(cfg: WhatsAppConfig): string {
  return `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
}

type WaApiResponse = {
  messages?: Array<{ id?: string }>;
  error?: { code?: number | string; message?: string };
};

const RETRY_DELAYS_MS = [500, 1000, 2000];

async function post(cfg: WhatsAppConfig, body: unknown): Promise<SendResult> {
  let lastErr: SendResult | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(endpoint(cfg), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => null)) as WaApiResponse | null;

      if (res.ok) {
        const waMessageId: string | undefined = json?.messages?.[0]?.id;
        if (waMessageId) return { ok: true, waMessageId, raw: json };
        return { ok: false, status: res.status, message: "No message id in response", raw: json };
      }

      const errorCode = json?.error?.code != null ? String(json.error.code) : undefined;
      const message = json?.error?.message || `HTTP ${res.status}`;
      lastErr = { ok: false, status: res.status, errorCode, message, raw: json };

      // Retry only on 5xx / 429. 4xx (bad number, unapproved template) is permanent.
      if (res.status < 500 && res.status !== 429) return lastErr;
    } catch (e: unknown) {
      lastErr = { ok: false, status: 0, message: e instanceof Error ? e.message : "Network error" };
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  return lastErr ?? { ok: false, status: 0, message: "Unknown error" };
}

export type TemplateComponent = {
  type: "header" | "body" | "button";
  sub_type?: "url" | "quick_reply";
  index?: string;
  parameters: Array<
    | { type: "text"; text: string }
    | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  >;
};

/** Send a pre-approved template message. `to` must be digits-only with country code. */
export async function sendTemplate(args: {
  to: string;
  templateName: string;
  languageCode: string; // e.g. "he" | "en"
  components?: TemplateComponent[];
}): Promise<SendResult> {
  const cfg = getWhatsAppConfig();
  if (!cfg) return { ok: false, status: 0, message: "WhatsApp not configured" };

  return post(cfg, {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.languageCode },
      ...(args.components?.length ? { components: args.components } : {}),
    },
  });
}

/** Send a free-text message. Only valid INSIDE the 24h service window. */
export async function sendText(args: { to: string; body: string }): Promise<SendResult> {
  const cfg = getWhatsAppConfig();
  if (!cfg) return { ok: false, status: 0, message: "WhatsApp not configured" };

  return post(cfg, {
    messaging_product: "whatsapp",
    to: args.to,
    type: "text",
    text: { preview_url: true, body: args.body },
  });
}

/** Mark an inbound message as read (blue ticks). Best-effort. */
export async function markRead(waMessageId: string): Promise<SendResult> {
  const cfg = getWhatsAppConfig();
  if (!cfg) return { ok: false, status: 0, message: "WhatsApp not configured" };

  return post(cfg, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: waMessageId,
  });
}
