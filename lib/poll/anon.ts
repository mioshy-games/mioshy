/**
 * lib/poll/anon.ts
 *
 * Anonymous voter identity for the poll (§7). The id is a UUID kept in a
 * long-lived cookie `poll_anon_id`, MIRRORED client-side in localStorage
 * (lib/poll/anon-client.ts) and echoed back on every poll request via the
 * `x-poll-anon` header. If the cookie is missing (cleared / capped / blocked)
 * but the header carries a known id, the server ADOPTS it and re-sets the
 * cookie — so a returning visitor keeps the same identity and never re-answers
 * questions they already saw.
 *
 * Every vote row stores this id (poll_votes.anon_id), which is what links the
 * device to its answers server-side; on signup the votes are linked to user_id.
 *
 * Cookie writes go on the NextResponse (setPollAnonCookie) rather than
 * cookies().set(), so the Set-Cookie always ships with the JSON response.
 */

import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const POLL_ANON_COOKIE = "poll_anon_id";
/** Header the client sends with its localStorage-backed id (cookie fallback). */
export const POLL_ANON_HEADER = "x-poll-anon";
/** 400 days — the longest lifetime Chrome will honour for a cookie. */
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The client-supplied id from the request header, if it is a well-formed UUID. */
export function readPollAnonHeader(req: Request): string | null {
  const v = req.headers.get(POLL_ANON_HEADER)?.trim();
  return v && UUID_RE.test(v) ? v : null;
}

/**
 * Resolve this device's anon id: cookie first, then the client's localStorage
 * fallback, then a fresh UUID. `fresh` = the cookie has to be (re)written.
 */
export async function resolvePollAnonId(
  fallback?: string | null,
): Promise<{ id: string; fresh: boolean }> {
  const jar = await cookies();
  const existing = jar.get(POLL_ANON_COOKIE)?.value?.trim();
  if (existing && UUID_RE.test(existing)) return { id: existing, fresh: false };
  const id = fallback && UUID_RE.test(fallback) ? fallback : crypto.randomUUID();
  return { id, fresh: true };
}

/** Write the anon cookie onto an outgoing response. */
export function setPollAnonCookie(res: NextResponse, id: string): void {
  res.cookies.set(POLL_ANON_COOKIE, id, {
    httpOnly: false, // the client mirrors it into localStorage; it is not a secret
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SEC,
    path: "/",
  });
}

/** Read-only accessor (safe in Server Components); null if not set yet. */
export async function readPollAnonId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(POLL_ANON_COOKIE)?.value?.trim() || null;
}

/**
 * The signed-in user's id, or null for anonymous. Used to key the poll by
 * user_id (consistent across cookie clears / devices) when logged in, falling
 * back to the anon cookie otherwise. Never throws.
 */
export async function getPollUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
