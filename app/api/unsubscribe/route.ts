/**
 * POST /api/unsubscribe?u=<token> — RFC 8058 "List-Unsubscribe-Post" one-click
 * endpoint (Itzik 2026-07-16).
 *
 * Wired from the List-Unsubscribe / List-Unsubscribe-Post headers on our
 * marketing sends, so the mail client's native "Unsubscribe" button opts the
 * recipient out in one click. The signed ?u= token is the authentication — no
 * login, not guessable.
 *
 * Only POST performs the opt-out (RFC 8058 mandates a POST for one-click, which
 * also means link-prefetch scanners — which use GET — can't trigger it). GET
 * just points the human at the confirm page.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { performUnsubscribe } from "@/lib/email/unsubscribe";

export async function POST(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("u");
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }
  const res = await performUnsubscribe(userId);
  // Always 200 to the mail client on a valid token — the opt-out is recorded
  // (or was already), and we don't want the client to surface an error.
  return NextResponse.json({ ok: res.ok });
}

// A human who opens the header URL in a browser (GET) is sent to the confirm
// page rather than silently opted out.
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("u") ?? "";
  return NextResponse.redirect(
    new URL(`/he/unsubscribe?u=${encodeURIComponent(token)}`, req.url),
  );
}
