/**
 * POST /api/journey/classify-backfill
 *
 * Admin-only: classify historical user messages where sentiment is
 * still NULL. Each call processes up to MAX_PER_RUN messages so the
 * cost is predictable and the route stays within Vercel's 60s limit.
 *
 * Strategy:
 *   1. Pull NULL-sentiment user messages from BOTH tables.
 *   2. Run classifier serially (Anthropic rate limits prefer this
 *      over parallel for small batches).
 *   3. Update each row with sentiment + auto_tags.
 *   4. Return a summary.
 *
 * Auth: admin role required (read profiles.role).
 *
 * Idempotent: NULL-sentiment filter means classified rows are never
 * touched again. Failures fall through and stay NULL — re-run picks
 * them up.
 *
 * Cost guard: hard cap of 500 messages/run. Itzik runs the endpoint
 * a few times to clear the backlog, then it's only new messages.
 */

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { classifyMessage } from "@/lib/ai/classify-message";

interface Summary {
  ok:           boolean;
  classified:   number;
  failed:       number;
  remaining:    number;  // approximate count still NULL after this run
  errors:       string[];
}

const MAX_PER_RUN = 500;
const BATCH_SIZE  = 50;

async function isAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (profile as { role: string } | null)?.role === "admin";
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, classified: 0, failed: 0, remaining: -1, errors: ["unauthorized"] },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, classified: 0, failed: 0, remaining: -1, errors: ["service_role_unavailable"] },
      { status: 503 },
    );
  }

  // Optional ?limit param to throttle a single run for testing.
  const url = new URL(req.url);
  const limit = Math.min(
    MAX_PER_RUN,
    Math.max(1, parseInt(url.searchParams.get("limit") || String(MAX_PER_RUN), 10)),
  );

  const errors: string[] = [];
  let classified = 0;
  let failed = 0;

  // ─── 1. Pull candidate rows from both tables ─────────────────
  // We pull UP TO `limit` total split between the two tables.
  // Newest first so the dashboard becomes useful first.
  const halfLimit = Math.ceil(limit / 2);
  const [{ data: jmRows }, { data: ccRows }] = await Promise.all([
    admin
      .from("journey_messages")
      .select("id, body")
      .eq("author_kind", "user")
      .is("sentiment", null)
      .order("created_at", { ascending: false })
      .limit(halfLimit),
    admin
      .from("journey_couple_channel_messages")
      .select("id, body")
      .eq("author_kind", "partner")
      .is("sentiment", null)
      .order("created_at", { ascending: false })
      .limit(halfLimit),
  ]);

  type Candidate = {
    id:     string;
    body:   string;
    table:  "journey_messages" | "journey_couple_channel_messages";
  };
  const candidates: Candidate[] = [
    ...((jmRows ?? []) as Array<{ id: string; body: string }>).map(
      (r): Candidate => ({ ...r, table: "journey_messages" }),
    ),
    ...((ccRows ?? []) as Array<{ id: string; body: string }>).map(
      (r): Candidate => ({ ...r, table: "journey_couple_channel_messages" }),
    ),
  ].slice(0, limit);

  // ─── 2. Classify in batches (serial) ─────────────────────────
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    // Within a batch, run in parallel — small fan-out helps throughput.
    const results = await Promise.all(
      batch.map(async (c) => {
        try {
          const result = await classifyMessage(c.body);
          if (!result) return { id: c.id, table: c.table, ok: false };
          const { error } = await admin
            .from(c.table)
            .update({
              sentiment: result.sentiment,
              auto_tags: result.auto_tags,
            })
            .eq("id", c.id);
          if (error) {
            errors.push(`${c.table}/${c.id}: ${error.message}`);
            return { id: c.id, table: c.table, ok: false };
          }
          return { id: c.id, table: c.table, ok: true };
        } catch (e) {
          errors.push(
            `${c.table}/${c.id}: ${e instanceof Error ? e.message : "?"}`,
          );
          return { id: c.id, table: c.table, ok: false };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) classified++;
      else failed++;
    }
  }

  // ─── 3. Approximate remaining (post-run NULL count) ──────────
  const [{ count: jmRemain }, { count: ccRemain }] = await Promise.all([
    admin
      .from("journey_messages")
      .select("id", { head: true, count: "exact" })
      .eq("author_kind", "user")
      .is("sentiment", null),
    admin
      .from("journey_couple_channel_messages")
      .select("id", { head: true, count: "exact" })
      .eq("author_kind", "partner")
      .is("sentiment", null),
  ]);
  const remaining = (jmRemain ?? 0) + (ccRemain ?? 0);

  return NextResponse.json({
    ok: errors.length === 0,
    classified,
    failed,
    remaining,
    errors,
  });
}

export async function POST(req: Request) { return handle(req); }
// GET allowed for convenience (admin can hit it from a browser tab).
export async function GET(req: Request)  { return handle(req); }
