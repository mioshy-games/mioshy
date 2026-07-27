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
 * Authentication:
 *   Brevo does not sign outbound webhooks with HMAC. We support an
 *   optional shared-secret check: if BREVO_WEBHOOK_SECRET is set in the
 *   environment, the request must include the same value in either an
 *   `Authorization: Bearer <secret>` header or `?secret=<secret>` query
 *   param. If the env var is unset, the endpoint is open (defended by
 *   URL obscurity) — fine for early Brevo setup, but set the secret in
 *   prod and add it as a custom header in the Brevo webhook config:
 *     Brevo → Webhook → Custom headers → "Authorization: Bearer <secret>"
 *
 * Response semantics:
 *   - Returns 200 on success AND on "email not found" (idempotent — Brevo
 *     retries on non-2xx, and we don't want to keep retrying for a
 *     deleted profile).
 *   - Returns 400 on malformed JSON or missing email field.
 *   - Returns 401 only if a wrong secret was supplied.
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

// ----------------------------------------------------------------
// Auth: optional shared-secret guard
// ----------------------------------------------------------------

function authorizeRequest(req: Request): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.BREVO_WEBHOOK_SECRET;
  if (!expected || expected.trim().length === 0) {
    // No secret configured — endpoint is open. This is intentional for
    // early-launch convenience but should be set before any sensitive
    // marketing campaign goes live.
    return { ok: true };
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;

  const url = new URL(req.url);
  const queryParam = url.searchParams.get("secret");

  if (bearer === expected || queryParam === expected) {
    return { ok: true };
  }
  return { ok: false, reason: "invalid_secret" };
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

export async function POST(req: Request) {
  // 1. Auth (optional)
  const auth = authorizeRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    return NextResponse.json({ ok: true, hardBounce: true });
  }

  if (!isUnsubscribeEvent(body)) {
    // Not an unsubscribe or hard-bounce event — ack 200 so Brevo doesn't
    // retry, but don't touch anything.
    return NextResponse.json({ ok: true, ignored: "non_actionable_event" });
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
    return NextResponse.json({ ok: true, matched: false });
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

  return NextResponse.json({ ok: true, matched: true });
}
