/**
 * GET /dashboard/leads/export (G4)
 *
 * Admin-only CSV export of leads for manual outreach (the marathon WhatsApp
 * follow-up). Columns: name, phone, email, source, marketing_consent,
 * terms_accepted, created_at. Optional ?source= filter (e.g. marathon-7day).
 * Mirrors the existing single-CSV export pattern (questions/export).
 */

import { requireAdmin } from "@/lib/auth/admin";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const { supabase } = await requireAdmin();

  const source = new URL(req.url).searchParams.get("source");

  let query = supabase
    .from("leads")
    .select(
      "full_name, name, phone, email, source, marketing_consent, terms_accepted, created_at",
    )
    .order("created_at", { ascending: false });
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return new Response(`Failed to export: ${error.message}`, { status: 500 });
  }

  const header = [
    "name",
    "phone",
    "email",
    "source",
    "marketing_consent",
    "terms_accepted",
    "created_at",
  ];

  const rows = (data ?? []).map((l) => {
    const r = l as {
      full_name?: string | null;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
      source?: string | null;
      marketing_consent?: boolean | null;
      terms_accepted?: boolean | null;
      created_at?: string | null;
    };
    return [
      r.full_name ?? r.name ?? "",
      r.phone ?? "",
      r.email ?? "",
      r.source ?? "",
      String(r.marketing_consent ?? false),
      String(r.terms_accepted ?? false),
      r.created_at ?? "",
    ].map(csvEscape);
  });

  const csv = [header.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
  const suffix = source ? `_${source}` : "";
  const filename = `leads${suffix}_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
