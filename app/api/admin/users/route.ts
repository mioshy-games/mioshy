/**
 * GET /api/admin/users
 *
 * Returns the admin overview list using `admin_users_overview` view created
 * in migration 026. Supports `q=` (email substring), `plan=`, `status=`,
 * `horsemen=1`, `limit=`, `offset=`.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // admin_users_overview is service-role-only as of migration 199 — it joins
  // auth.users and bypasses RLS, so it must never be readable by the
  // `authenticated` role. getAdminSession() above is the authorisation gate.
  // Audit 2026-08-05, CRITICAL #2.
  const supabase = await createAdminClient();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const plan = url.searchParams.get("plan");
  const status = url.searchParams.get("status");
  const horsemen = url.searchParams.get("horsemen") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  let query = supabase
    .from("admin_users_overview")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (q) query = query.ilike("email", `%${q}%`);
  if (plan) query = query.eq("plan", plan);
  if (status) query = query.eq("subscription_status", status);
  if (horsemen) query = query.eq("four_horsemen_flag", true);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [], count: count ?? data?.length ?? 0 });
}
