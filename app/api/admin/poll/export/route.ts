/**
 * GET /api/admin/poll/export
 * Admin-only. Downloads ALL poll questions as CSV in the exact import format
 * (columns: text,option_a,option_b,order_index,domain,insight_line) so an
 * admin can download → edit → re-import.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";

const COLUMNS = [
  "text",
  "option_a",
  "option_b",
  "order_index",
  "domain",
  "insight_line",
] as const;

/** RFC4180 field: quote when it contains a comma/quote/newline; double inner quotes. */
function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("poll_questions")
    .select(COLUMNS.join(", "))
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = [COLUMNS.join(",")];
  for (const q of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    rows.push(COLUMNS.map((c) => csvField(q[c])).join(","));
  }
  // BOM so Excel opens the Hebrew as UTF-8; CRLF line endings per RFC4180.
  const csv = "﻿" + rows.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="poll-questions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
