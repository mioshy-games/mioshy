import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAndRedirectNewItem } from "@/app/dashboard/actions/journey-content";
import {
  adminListCategoriesWithItemCounts,
  adminListPrograms,
} from "@/lib/journey-content/queries";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewJourneyItemPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  await requireAdmin();

  // If the admin passed a category, just create + redirect.
  if (searchParams.category) {
    await createAndRedirectNewItem(searchParams.category);
    return null;
  }

  // Otherwise show a tiny picker - item requires a category, so we block
  // the redirect path until the admin picks one.
  const [categories, programs] = await Promise.all([
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
  ]);
  const programNameById = new Map(programs.map((p) => [p.id, p.name_he] as const));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/items"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to items
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">New item</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a category - every item must belong to one.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-6 text-sm">
          <p className="mb-3">No categories exist yet.</p>
          <Link
            href="/dashboard/journey/categories/new"
            className="text-primary hover:underline"
          >
            Create a category first →
          </Link>
        </div>
      ) : (
        <ul className="divide-border bg-card divide-y rounded-lg border">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/journey/items/new?category=${c.id}`}
                className="hover:bg-muted/50 flex items-center justify-between p-4 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium">{c.name_he}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {c.program_id
                      ? programNameById.get(c.program_id) ?? "Program"
                      : "Standalone"}
                    {" · "}
                    {c.slug}
                  </div>
                </div>
                <div className="text-muted-foreground text-xs">
                  {c.item_count} items
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
