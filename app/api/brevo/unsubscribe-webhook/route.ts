/**
 * POST /api/brevo/unsubscribe-webhook
 *
 * Inbound webhook called by Brevo when a contact clicks "unsubscribe" in
 * any email we sent (transactional or marketing). We flip the matching
 * profile's `marketing_consent` to false so:
 *   - subsequent signup-style code paths don't push the contact back into
 *     marketing lists, and
 *   - any future segmentation sync that reads profiles.marketing_consent
 *     respects the unsubscribe immediately.
 *
 * Configuration in the Brevo dashboard (LIVE since 2026-07-27 as webhook
 * "mioshy_hard_bounce_unsubscribe" — before that date NO webhook existed at all,
 * so neither unsubscribes nor hard bounces ever reached us):
 *   Brevo → Transactional → Settings → Webhooks → Add Webhook
 *   Events: "Unsubscribed" + "Hard Bounced"
 *   URL:    https://mioshy.com/api/brevo/unsubscribe-webhook
 *
 * Authentication (audit 2026-08-05, H1):
 *   Brevo does not sign outbound webhooks, so we use a shared secret —
 *   BREVO_WEBHOOK_SECRET — supplied as `Authorization: Bearer <secret>` or
 *   `?secret=<secret>`. Configure it in the Brevo webhook's custom headers:
 *     Brevo → Webhook → Custom headers → "Authorization: Bearer <secret>"
 *
 *   This check used to FAIL OPEN: with the variable unset the endpoint served
 *   anyone, and the variable was never set. It now fails CLOSED with 503.
 *   Comparison is constant-time.
 *
 * Response semantics:
 *   - 503 when no secret is configured. The endpoint is inert until deployed
 *     with one, which is louder than silently accepting the world.
 *   - Every request that gets past the secret returns the SAME body,
 *     `{ ok: true }`, whether the address matched a profile or not. The old
 *     `matched: true|false` told an unauthenticated caller whether any given
 *     email had an account here — an account-enumeration oracle over our
 *     entire user base. A wrong secret returns that identical body too, so
 *     probing yields no signal at all; the rejection is recorded server-side.
 *   - 400 on malformed JSON or a missing email. These say nothing about any
 *     account and keep genuine Brevo misconfiguration debuggable.
 *
 * Brevo payload shape (observed; v3 event docs):
 *   {
 *     "event": "unsubscribed",
 *     "email": "user@example.com",
 *     "date":  "2026-05-18 12:34:56",
 *     "ts":    1747545296,
 *     "message-id": "<...>",
 *     ...
 *   }
 *
 * We accept any payload that includes a top-level `email` string. We
 * also accept event="unsubscribe" as an alias (Brevo's naming has
 * varied across docs versions).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "node:crypto";

// ----------------------------------------------------------------
// Auth: optional shared-secret guard
// ----------------------------------------------------------------

/** Constant-time compare; a length mismatch costs the same as a value one. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

type AuthResult = { ok: true } | { ok: false; reason: "not_configured" | "invalid_secret" };

function authorizeRequest(req: Request): AuthResult {
  const expected = process.env.BREVO_WEBHOOK_SECRET;
  if (!expected || expected.trim().length === 0) {
    // FAIL CLOSED. Previously this returned ok:true, leaving the endpoint open
    // to anyone who knew the URL — and the variable was never set in any
    // environment, so that was the live state. Audit 2026-08-05, H1.
    return { ok: false, reason: "not_configured" };
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const queryParam = new URL(req.url).searchParams.get("secret");

  // Both candidates are always evaluated — no early exit on the first match.
  let ok = false;
  if (bearer !== null && secretMatches(bearer, expected)) ok = true;
  if (queryParam !== null && secretMatches(queryParam, expected)) ok = true;

  return ok ? { ok: true } : { ok: false, reason: "invalid_secret" };
}

// ----------------------------------------------------------------
// Payload parsing
// ----------------------------------------------------------------

type BrevoUnsubscribeEvent = {
  event?: unknown;
  email?: unknown;
};

function extractEmail(body: BrevoUnsubscribeEvent): string | null {
  const raw = body.email;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

function isUnsubscribeEvent(body: BrevoUnsubscribeEvent): boolean {
  const ev = typeof body.event === "string" ? body.event.toLowerCase() : "";
  // Brevo has historically emitted "unsubscribed" (past tense). We also
  // accept "unsubscribe" defensively. If the event field is missing we
  // still proceed — some webhook configs only forward unsubscribe events,
  // so there's nothing else this endpoint would be called for.
  return ev === "" || ev === "unsubscribed" || ev === "unsubscribe";
}

/** Brevo hard-bounce event ("hard_bounce"). Requires the webhook to be
 *  subscribed to hardBounce events in the Brevo dashboard. */
