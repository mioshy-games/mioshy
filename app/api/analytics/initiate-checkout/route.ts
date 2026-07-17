/**
 * POST /api/analytics/initiate-checkout
 *
 * Server (CAPI) leg of the results-page InitiateCheckout event. The browser
 * Pixel fires the same event with the same `eventId` (a per-click uuid), so Meta
 * deduplicates the two into one. Called with `keepalive: true` from the client
 * right before it redirects to Cardcom, so the request survives the navigation.
 *
 * Node runtime (NOT edge): meta-capi uses `node:crypto` + `server-only`.
 *
 * Best-effort, like /api/analytics/event: never surfaces an error, always 204.
 * `fireInitiateCheckoutCapi` is itself 3s-bounded and never throws.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fireInitiateCheckoutCapi } from "@/lib/analytics/meta-capi";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      value?: number;
      currency?: string;
      contentName?: string;
      eventSourceUrl?: string;
    };

    // eventId is the dedup key shared with the Pixel — required.
    if (!body.eventId || typeof body.eventId !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    // Best-effort match signals — attach the logged-in user's email/id (hashed
    // inside fireInitiateCheckoutCapi; raw PII never leaves the server). Anon
    // (rare on this page — it's post-register) → cookie/IP/UA matching only.
    let userId: string | null = null;
    let email: string | null = null;
    try {
      const sb = await createServerSupabaseClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      userId = user?.id ?? null;
      email = user?.email ?? null;
    } catch {
      // ignore — analytics must never fail because of auth
    }

    await fireInitiateCheckoutCapi({
      eventId: body.eventId,
      userId,
      email,
      value: typeof body.value === "number" ? body.value : 0,
      currency: typeof body.currency === "string" ? body.currency : "ILS",
      contentName: typeof body.contentName === "string" ? body.contentName : "",
      eventSourceUrl:
        typeof body.eventSourceUrl === "string" ? body.eventSourceUrl : null,
    });
  } catch {
    // Silently swallow — analytics must never break checkout.
  }

  return new NextResponse(null, { status: 204 });
}
