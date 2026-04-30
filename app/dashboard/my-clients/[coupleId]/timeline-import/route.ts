/**
 * POST /dashboard/my-clients/[coupleId]/timeline-import
 *
 * Accepts a multipart upload of a CSV produced by ../timeline.csv (or
 * compatible). Updates `journey_scheduled_items` rows by `scheduled_id`:
 *
 *   audience       → both | owner | partner
 *   unlock_at      → ISO date (timestamptz)
 *   sort_order     → integer
 *   admin_notes    → text (nullable)
 *
 * Each successful unlock_at change also flips `has_unlock_override = true`
 * so future structural propagations leave the row alone.
 *
 * Rows whose `scheduled_id` doesn't belong to this couple are rejected
 * (defense in depth; experts can only see their couple's CSV anyway).
 *
 * Returns JSON: { updated, failed, errors }
 */

import { revalidatePath } from "next/cache";
import { requireExpert } from "@/lib/auth/expert";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Minimal CSV parser — handles quoted fields with embedded commas/quotes/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && r.some((c) => c.trim() !== ""));
}

function parseBool(v: string): boolean {
  return v === "1" || v.toLowerCase() === "true";
}

export async function POST(
  request: Request,
  { params }: { params: { coupleId: string } },
): Promise<Response> {
  const session = await requireExpert();
  const admin = createServiceRoleClient();
  if (!admin) return Response.json({ error: "service role unavailable" }, { status: 500 });

  // Authorization: experts must be linked.
  if (!session.isAdmin) {
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("expert_id", session.user.id)
      .eq("couple_id", params.coupleId)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return Response.json({ error: "not authorized" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart body" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing "file" field' }, { status: 400 });
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return Response.json(
      { error: "CSV is empty or has no data rows" },
      { status: 422 },
    );
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const required = ["scheduled_id"];
  const missing = required.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return Response.json(
      { error: `Missing columns: ${missing.join(", ")}` },
      { status: 422 },
    );
  }
  const idx = (col: string) => header.indexOf(col);
  const get = (row: string[], col: string) => (row[idx(col)] ?? "").trim();

  // Pre-load the set of scheduled_ids that belong to this couple — anything
  // else is rejected even if the expert is admin.
  const { data: assignRows } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", params.coupleId);
  const assignmentIds = ((assignRows ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  const allowedScheduledIds = new Set<string>();
  if (assignmentIds.length > 0) {
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .in("assignment_id", assignmentIds);
    for (const s of (schedRows ?? []) as Array<{ id: string }>) {
      allowedScheduledIds.add(s.id);
    }
  }

  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sid = get(row, "scheduled_id");
    if (!sid) {
      errors.push({ row: r + 1, message: "scheduled_id missing" });
      continue;
    }
    if (!UUID_RE.test(sid)) {
      errors.push({ row: r + 1, message: `invalid scheduled_id: ${sid}` });
      continue;
    }
    if (!allowedScheduledIds.has(sid)) {
      errors.push({
        row: r + 1,
        message: `scheduled_id does not belong to this couple: ${sid}`,
      });
      continue;
    }

    const audience = get(row, "audience").toLowerCase();
    const unlockAt = get(row, "unlock_at");
    const sortOrderRaw = get(row, "sort_order");
    const adminNotes = get(row, "admin_notes");
    const overrideRaw = get(row, "has_unlock_override");

    const patch: Record<string, unknown> = {};

    if (audience) {
      if (!["both", "owner", "partner"].includes(audience)) {
        errors.push({
          row: r + 1,
          message: `audience must be both|owner|partner (got "${audience}")`,
        });
        continue;
      }
      patch.audience = audience;
    }
    if (unlockAt) {
      const d = new Date(unlockAt);
      if (Number.isNaN(d.getTime())) {
        errors.push({ row: r + 1, message: `invalid unlock_at: ${unlockAt}` });
        continue;
      }
      patch.unlock_at = d.toISOString();
      // Edits via CSV are intentional → mark override so future propagation
      // doesn't reset them.
      if (!overrideRaw) patch.has_unlock_override = true;
    }
    if (sortOrderRaw !== "") {
      const n = parseInt(sortOrderRaw, 10);
      if (!Number.isFinite(n)) {
        errors.push({ row: r + 1, message: `invalid sort_order: ${sortOrderRaw}` });
        continue;
      }
      patch.sort_order = n;
    }
    if (overrideRaw !== "") {
      patch.has_unlock_override = parseBool(overrideRaw);
    }
    if (adminNotes !== "") {
      patch.admin_notes = adminNotes;
    }

    if (Object.keys(patch).length === 0) {
      // Row exists but expert changed nothing — skip silently.
      continue;
    }

    const { error } = await admin
      .from("journey_scheduled_items")
      .update(patch)
      .eq("id", sid);
    if (error) {
      errors.push({ row: r + 1, message: error.message });
      continue;
    }
    updated++;
  }

  if (updated > 0) {
    revalidatePath(`/dashboard/my-clients/${params.coupleId}`, "layout");
    revalidatePath(`/dashboard/my-clients`, "layout");
  }

  return Response.json({
    updated,
    failed: errors.length,
    errors,
  });
}
