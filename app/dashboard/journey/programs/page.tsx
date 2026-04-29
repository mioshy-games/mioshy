import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { adminListPrograms } from "@/lib/journey-content/queries";
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
import { RowActions } from "@/components/dashboard/journey/RowActions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProgramsListPage() {
  await requireAdmin();
  const programs = await adminListPrograms();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Journey overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Reusable roadmaps made of categories and items. Admin bulk-assigns
            a program to an owner and each item materializes on a schedule.
          </p>
        </div>
        <Link
          href="/dashboard/journey/programs/new"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
        >
          <Plus className="size-4" /> New program
        </Link>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Anchor</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center"
                >
                  No programs yet — click &quot;New program&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/programs/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name_he}
                    </Link>
                    {p.name_en ? (
                      <div className="text-muted-foreground text-xs">
                        {p.name_en}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {p.slug}
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {p.default_anchor}
                  </TableCell>
                  <TableCell className="text-sm">{p.sort_weight}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      kind="program"
                      id={p.id}
                      editHref={`/dashboard/journey/programs/${p.id}`}
                    />
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
