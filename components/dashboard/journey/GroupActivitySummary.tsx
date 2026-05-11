// ============================================================
// GroupActivitySummary - slice 9 read-only summary panel for a
// single group. Surfaces per-member completion + skip stats and
// per-binding "delivered to N members" counts. Sits ABOVE the
// editable GroupMemberPicker / GroupSubtopicBinder so admins see
// the picture before they start tweaking.
// ============================================================

import { CheckCircle2, AlarmClockOff, Users, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  GroupMemberStats,
} from "@/lib/journey-content/group-stats";
import type {
  GroupMemberRow,
  GroupSubtopicBindingRow,
} from "@/lib/journey-content/queries";

export function GroupActivitySummary({
  members,
  bindings,
  memberStats,
  bindingDeliveryCounts,
}: {
  members: GroupMemberRow[];
  bindings: GroupSubtopicBindingRow[];
  memberStats: Map<string, GroupMemberStats>;
  bindingDeliveryCounts: Map<string, number>;
}) {
  if (members.length === 0 && bindings.length === 0) return null;

  return (
    <section className="bg-card rounded-lg border">
      <header className="border-b border-border p-4">
        <h2 className="font-semibold">Activity summary</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Read-only. Per-member delivery stats and per-binding reach.
        </p>
      </header>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {/* Members */}
        <div>
          <div className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <Users className="size-3" aria-hidden />
            Members ({members.length})
          </div>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">
              No members yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-end" title="Distinct items delivered">
                    Delivered
                  </TableHead>
                  <TableHead className="text-end" title="Items completed by user">
                    <CheckCircle2 className="ms-auto size-3 text-emerald-500" aria-label="Completed" />
                  </TableHead>
                  <TableHead className="text-end" title="Items auto-skipped by cadence engine">
                    <AlarmClockOff className="ms-auto size-3 text-rose-500" aria-label="Skipped" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const s = memberStats.get(m.user_id) ?? {
                    delivered: 0,
                    completed: 0,
                    skipped: 0,
                  };
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {m.full_name || m.email || `${m.user_id.slice(0, 8)}…`}
                        </div>
                        {m.full_name && m.email ? (
                          <div className="text-muted-foreground text-xs">
                            {m.email}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {s.delivered}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {s.completed}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {s.skipped > 0 ? (
                          <span className="text-rose-500 font-semibold">
                            {s.skipped}
                          </span>
                        ) : (
                          0
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Bindings */}
        <div>
          <div className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <Send className="size-3" aria-hidden />
            Bindings ({bindings.length})
          </div>
          {bindings.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">
              No subtopic bindings yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subtopic</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-end" title="Distinct members who got any item from this subtopic">
                    Delivered to
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bindings.map((b) => {
                  const reach = bindingDeliveryCounts.get(b.subtopic_id) ?? 0;
                  return (
                    <TableRow key={b.subtopic_id}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {b.subtopic_name_he}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {b.category_name_he}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={b.mode === "replace" ? "destructive" : "secondary"}
                          className="text-[10px] uppercase"
                        >
                          {b.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {reach} / {members.length}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}
