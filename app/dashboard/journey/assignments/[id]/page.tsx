import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getTimelineForOwner, adminGetOwnerLabel } from "@/lib/journey-content/queries";
import { listMatchRules } from "@/lib/journey-content/match-rules";
import { AssignmentControls } from "@/components/dashboard/journey/AssignmentControls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, Clock, Lock } from "lucide-react";
import type { JourneyAssignment, ScheduledItemStatus } from "@/lib/journey-content/types";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: ScheduledItemStatus }) {
  if (status === "completed") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="size-3" />
        Completed
      </Badge>
    );
  }
  if (status === "available") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="size-3" />
        Available
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Lock className="size-3" />
      Locked
    </Badge>
  );
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service role unavailable");

  const { data: row, error } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) notFound();
  const assignment = row as JourneyAssignment;

  const ownerKey = assignment.couple_id
    ? `couple:${assignment.couple_id}`
    : `user:${assignment.user_id}`;
  const ownerLabel = await adminGetOwnerLabel(ownerKey);

  // Use a dummy viewerUserId: for admin display, we want the admin view that
  // intentionally shows all responses. Pass an impossible uuid so the
  // is_private filter hides partners' private reflections consistently.
  const ADMIN_VIEWER = "00000000-0000-0000-0000-000000000000";

  const [timeline, allRules] = await Promise.all([
    getTimelineForOwner({
      owner: assignment.couple_id
        ? { kind: "couple", coupleId: assignment.couple_id }
        : { kind: "user", userId: assignment.user_id! },
      viewerUserId: ADMIN_VIEWER,
    }).catch(() => []),
    listMatchRules(),
  ]);

  // Filter the timeline down to only this assignment.
  const rows = timeline.filter((t) => t.scheduled.assignment_id === assignment.id);

  // Build a quick map for "Why" column rendering.
  const rulesById = new Map(allRules.map((r) => [r.id, r]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/assignments"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to assignments
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {ownerLabel ?? "Unknown owner"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="uppercase">
                {assignment.source_kind}
              </Badge>
              <span className="text-muted-foreground font-mono text-xs">
                {ownerKey}
              </span>
              {assignment.is_active ? (
                <Badge>Active</Badge>
              ) : (
                <Badge variant="secondary">Cancelled</Badge>
              )}
            </div>
          </div>
          <AssignmentControls
            assignmentId={assignment.id}
            isActive={assignment.is_active}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetaCard label="Anchor" value={fmtDate(assignment.anchor_date)} sub={assignment.anchor_kind} />
        <MetaCard label="Origin" value={assignment.origin} sub={assignment.origin_ref ?? ""} />
        <MetaCard label="Created" value={fmtDate(assignment.created_at)} sub={assignment.notes ?? ""} />
      </div>

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Scheduled items</h2>
          <span className="text-muted-foreground text-xs">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Why (rule)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Unlock</TableHead>
              <TableHead className="text-right">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  No scheduled rows. Try re-materializing - the source may
                  have been empty when this assignment was created.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((t) => {
              const ruleId = t.scheduled.matched_by_rule_id ?? null;
              const rule = ruleId ? rulesById.get(ruleId) : null;
              return (
                <TableRow key={t.scheduled.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/items/${t.item.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {t.item.title_he}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.category.name_he}
                  </TableCell>
                  <TableCell>
                    {rule ? (
                      <Link
                        href={`/dashboard/journey/match-rules/${rule.id}`}
                        className="text-xs underline-offset-4 hover:underline"
                        title={rule.rationale_he}
                      >
                        {rule.label_he}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        unattributed
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtDate(t.scheduled.unlock_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.scheduled.has_unlock_override ? (
                      <Badge variant="outline">custom</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {sub ? (
        <div className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
          {sub}
        </div>
      ) : null}
    </div>
  );
}
