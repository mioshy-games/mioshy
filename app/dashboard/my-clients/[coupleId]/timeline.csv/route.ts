/**
 * GET /dashboard/my-clients/[coupleId]/timeline.csv
 *
 * Downloads a CSV of every materialized scheduled item for one couple.
 * Each row is editable (unlock_at, audience, sort_order, admin_notes,
 * is_active) and re-uploadable via POST /timeline-import. The expert can
 * use this for hand-crafted, per-couple custom schedules without ever
 * touching SQL.
 *
 * Columns:
 *   scheduled_id     - UUID of the journey_scheduled_items row (REQUIRED for updates)
 *   item_id          - read-only reference to the catalog item
 *   item_title       - read-only (sanity check for the expert)
 *   audience         - both | owner | partner
 *   unlock_at        - ISO date the item becomes available
 *   sort_order       - display order within an assignment
 *   has_unlock_override - true if expert previously moved this row
 *   admin_notes      - free text the expert sees in the dashboard
 *   is_completed     - read-only, derived from journey_item_completions
 */

import { requireExpert } from "@/lib/auth/expert";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { csvEscape } from "@/lib/csv-escape";

export const dynamic = "force-dynamic";

const COLS = [
  "scheduled_id",
  "item_id",
  "item_title",
  "audience",
  "unlock_at",
  "sort_order",
  "has_unlock_override",
  "admin_notes",
  "is_completed",
] as const;


export async function GET(
  _req: Request,
  { params }: { params: { coupleId: string } },
): Promise<Response> {
  const session = await requireExpert();
  const admin = createServiceRoleClient();
  if (!admin) return new Response("service role unavailable", { status: 500 });

  // Auth: experts must be linked to this couple; admins always pass.
  if (!session.isAdmin) {
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("expert_id", session.user.id)
      .eq("couple_id", params.coupleId)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return new Response("not authorized", { status: 403 });
  }

  // Pull all assignments for this couple (active OR cancelled - the expert
  // probably wants the full picture even if they're about to re-activate).
  const { data: assignRows, error: aErr } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", params.coupleId);
  if (aErr) return new Response(aErr.message, { status: 500 });
  const assignmentIds = ((assignRows ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );

  if (assignmentIds.length === 0) {
    const empty = COLS.join(",") + "\n";
    return new Response(empty, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="couple-${params.coupleId.slice(0, 8)}-timeline.csv"`,
      },
    });
  }

  // Scheduled items + items + completions
  const { data: schedRows } = await admin
    .from("journey_scheduled_items")
    .select(
      "id, item_id, audience, unlock_at, sort_order, has_unlock_override, admin_notes",
    )
    .in("assignment_id", assignmentIds)
    .order("unlock_at", { ascending: true });

  const itemIds = Array.from(
    new Set(((schedRows ?? []) as Array<{ item_id: string }>).map((r) => r.item_id)),
  );
  const titleMap = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await admin
      .from("journey_items")
      .select("id, title_he, title_en")
      .in("id", itemIds);
    for (const i of (items ?? []) as Array<{
      id: string;
      title_he: string;
      title_en: string | null;
    }>) {
      titleMap.set(i.id, i.title_he || i.title_en || i.id);
    }
  }

  const scheduledIds = ((schedRows ?? []) as Array<{ id: string }>).map(
    (r) => r.id,
  );
  let completedSet = new Set<string>();
  if (scheduledIds.length > 0) {
    const { data: doneRows } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", scheduledIds);
    completedSet = new Set(
      ((doneRows ?? []) as Array<{ scheduled_item_id: string }>).map(
        (r) => r.scheduled_item_id,
      ),
    );
  }

  const lines: string[] = [COLS.join(",")];
  for (const r of (schedRows ?? []) as Array<{
    id: string;
    item_id: string;
    audience: string;
    unlock_at: string;
    sort_order: number;
    has_unlock_override: boolean;
    admin_notes: string | null;
  }>) {
    lines.push(
      [
        r.id,
        r.item_id,
        titleMap.get(r.item_id) ?? "",
        r.audience,
        r.unlock_at,
        r.sort_order,
        r.has_unlock_override,
        r.admin_notes ?? "",
        completedSet.has(r.id),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="couple-${params.coupleId.slice(0, 8)}-timeline.csv"`,
      "cache-control": "no-store",
    },
  });
}
