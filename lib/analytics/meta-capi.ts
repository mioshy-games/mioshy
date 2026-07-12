import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { metaEventId } from "./meta-event-id";

export { metaEventId };

/**
 * Meta (Facebook) Conversions API — server-side event sender.
 *
 * Companion to the browser Pixel (`lib/analytics/meta-pixel.ts`). The two
 * layers send the SAME event with the SAME `eventId` so Meta deduplicates
 * (no double counting). See docs/facebook-pixel-work-order.md.
 *
 * ── Hard safety contract (Itzik 2026-06-21) ──────────────────────────────────
 *   Every send is fire-and-forget with a try/catch AND a hard timeout. A Meta
 *   outage, a slow Graph response, or a bad token must NEVER break the payment /
 *   entitlement flow that calls us. `sendMetaCapiEvent` therefore:
 *     • NEVER throws (all errors are caught and logged).
 *     • ALWAYS resolves within `CAPI_TIMEOUT_MS` (AbortController).
 *     • no-ops silently when the pixel id / token env is missing.
 *   Callers `await` it (so the fetch completes before a serverless function
 *   freezes) but are guaranteed it can't reject or hang.
 *
 * ── Privacy ──────────────────────────────────────────────────────────────────
 *   • Email / phone / external_id are SHA-256 hashed (lowercase + trim) per
 *     Meta's Advanced Matching spec — raw PII never leaves our server.
 *   • `fbp` / `fbc` are Meta's own first-party cookies (sent verbatim, not PII).
 *   • client_ip_address is passed ONLY from the live request that already has it
 *     (checkout/create); it is never persisted to our DB.
 */

// Graph API version — verified current + supported 2026-06-21 (latest is v25.0,
// released 2026-02-18). Pinned here so a future bump is a one-line change.
const GRAPH_API_VERSION = "v25.0";

// Hard ceiling on every Graph call. Generous enough for a healthy round-trip,
// short enough that a Meta stall can't meaningfully delay a Cardcom webhook 200.
const CAPI_TIMEOUT_MS = 3000;

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
const ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
// Optional — only set during Test Events debugging; absent in normal prod.
const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE;

/** SHA-256 hex of a normalized (lowercase + trim) string. Empty → undefined. */
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalize a phone to digits-only with a country code before hashing, per
 * Meta's guidance. Heuristic tuned for Mioshy's mostly-Israeli base: a bare
 * local mobile ("05x-xxxxxxx" → 10 digits starting 0) becomes 972xxxxxxxxx.
 * Anything already international (or non-IL) keeps its digits as-is.
 */
function hashPhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return undefined;
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  }
  return crypto.createHash("sha256").update(digits).digest("hex");
}

// Same redaction list as the browser pixel — never let a share/pairing token
// reach Meta inside event_source_url.
const REDACT_QUERY_PARAMS = ["code", "token", "email", "invite", "ref_code"];

/** Strip sensitive query params from a URL for `event_source_url`. */
export function sanitizeMetaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    for (const p of REDACT_QUERY_PARAMS) {
      if (u.searchParams.has(p)) u.searchParams.set(p, "redacted");
    }
    return u.toString();
  } catch {
    return null;
  }
}

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  /** Stable user id → hashed into external_id for cross-event stitching. */
  externalId?: string | null;
  /** Meta browser cookies, captured first-party. Sent verbatim (not PII). */
  fbp?: string | null;
  fbc?: string | null;
  /** Only from a live browser request; never read from our DB. */
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export type MetaCapiEvent = {
  eventName:
    | "Purchase"
    | "InitiateCheckout"
    | "CompleteRegistration"
    | "ViewContent"
    | "PageView"
    | "Schedule";
  /** Shared with the browser Pixel event for deduplication. */
  eventId: string;
  /** Unix seconds. Defaults to now. */
  eventTime?: number;
  /** The page the user was on. Sanitize before passing (no share tokens). */
  eventSourceUrl?: string | null;
  userData: MetaUserData;
  customData?: Record<string, unknown>;
};

function buildUserData(u: MetaUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const em = hash(u.email);
  const ph = hashPhone(u.phone);
  const externalId = hash(u.externalId);
  // Meta expects hashed fields as arrays.
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  if (externalId) out.external_id = [externalId];
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  if (u.clientIpAddress) out.client_ip_address = u.clientIpAddress;
  if (u.clientUserAgent) out.client_user_agent = u.clientUserAgent;
  return out;
}

/**
 * Send ONE event to the Conversions API. Fire-and-forget semantics: never
 * throws, always settles within CAPI_TIMEOUT_MS, no-ops without env. Safe to
 * `await` inside a payment webhook.
 */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    // Missing config → silent no-op (same posture as PostHog / GTM).
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);

  try {
    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: event.eventName,
          event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
          event_id: event.eventId,
          action_source: "website",
          ...(event.eventSourceUrl
            ? { event_source_url: event.eventSourceUrl }
            : {}),
          user_data: buildUserData(event.userData),
          ...(event.customData ? { custom_data: event.customData } : {}),
        },
      ],
    };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(
        ACCESS_TOKEN,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      // Log the status + a short body so a token/permission issue is
      // diagnosable in Vercel logs — but DO NOT throw.
      const body = await res.text().catch(() => "");
      console.warn("[meta-capi] non-ok", {
        event: event.eventName,
        event_id: event.eventId,
        status: res.status,
        body: body.slice(0, 300),
      });
    }
  } catch (err) {
    // Timeout (abort), network error, anything — swallow. The caller's flow
    // (payment, signup) must continue regardless.
    console.warn("[meta-capi] send failed (ignored)", {
      event: event.eventName,
      event_id: event.eventId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull Meta match signals off the CURRENT request (server action / route
 * handler context only). `_fbp`/`_fbc` cookies + UA + client IP — the IP is used
 * in-memory for this event only and is never persisted. Returns `{}` when called
 * outside a request context (never throws).
 */
export function readMetaRequestContext(): Pick<
  MetaUserData,
  "fbp" | "fbc" | "clientIpAddress" | "clientUserAgent"
> {
  try {
    const c = cookies();
    const h = headers();
    const fwd = h.get("x-forwarded-for");
    return {
      fbp: c.get("_fbp")?.value ?? null,
      fbc: c.get("_fbc")?.value ?? null,
      clientIpAddress:
        (fwd ? fwd.split(",")[0]?.trim() : null) ?? h.get("x-real-ip"),
      clientUserAgent: h.get("user-agent"),
    };
  } catch {
    return {};
  }
}

/**
 * Send a CompleteRegistration event to CAPI for a just-registered user.
 *
 * AWAIT this (reliability fix, Itzik 2026-06-21): CompleteRegistration is
 * CAPI-only with no browser backup, so a fire-and-forget call could be dropped
 * when a serverless function freezes after returning. We therefore await it —
 * but `sendMetaCapiEvent` is itself 3s-timeout-bounded and never throws, so the
 * await can add at most ~3s and can NEVER break the signup result. Mirrors the
 * Purchase posture.
 */
export async function fireCompleteRegistrationCapi(args: {
  userId: string;
  email: string;
  phone?: string | null;
}): Promise<void> {
  await sendMetaCapiEvent({
    eventName: "CompleteRegistration",
    eventId: metaEventId.registration(args.userId),
    userData: {
      email: args.email,
      phone: args.phone ?? null,
      externalId: args.userId,
      ...readMetaRequestContext(),
    },
    customData: { status: true },
  });
}

