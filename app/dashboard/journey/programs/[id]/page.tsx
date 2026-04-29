import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getProgramById,
  listCategories,
} from "@/lib/journey-content/queries";
import { ProgramForm } from "@/components/dashboard/journey/ProgramForm";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FolderTree, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowActions } from "@/components/dashboard/journey/RowActions";
import { createAdminClient } from "@/lib/supabase-admin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JourneyProgramFormValues } from "@/lib/journey-content/validations";

export const dynamic = "force-dynamic";

export default async function EditProgramPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const program = await getProgramById(params.id);
  if (!program) notFound();

  const categories = await listCategories({ programId: program.id });

  // Item counts per category (for the child table)
  const admin = await createAdminClient();
  const { data: itemRows } = await admin
    .from("journey_items")
    .select("category_id")
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  const itemCounts = new Map<string, number>();
  for (const r of (itemRows ?? []) as Array<{ category_id: string }>) {
    itemCounts.set(r.category_id, (itemCounts.get(r.category_id) ?? 0) + 1);
  }

  const defaults: JourneyProgramFormValues = {
    slug: program.slug,
    name_he: program.name_he,
    name_en: program.name_en ?? "",
    description_he: program.description_he ?? "",
    description_en: program.description_en ?? "",
    cover_image_url: program.cover_image_url ?? "",
    default_anchor: program.default_anchor,
    product_slug: program.product_slug ?? "",
    is_active: program.is_active,
    sort_weight: program.sort_weight,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/dashboard/journey/programs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to programs
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {program.name_he}
        </h1>
      </div>

      <ProgramForm programId={program.id} defaultValues={defaults} />

      {/* Categories inside this program */}
      <section className="bg-card rounded-lg border">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FolderTree className="size-4" />
            <h2 className="font-semibold">Categories in this program</h2>
          </div>
          <Link
            href={`/dashboard/journey/categories/new?program=${program.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex gap-1.5",
            )}
          >
            <Plus className="size-3.5" /> New category
          </Link>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
                  colSpan={6}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  No categories yet. Add one to start building content.
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
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {c.slug}
                  </TableCell>
                  <TableCell className="text-sm">
                    {itemCounts.get(c.id) ?? 0}
                  </TableCell>
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
      </section>
    </div>
  );
}
