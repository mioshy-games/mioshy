// ============================================================
// Shared Brevo HTTP client
// ============================================================
// One place to:
//   - resolve the API key (decoding the base64-wrapped JSON shape we
//     store in .env.local: `{"api_key":"xkeysib-..."}`),
//   - issue requests with the right `api-key` / `accept` /
//     `content-type` headers.
//
// Used by:
//   - lib/email/brevo.ts                       (transactional sends)
//   - lib/email/brevo-segments-sync.ts         (sync wrapper, server-only)
//   - lib/email/brevo-segments-sync-core.ts    (sync logic, CLI-safe)
//   - scripts/brevo-test-tag.ts                (CLI smoke test, runs via tsx)
//
// NOTE: this module deliberately does NOT `import "server-only"`. The
// guard belongs at the use-site (brevo.ts and brevo-segments-sync.ts both
// import "server-only" before re-exporting), so client-component bundlers
// still get the protection. Pushing the guard down into this layer would
// break the CLI smoke test, which has to import `brevoFetch` transitively
// when running outside Next's RSC context.
// ============================================================

const BASE = "https://api.brevo.com/v3";

/**
 * Resolve the Brevo API key from the environment.
 *
 * Historical note: the value committed to `.env.local` is a
 * base64-encoded JSON wrapper of the form `{"api_key":"xkeysib-..."}`.
 * Earlier code passed that raw value directly as the `api-key` header,
 * which Brevo rejects with 401. This helper decodes the wrapper when
 * present and falls back to the raw value otherwise, so both formats
 * work (raw xkeysib-… in prod env, wrapped JSON in local .env.local).
 *
 * Throws if neither shape resolves to a non-empty string. Callers that
 * want a "skip silently in dev" behaviour should use the safe variant
 * `getBrevoApiKeyOrNull()` instead.
 */
export function getBrevoApiKey(): string {
  const key = getBrevoApiKeyOrNull();
  if (!key) {
    throw new Error("BREVO_API_KEY not set");
  }
  return key;
}

export function getBrevoApiKeyOrNull(): string | null {
  const raw = process.env.BREVO_API_KEY;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  // Try the base64-wrapped JSON shape first.
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as { api_key?: unknown };
    if (typeof parsed.api_key === "string" && parsed.api_key.length > 0) {
      return parsed.api_key;
    }
  } catch {
    // Not base64-JSON — fall through and treat the raw value as the key.
  }

  return raw;
}

/**
 * Thin fetch wrapper for the Brevo v3 API.
 *
 * - Adds the `api-key`, `accept`, and (when there's a body) `content-type`
 *   headers automatically.
 * - Caller-supplied headers win over defaults.
 * - Returns the raw Response — caller is responsible for `.ok` / `.json()`
 *   handling. This is deliberate so segment-sync code can swallow errors
 *   without affecting user-facing flows.
 *
 * Example:
 *   const res = await brevoFetch("/contacts", {
 *     method: "POST",
 *     body: JSON.stringify({ email: "a@b.com" }),
 *   });
 */
export async function brevoFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const hasBody = init.body !== undefined && init.body !== null;
  const baseHeaders: Record<string, string> = {
    "api-key": getBrevoApiKey(),
    accept: "application/json",
  };
  if (hasBody) {
    baseHeaders["content-type"] = "application/json";
  }

  // Caller headers take precedence so they can override content-type
  // for e.g. file uploads.
  const headers: HeadersInit = {
    ...baseHeaders,
    ...(init.headers as Record<string, string> | undefined),
  };

  return fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
}

export const BREVO_API_BASE = BASE;