function isHardBounceEvent(body: BrevoUnsubscribeEvent): boolean {
  const ev = typeof body.event === "string" ? body.event.toLowerCase() : "";
  return ev === "hard_bounce" || ev === "hardbounce" || ev === "hard bounce";
}

/**
 * Find the auth user for an email.
 *
 * ⚠️ `listUsers()` with no arguments returns only the FIRST PAGE (50 users).
 * The original code scanned that single page, so an unsubscribe from anyone
 * outside it silently found no match, acked 200 and left marketing_consent
 * untouched — i.e. we would have kept mailing someone who unsubscribed. At the
 * time this was found there were 192 auth users, so 142 of them (74%) were
 * unreachable. It had never surfaced because no Brevo webhook existed at all
 * until 2026-07-27, so this path had never run in production.
 *
 * Pages explicitly until the address is found or the list is exhausted.
 * Returns the user, null when genuinely absent, or "lookup_failed" on an API
 * error (so the caller can 500 and let Brevo retry, rather than mistaking an
 * outage for "not our user").
 */
async function findUserByEmail(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  email: string,
): Promise<{ id: string } | null | "lookup_failed"> {
  const PER_PAGE = 1000;
  const MAX_PAGES = 50; // 50k users — far beyond any realistic list here
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) {
      console.error("[brevo-unsubscribe] listUsers failed", { page, error });
      return "lookup_failed";
    }
    const users = data?.users ?? [];
    const hit = users.find(
      (u) => typeof u.email === "string" && u.email.toLowerCase() === email,
    );
    if (hit) return { id: hit.id };
    if (users.length < PER_PAGE) return null; // last page, no match
  }
  console.warn("[brevo-unsubscribe] user list exceeded MAX_PAGES without a match", { email });
  return null;
}

// ----------------------------------------------------------------
// Handler
// ----------------------------------------------------------------

/** The single body every authenticated outcome returns. See the docblock. */
const ACK = { ok: true } as const;

export async function POST(req: Request) {
  // 1. Auth — fails closed, and never tells the caller which way it failed.
  const auth = authorizeRequest(req);
  if (!auth.ok) {
    if (auth.reason === "not_configured") {
      console.error(
        "[brevo-unsubscribe] BREVO_WEBHOOK_SECRET is not set — refusing every request. " +
          "Unsubscribes and hard bounces are NOT being recorded until it is configured.",
      );
      return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
    }
    // Wrong secret: answer exactly as we would for an address with no account,
    // so the endpoint cannot be used to test whether an email is registered.
    // The only record of the rejection is this log line.
    console.warn("[brevo-unsubscribe] rejected: invalid secret");
    return NextResponse.json(ACK);
  }

  // 2. Parse body
  let body: BrevoUnsubscribeEvent;
  try {
    body = (await req.json()) as BrevoUnsubscribeEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = extractEmail(body);
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  // Hard bounce → suppress the address so every future send skips it (guard
  // against a fake/broken address re-contaminating the funnel).
  if (isHardBounceEvent(body)) {
    const admin = createAdminSupabaseClient();
    await admin
      .from("email_hard_bounces")
      .upsert(
        {
          email: email.toLowerCase(),
          reason: typeof body.event === "string" ? body.event : "hard_bounce",
        },
        { onConflict: "email" },
      )
      .then(
        () => undefined,
        () => undefined,
      );
    return NextResponse.json(ACK);
  }

  if (!isUnsubscribeEvent(body)) {
    // Not an unsubscribe or hard-bounce event — ack 200 so Brevo doesn't
    // retry, but don't touch anything.
    return NextResponse.json(ACK);
  }

  // 3. Find profile by email (via auth.users since profiles doesn't
  // store email directly — it lives on auth.users.email).
  const admin = createAdminSupabaseClient();

  const match = await findUserByEmail(admin, email);
  if (match === "lookup_failed") {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (!match) {
    // Idempotent: the email may have been a lead-only contact or a
    // deleted account. Acknowledge 200 so Brevo doesn't retry.
    console.warn(
      "[brevo-unsubscribe] no matching profile for email; acking anyway",
      { email },
    );
    return NextResponse.json(ACK);
  }

  // 4. Flip marketing_consent off. We stamp the timestamp so any audit
  // surface can show "unsubscribed at YYYY-MM-DD via Brevo".
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      marketing_consent: false,
      marketing_consent_at: new Date().toISOString(),
      marketing_consent_source: "brevo_unsubscribe",
    })
    .eq("id", match.id);

  if (updateErr) {
    console.error("[brevo-unsubscribe] update failed", { email, updateErr });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  console.info("[brevo-unsubscribe] consent revoked", {
    email,
    user_id: match.id,
  });

  return NextResponse.json(ACK);
}
