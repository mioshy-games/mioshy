/**
 * lib/poll/anon.ts
 *
 * Anonymous voter identity for the poll (§7): tracked by a cookie `poll_anon_id`.
 * Every vote is saved against this id even without registration; on signup
 * (Stage 6) the votes are linked to the user_id. Use ONLY inside Route Handlers
 * / Server Actions — cookies().set() throws during Server Component render.
 */

import { cookies } from "next/headers";
import crypto from "node:crypto";

export const POLL_ANON_COOKIE = "poll_anon_id";
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

/** Read the existing anon id, or mint + set one. Route-handler context only. */
export async function getOrCreatePollAnonId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(POLL_ANON_COOKIE)?.value?.trim();
  if (existing) return existing;

  const id = crypto.randomUUID();
  jar.set(POLL_ANON_COOKIE, id, {
    httpOnly: false, // read is fine client-side; it is not a secret
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_SEC,
    path: "/",
  });
  return id;
}

/** Read-only accessor (safe in Server Components); null if not set yet. */
export async function readPollAnonId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(POLL_ANON_COOKIE)?.value?.trim() || null;
}
