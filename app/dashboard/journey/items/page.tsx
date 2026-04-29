import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listItems, adminListCategoriesWithItemCounts, adminListPrograms } from "@/lib/journey-content/queries";
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

export default async function ItemsListPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  await requireAdmin();

  const [items, categories, programs] = await Promise.all([
    listItems({ categoryId: searchParams.category }),
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
  ]);
  const programNameById = new Map(programs.map((p) => [p.id, p.name_he] as const));
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            The content catalog. Each item lives in exactly one category and
            carries a default unlock offset. Edits propagate to every
            scheduled row automatically.
          </p>
        </div>
        <Link
          href="/dashboard/journey/items/new"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
        >
          <Plus className="size-4" /> New item
        </Link>
      </div>

      {/* Category filter strip */}
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/dashboard/journey/items"
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              !searchParams.category
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted",
            )}
          >
            All ({categories.reduce((a, c) => a + c.item_count, 0)})
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/journey/items?category=${c.id}`}
              className={cn(
                "rounded-full border px-3 py-1 transition-colors",
                searchParams.category === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {c.name_he} ({c.item_count})
            </Link>
          ))}
        </div>
      ) : null}

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
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
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  {searchParams.category
                    ? "No items in this category yet."
                    : "No items yet — click \"New item\" to add one."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => {
                const cat = categoryById.get(it.category_id);
                const programLabel =
                  cat?.program_id ? programNameById.get(cat.program_id) : null;
                return (
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
                    <TableCell className="text-xs">
                      {cat ? (
                        <Link
                          href={`/dashboard/journey/categories/${cat.id}`}
                          className="hover:underline"
                        >
                          {programLabel ? `${programLabel} · ` : ""}
                          {cat.name_he}
                        </Link>
                      ) : (
                        "—"
                      )}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
