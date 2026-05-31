/**
 * POST /api/observability/client-error
 *
 * Receives a structured payload from the shell client error boundary
 * (`app/[locale]/(shell)/error.tsx`) and re-emits it as a server log
 * row so the same crash is searchable from Vercel without asking the
 * user for a screenshot.
 *
 * No DB write, no fanout, no email. Just a console.error with the
 * standard `scope=client.error` shape so the rest of the observability
 * filters work.
 *
 * No auth: the endpoint is open by design — a crashed client can't
 * always present its session cookie, and the payload is content the
 * client already had locally. We DO cap the body size + truncate the
 * stack so an attacker can't fill the logs with junk.
 *
 * Added 2026-05-31.
 */

import { NextResponse } from "next/server";
import { makeLogger } from "@/lib/observability/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = makeLogger("client.error");

interface Payload {
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  path?: unknown;
  ua?: unknown;
  at?: unknown;
}

const MAX_LEN = 4000;

function trunc(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > MAX_LEN ? value.slice(0, MAX_LEN) + "…" : value;
}

export async function POST(req: Request) {
  let body: Payload = {};
  try {
    body = (await req.json()) as Payload;
  } catch {
    log.warn("bad_json", {});
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  log.error("client_crash", {
    message: trunc(body.message),
    digest: trunc(body.digest),
    path: trunc(body.path),
    ua: trunc(body.ua),
    at: trunc(body.at),
    // Stack last — most verbose, but the most useful field for debugging.
    stack: trunc(body.stack),
  });

  return NextResponse.json({ ok: true });
}
