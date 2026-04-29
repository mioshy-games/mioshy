import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListPrograms,
  getCategoryById,
  listItems,
} from "@/lib/journey-content/queries";
import { CategoryForm } from "@/components/dashboard/journey/CategoryForm";
import { RowActions } from "@/components/dashboard/journey/RowActions";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Plus } from "lucide-react";
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
import type { JourneyCategoryFormValues } from "@/lib/journey-content/validations";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const category = await getCategoryById(params.id);
  if (!category) notFound();

  const [programs, items] = await Promise.all([
    adminListPrograms(),
    listItems({ categoryId: category.id }),
  ]);

  const defaults: JourneyCategoryFormValues = {
    program_id: category.program_id,
    slug: category.slug,
    name_he: category.name_he,
    name_en: category.name_en ?? "",
    description_he: category.description_he ?? "",
    description_en: category.description_en ?? "",
    sort_order: category.sort_order,
    is_active: category.is_active,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/dashboard/journey/categories"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to categories
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {category.name_he}
        </h1>
      </div>

      <CategoryForm
        categoryId={category.id}
        defaultValues={defaults}
        programs={programs.map((p) => ({
          id: p.id,
          name_he: p.name_he,
          name_en: p.name_en,
        }))}
      />

      {/* Items inside this category */}
      <section className="bg-card rounded-lg border">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4" />
            <h2 className="font-semibold">Items in this category</h2>
          </div>
          <Link
            href={`/dashboard/journey/items/new?category=${category.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex gap-1.5",
            )}
          >
            <Plus className="size-3.5" /> New item
          </Link>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Offset</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  No items yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/items/${it.id}`}
                      className="font-medium hover:underline"
                    >
                      {it.title_he}
                    </Link>
                    {it.title_en ? (
                      <div className="text-muted-foreground text-xs">
                        {it.title_en}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {it.slug}
                  </TableCell>
                  <TableCell className="text-sm">
                    +{it.default_offset_days}d
                  </TableCell>
                  <TableCell className="text-sm">{it.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={it.is_active ? "default" : "secondary"}>
                      {it.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      kind="item"
                      id={it.id}
                      editHref={`/dashboard/journey/items/${it.id}`}
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
