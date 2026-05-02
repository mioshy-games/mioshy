import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListGroups,
  countActiveMembersThisWeek,
} from "@/lib/journey-content/queries";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GroupsListPage() {
  await requireAdmin();
  const groups = await adminListGroups();

  // Resolve "active in cadence: N this week" stat per group. Sequential
  // is fine — ≤ a few dozen groups in practice and each query is cheap.
  const activeThisWeek = new Map<string, number>();
  for (const g of groups) {
    activeThisWeek.set(g.id, await countActiveMembersThisWeek(g.id));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Journey overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Groups</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Cohorts of users bound to specific subtopics. The cadence engine
            respects each binding's mode — <strong>replace</strong> hides the
            subtopic from members' auto-cadence, <strong>interleave</strong>{" "}
            lets cadence pick from it normally while leaving room for admin
            pushes.
          </p>
        </div>
        <Link
          href="/dashboard/journey/groups/new"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
        >
          <Plus className="size-4" /> New group
        </Link>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-end">Members</TableHead>
              <TableHead className="text-end">Subtopic bindings</TableHead>
              <TableHead className="text-end">Active this week</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  No groups yet — click "New group" to create the first cohort.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/groups/${g.id}`}
                      className="font-medium hover:underline"
                    >
                      {g.label_he}
                    </Link>
                    {g.label_en ? (
                      <div className="text-muted-foreground text-xs">
                        {g.label_en}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {g.slug}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {g.member_count}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {g.binding_count}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {activeThisWeek.get(g.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={g.is_active ? "default" : "secondary"}>
                      {g.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
