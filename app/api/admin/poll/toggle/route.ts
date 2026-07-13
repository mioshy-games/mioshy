/**
 * POST /api/admin/poll/toggle   body: { questionId: string, isActive: boolean }
 * Admin-only. Activates / deactivates a question (§9 is_active).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const isActive = body?.isActive === true;
  if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const admin = await createAdminClient();
  const { error } = await admin.from("poll_questions").update({ is_active: isActive }).eq("id", questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
