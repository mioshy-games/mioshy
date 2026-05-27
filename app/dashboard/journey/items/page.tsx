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
import { ArrowLeft, Plus, UsersRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemQuickRow } from "@/components/dashboard/journey/ItemQuickRow";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SectionHelp } from "@/components/dashboard/SectionHelp";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { JourneyDataTools } from "@/components/dashboard/journey/DataTools";

export const dynamic = "force-dynamic";

// Bump when shipping a visible UI change to /dashboard/journey/items so
// we can verify in the browser DOM (data-page-build attr) and server
// logs whether the deploy actually picked up the new code.
const PAGE_BUILD = "v4-2026-05-27-compact+rtl";

export default async function ItemsListPage({
  searchParams,
}: {
  searchParams: { category?: string; subtopic?: string };
}) {
  await requireAdmin();
  const locale = getAdminLocale();
  console.log(`[ItemsListPage ${PAGE_BUILD}] render`, { searchParams });

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
    <div className="mx-auto max-w-6xl space-y-6" data-page-build={PAGE_BUILD}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
            {t(locale, "btn.back")}
          </Link>
          <span className="mt-2 inline-flex items-center gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">{t(locale, "journey.items.title")}</h1>
            <span
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300"
              title="Build marker — proves the new ItemQuickRow code is being served. Remove once verified."
            >
              {PAGE_BUILD}
            </span>
            <SectionHelp
              title="פריטי המסע — הקטלוג"
              body={
                <>
                  <p>
                    כל 250 השיעורים בקטלוג. כל פריט שייך לקטגוריה אחת ונושא
                    אופסט unlock ברירת־מחדל. <strong>עריכות מתעדכנות
                    אוטומטית בכל שורת scheduled שיש בפרודקשן</strong> — אין
                    צורך לעדכן ידנית.
                  </p>
                  <p>
                    <strong>חלוקה:</strong> 4 שלבים (יסודות / העמקה /
                    אינטגרציה / הבשלה) × 5 קטגוריות = 50 / 75 / 75 / 50.
                    <br />
                    <strong>מקורות:</strong> 130 חוקרים שונים — Gottman,
                    Chapman, Sue Johnson, Esther Perel, Brené Brown ועוד.
                  </p>
                  <p>
                    <strong>פילטרים:</strong> לפי קטגוריה / תת־נושא. לחיצה
                    על שורה → עורך השיעור עם 9 בלוקים מובנים.
                  </p>
                  <p>
                    <strong>+ פריט חדש:</strong> מוסיף פריט לקטלוג שייהיה
                    זמין כהמלצה לכל הזוגות. לתוכן ad-hoc לזוג בודד — V2
                    (override mechanic).
                  </p>
                </>
              }
              aiNote={
                <p>
                  ה-AI לא נוגע בעריכה. אבל פידבק שלילי על פריט מצטבר:
                  פריט עם 3+ &quot;לא בשבילנו&quot; / &quot;החמיר&quot;
                  ייסתר אוטומטית מ-Smart Suggestions עד שתבדקו אותו ידנית.
                </p>
              }
            />
          </span>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {t(locale, "journey.items.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 1: Export-only on the items page (Import lives on the
              hub until Phase 2 modernizes the import flow). */}
          <JourneyDataTools scope="items" />
          <Link
            href="/dashboard/journey/items/new"
            className={cn(buttonVariants({ variant: "default" }), "inline-flex gap-1.5")}
          >
            <Plus className="size-4" /> {t(locale, "journey.hub.new_item")}
          </Link>
        </div>
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

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44%]">פריט</TableHead>
              <TableHead className="w-[22%]">קטגוריה</TableHead>
              <TableHead className="w-[14%]">סטטוס</TableHead>
              <TableHead
                className="w-[10%] font-mono text-[10px] uppercase tracking-wide"
                title="Q queued · D delivered · C completed % · S skipped %"
              >
                Q/D/C/S
              </TableHead>
              <TableHead className="w-[10%] text-end">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  cat?.program_id ? programNameById.get(cat.program_id) ?? null : null;
                return (
                  <ItemQuickRow
                    key={it.id}
                    item={it}
                    category={
                      cat
                        ? {
                            id: cat.id,
                            name_he: cat.name_he,
                            program_id: cat.program_id ?? null,
                          }
                        : undefined
                    }
                    programLabel={programLabel}
                    stats={liveStatsByItem.get(it.id)}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
