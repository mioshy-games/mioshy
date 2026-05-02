import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListAssignments,
  adminListPrograms,
  adminListCategoriesWithItemCounts,
} from "@/lib/journey-content/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AssignmentsListPage() {
  await requireAdmin();

  const [assignments, programs, categories] = await Promise.all([
    adminListAssignments({ limit: 200 }),
    adminListPrograms(),
    adminListCategoriesWithItemCounts(),
  ]);

  const programById = new Map(programs.map((p) => [p.id, p.name_he] as const));
  const categoryById = new Map(
    categories.map((c) => [c.id, c.name_he] as const),
  );

  function sourceLabel(kind: string, id: string): string {
    if (kind === "program") return programById.get(id) ?? "program ·" + id.slice(0, 6);
    if (kind === "category") return categoryById.get(id) ?? "category · " + id.slice(0, 6);
    return "item · " + id.slice(0, 8);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Journey
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Timelines currently materialized for users and couples. Each row
            = one active assignment.
          </p>
        </div>
        <Link href="/dashboard/journey/assignments/new">
          <Button>
            <Plus className="me-1.5 size-4" />
            New assignment
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Anchor</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  No assignments yet. Create one to start a client&apos;s content timeline.
                </TableCell>
              </TableRow>
            ) : null}
            {assignments.map((a) => {
              const ownerKey = a.couple_id
                ? `couple:${a.couple_id}`
                : a.user_id
                  ? `user:${a.user_id}`
                  : null;
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    {ownerKey ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.source_kind}</Badge>
                      <span>{sourceLabel(a.source_kind, a.source_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground me-2 text-xs uppercase">
                      {a.anchor_kind}
                    </span>
                    {fmtDate(a.anchor_date)}
                  </TableCell>
                  <TableCell className="text-xs">{a.origin}</TableCell>
                  <TableCell>
                    {a.is_active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Cancelled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs">
                    <Link
                      href={`/dashboard/journey/assignments/${a.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {fmtDate(a.created_at)}
                    </Link>
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
