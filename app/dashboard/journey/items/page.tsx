import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  countGroupBindingsForSubtopics,
  listItems,
  listSubtopics,
  adminListCategoriesWithItemCounts,
  adminListPrograms,
} from "@/lib/journey-content/queries";
import { getItemLiveStatsBatch } from "@/lib/journey-content/observability";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, UsersRound } from "lucide-react";
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
  searchParams: { category?: string; subtopic?: string };
}) {
  await requireAdmin();

  // Subtopic filter sentinels:
  //   ?subtopic=<uuid>    → only items in that subtopic
  //   ?subtopic=__none__  → only direct-on-category items
  //   omitted             → no subtopic filter
  const subtopicFilterRaw = searchParams.subtopic ?? "";
  const subtopicIdFilter: string | null | undefined =
    subtopicFilterRaw === ""
      ? undefined
      : subtopicFilterRaw === "__none__"
        ? null
        : subtopicFilterRaw;

  const [items, categories, programs, subtopicsForCategory] = await Promise.all([
    listItems({
      categoryId: searchParams.category,
      subtopicId: subtopicIdFilter,
    }),
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
    // Only show the subtopic filter strip when the admin has narrowed
    // to one category - otherwise it'd be a wall of pills.
    searchParams.category
      ? listSubtopics({ categoryId: searchParams.category })
      : Promise.resolve([]),
  ]);
  const programNameById = new Map(programs.map((p) => [p.id, p.name_he] as const));
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  // v3 slice 7 - group-binding counts per visible subtopic. Surfaces
  // a "bound to N group(s)" hint on each pill so admins see why
  // cadence might behave differently for some users.
  const subtopicGroupCounts = await countGroupBindingsForSubtopics(
    subtopicsForCategory.map((s) => s.id),
  );

  // v3 slice 9 - live stats per visible item, in one round-trip. The
  // compact pill format is "Q5 / D120 / 78%C / 4%S" per Itzik's brief.
  const liveStatsByItem = await getItemLiveStatsBatch(items.map((i) => i.id));

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

      {/* Subtopic sub-filter - only when a category is selected. */}
      {searchParams.category && subtopicsForCategory.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground self-center">Subtopic:</span>
          <Link
            href={`/dashboard/journey/items?category=${searchParams.category}`}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              !subtopicFilterRaw
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted",
            )}
          >
            All
          </Link>
          <Link
            href={`/dashboard/journey/items?category=${searchParams.category}&subtopic=__none__`}
            className={cn(
              "rounded-full border px-3 py-1 transition-colors",
              subtopicFilterRaw === "__none__"
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted",
            )}
          >
            Direct (no subtopic)
          </Link>
          {subtopicsForCategory.map((s) => {
            const groupCount = subtopicGroupCounts.get(s.id) ?? 0;
            return (
              <Link
                key={s.id}
                href={`/dashboard/journey/items?category=${searchParams.category}&subtopic=${s.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
                  subtopicFilterRaw === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
                title={
                  groupCount > 0
                    ? `Bound to ${groupCount} group${groupCount === 1 ? "" : "s"} - cadence behaves differently for those members.`
                    : undefined
                }
              >
                <span>{s.name_he}</span>
                {groupCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] tabular-nums",
                      subtopicFilterRaw === s.id
                        ? "bg-primary-foreground/15"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                    aria-label={`bound to ${groupCount} group${groupCount === 1 ? "" : "s"}`}
                  >
                    <UsersRound className="size-2.5" aria-hidden />
                    {groupCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
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
              <TableHead className="font-mono text-[10px] uppercase tracking-wide" title="Q queued · D delivered · C completed % · S skipped %">
                Q/D/C/S
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-24 text-center"
                >
                  {subtopicFilterRaw === "__none__"
                    ? "No items hang directly off this category yet - every item is in a subtopic."
                    : subtopicFilterRaw
                      ? "No items in this subtopic yet."
                      : searchParams.category
                        ? "No items in this category yet."
                        : "No items yet - click \"New item\" to add one."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => {
                const cat = categoryById.get(it.category_id);
                const programLabel =
                  cat?.program_id ? programNameById.get(cat.program_id) : null;
                const stats = liveStatsByItem.get(it.id);
                const completionRate =
                  stats && stats.delivered > 0
                    ? Math.round((stats.completed / stats.delivered) * 100)
                    : null;
                const skipRate =
                  stats && stats.delivered > 0
                    ? Math.round((stats.skipped / stats.delivered) * 100)
                    : null;
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
                        "-"
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
                    <TableCell className="text-muted-foreground font-mono text-[11px] tabular-nums">
                      {stats ? (
                        <span title={`Queued ${stats.queued} · Delivered ${stats.delivered} · Completed ${stats.completed} (${completionRate ?? 0}%) · Skipped ${stats.skipped} (${skipRate ?? 0}%)`}>
                          Q{stats.queued}/D{stats.delivered}/
                          {completionRate !== null ? `${completionRate}%C` : "-C"}
                          /
                          {skipRate !== null ? `${skipRate}%S` : "-S"}
                        </span>
                      ) : (
                        "-"
                      )}
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
