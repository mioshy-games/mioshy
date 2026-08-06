/**
 * GET/POST /api/journey/pact-honoured
 *
 * Layer-3 daily cron — bumps journey_couple_pacts.honoured_through_week
 * when both partners (or solo user) had at least one item completion
 * in the most recently elapsed pact-week.
 *
 * The "honoured" surface drives the coach's "weeks remaining + on
 * track" view in the Coaching Room (Layer 2 visual lands here).
 *
 * Schedule: vercel.json `0 5 * * *`.
 */

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

interface Summary {
  ok:         boolean;
  considered: number;
  bumped:     number;
  errors:     string[];
}

const ONE_WEEK_MS = 7 * 86_400_000;

function authOk(req: Request): boolean {
  return isCronAuthorized(req, "journey");
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!authOk(req)) {
    return NextResponse.json(
      { ok: false, considered: 0, bumped: 0, errors: ["unauthorized"] },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, considered: 0, bumped: 0, errors: ["service_role_unavailable"] },
      { status: 503 },
    );
  }

  const { data: pacts, error: pactErr } = await admin
    .from("journey_couple_pacts")
    .select("id, couple_id, user_id, agreed_at, committed_weeks, honoured_through_week");
  if (pactErr) {
    return NextResponse.json(
      { ok: false, considered: 0, bumped: 0, errors: [pactErr.message] },
      { status: 500 },
    );
  }

  const errors: string[] = [];
  let bumped = 0;
  const now = Date.now();

  for (const pact of (pacts ?? []) as Array<{
    id:                    string;
    couple_id:             string | null;
    user_id:               string | null;
    agreed_at:             string;
    committed_weeks:       number;
    honoured_through_week: number | null;
  }>) {
    const startMs = new Date(pact.agreed_at).getTime();
    if (!Number.isFinite(startMs)) continue;

    const elapsedWeeks = Math.floor((now - startMs) / ONE_WEEK_MS);
    if (elapsedWeeks <= 0) continue;
    if (elapsedWeeks > pact.committed_weeks) continue; // pact done
    const candidateWeek = elapsedWeeks; // the just-elapsed week
    if ((pact.honoured_through_week ?? 0) >= candidateWeek) continue;

    // Window for the just-elapsed week.
    const weekStart = new Date(startMs + (candidateWeek - 1) * ONE_WEEK_MS);
    const weekEnd   = new Date(startMs + candidateWeek * ONE_WEEK_MS);

    // Count completions in that window for the right owner.
    let userIds: string[] = [];
    if (pact.couple_id) {
      const { data: members } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", pact.couple_id);
      userIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
    } else if (pact.user_id) {
      userIds = [pact.user_id];
    }
    if (userIds.length === 0) continue;

    const { data: completions } = await admin
      .from("journey_item_completions")
      .select("completed_by, completed_at")
      .in("completed_by", userIds)
      .gte("completed_at", weekStart.toISOString())
      .lt("completed_at", weekEnd.toISOString());

    const honoured = (completions ?? []).length > 0;
    if (!honoured) continue;

    // Use the RPC for safety (LEAST/GREATEST guard inside).
    const { error: rpcErr } = await admin.rpc("pact_record_honoured_week", {
      p_pact_id: pact.id,
      p_week:    candidateWeek,
    });
    if (rpcErr) {
      errors.push(`${pact.id}:${rpcErr.message}`);
      continue;
    }
    bumped++;
  }

  return NextResponse.json({
    ok: errors.length === 0,
    considered: (pacts ?? []).length,
    bumped,
    errors,
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
