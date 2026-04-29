/**
 * POST /api/analytics/event
 *
 * Receives a product analytics event from the client and writes it to
 * analytics_events. Uses service-role so RLS doesn't interfere.
 *
 * Accepts: { event, session_id, device_id, locale, properties }
 * Returns: 204 No Content on success (or any error — never let this
 *          surface to the user).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export const runtime = "edge"; // fast, no cold-start

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      event?: string;
      session_id?: string;
      device_id?: string;
      locale?: string;
      properties?: Record<string, unknown>;
    };

    if (!body.event || typeof body.event !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    // Attempt to identify the authenticated user (best-effort)
    let userId: string | null = null;
    try {
      const sessionClient = await createServerSupabaseClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // ignore — analytics must never fail because of auth errors
    }

    const admin = createServiceRoleClient();
    if (!admin) return new NextResponse(null, { status: 204 });

    await admin.from("analytics_events").insert({
      event:      body.event,
      session_id: body.session_id ?? null,
      device_id:  body.device_id  ?? null,
      user_id:    userId,
      locale:     body.locale ?? null,
      properties: body.properties ?? {},
    });
  } catch {
    // Silently swallow — analytics must never break the app
  }

  return new NextResponse(null, { status: 204 });
}
