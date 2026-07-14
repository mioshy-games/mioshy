/**
 * POST /api/admin/poll/reorder   body: { order: string[] }  (question ids, new order)
 * Admin-only. Sets order_index = 1..N in the given order (§9 reorder).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const order: string[] = Array.isArray(body?.order) ? body.order.filter((x: unknown) => typeof x === "string") : [];
  if (!order.length) return NextResponse.json({ error: "order required" }, { status: 400 });

  const admin = await createAdminClient();
  for (let i = 0; i < order.length; i++) {
    await admin.from("poll_questions").update({ order_index: i + 1 }).eq("id", order[i]);
  }
  return NextResponse.json({ ok: true, updated: order.length });
}
