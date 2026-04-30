import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listCategories } from "@/lib/between-us/queries";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryActions } from "@/components/dashboard/between-us/CategoryActions";
import { NewTaxonomyButton } from "@/components/dashboard/between-us/NewTaxonomyButton";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CategoriesListPage() {
  await requireAdmin();
  const categories = await listCategories(false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/adults"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Used to group games for filtering on the public site. A game can
            belong to multiple categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/adults/tags"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Tags →
          </Link>
          <NewTaxonomyButton kind="category" />
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
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
                  className="text-muted-foreground h-24 text-center"
                >
                  No categories yet - click &quot;New category&quot; to add
                  one.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <ColorDot hex={c.color_hex} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.name_he}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.name_en}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {c.slug}
                  </TableCell>
                  <TableCell className="text-sm">{c.sort_weight}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CategoryActions categoryId={c.id} />
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

function ColorDot({ hex }: { hex: string | null }) {
  return (
    <div
      className="border-border size-4 rounded-full border"
      style={{ background: hex ?? "transparent" }}
    />
  );
}
