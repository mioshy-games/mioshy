/**
 * POST /api/admin/poll/import   body: { csv: string }
 * Admin-only. Imports poll questions from CSV (§9). Dedup by text.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { importQuestionsFromCsv } from "@/lib/poll/csv";

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "csv required" }, { status: 400 });
  const result = await importQuestionsFromCsv(csv);
  return NextResponse.json(result);
}
