/**
 * Marathon daily dispatcher cron.
 *
 * Runs HOURLY (see vercel.json). The handler computes the current Israel-local
 * time (DST-safe) and sends each active enrollment its due day once the
 * weekday slot has arrived (Sun–Thu 10:00, Fri 14:00, Sat 21:00). Idempotent —
 * see lib/marathon/run.ts. Bearer-auth like the other journey crons.
 */

import { NextResponse } from "next/server";
import { runMarathonDispatch } from "@/lib/marathon/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const secret =
    process.env.MARATHON_CRON_SECRET ||
    process.env.JOURNEY_UNLOCK_CRON_SECRET ||
    process.env.CARDCOM_BILLING_CRON_SECRET;
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const result = await runMarathonDispatch({
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
