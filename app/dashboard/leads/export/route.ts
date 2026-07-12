/**
 * GET /dashboard/leads/export
 *
 * Admin-only CSV export of the Leads view (signed-up, not-converted) for manual
 * WhatsApp / email outreach. Sources the SAME profiles-based set as the Leads
 * page (lib/dashboard/leads), not the near-empty `leads` table.
 *
 * Query params:
 *   ?source=marathon-7day  → only signups from the last 7 days.
 *   ?consented=1           → outreach mode: only marketing-consented users
 *                            (compliance). Omit for the internal export, which
 *                            includes everyone plus a marketing_consent column.
 *
 * Columns always include phone + marketing_consent (required for outreach).
 * Test accounts are always excluded. A UTF-8 BOM is prepended so Excel opens
 * Hebrew names correctly.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { loadLeads } from "@/lib/dashboard/leads";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  await requireAdmin();

  const sp = new URL(req.url).searchParams;
  const source = sp.get("source");
  const consentedOnly = sp.get("consented") === "1" || sp.get("consented") === "true";
  const sinceDays = source === "marathon-7day" ? 7 : null;

  const { rows, degraded } = await loadLeads({
    status: "not", // leads = not converted
    sinceDays,
    consentedOnly,
  });
  if (degraded) {
    return new Response("Failed to export: service role unavailable", { status: 500 });
  }

  const header = [
    "name",
    "phone",
    "email",
    "language",
    "marketing_consent",
    "marketing_consent_at",
    "terms_accepted",
    "assessment_done",
    "created_at",
  ];

  const body = rows.map((r) =>
    [
      r.fullName ?? "",
      r.phone ?? "",
      r.email ?? "",
      r.language ?? "",
      String(r.marketingConsent),
      r.marketingConsentAt ?? "",
      String(r.termsAccepted),
      String(r.assessmentDone),
      r.createdAt,
    ].map(csvEscape),
  );

  const csv = [header.map(csvEscape).join(","), ...body.map((r) => r.join(","))].join("\n");
  // BOM so Excel detects UTF-8 and renders Hebrew names correctly.
  const withBom = "﻿" + csv;

  const parts = ["leads"];
  if (source) parts.push(source);
  if (consentedOnly) parts.push("consented");
  const filename = `${parts.join("_")}_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(withBom, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
