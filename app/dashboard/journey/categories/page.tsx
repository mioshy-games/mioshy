import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListCategoriesWithItemCounts,
  adminListPrograms,
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
import { RowActions } from "@/components/dashboard/journey/RowActions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CategoriesListPage() {
  await requireAdmin();
  const [categories, programs] = await Promise.all([
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
  ]);

  const programNameById = new Map(
    programs.map((p) => [p.id, p.name_he] as const),
  );

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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Groups of items. Can belong to a program or stand alone. Standalone
            categories can be assigned to owners on their own.
          </p>
        </div>
        <Link
          href="/dashboard/journey/categories/new"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
        >
          <Plus className="size-4" /> New category
        </Link>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  No categories yet — click &quot;New category&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/categories/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name_he}
                    </Link>
                    {c.name_en ? (
                      <div className="text-muted-foreground text-xs">
                        {c.name_en}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.program_id ? (
                      <Link
                        href={`/dashboard/journey/programs/${c.program_id}`}
                        className="hover:underline"
                      >
                        {programNameById.get(c.program_id) ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Standalone</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {c.slug}
                  </TableCell>
                  <TableCell className="text-sm">{c.item_count}</TableCell>
                  <TableCell className="text-sm">{c.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      kind="category"
                      id={c.id}
                      editHref={`/dashboard/journey/categories/${c.id}`}
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
