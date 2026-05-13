"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CMS_PAGES, type CmsPage, type CmsTextRow } from "@/lib/cms/types";
import { CmsTextRow as CmsTextRowEditor } from "./CmsTextRow";

const PAGE_LABELS: Record<CmsPage, string> = {
  homepage: "Homepage",
  journey: "Journey",
  games: "Games",
  "mioshy-sex": "Mioshy Sex",
  my: "My / Account",
  shared: "Shared",
};

// Sprint-2 MVP — only the homepage tab is enabled. The rest light up
// when their components are migrated to useCmsText (planned for
// Sprints 4–5 after Itzik validates the MVP on Homepage).
const ENABLED_PAGES = new Set<CmsPage>(["homepage"]);

/**
 * CmsContentEditor — top-level admin UI for editing CMS texts.
 *
 * Rendering pipeline:
 *   1. Server (app/admin/content/page.tsx) loaded EVERY row from
 *      cms_texts in a single query and handed them to this component.
 *   2. Here we filter to the active page tab, then group by `section`.
 *   3. Each section renders as a <details> accordion. First section
 *      open by default so the page lands with content visible.
 *   4. Each key gets a CmsTextRow (HE + EN textareas + Save button).
 *
 * State is local — there's no client-side cache or store. Each Save
 * goes straight to the server action, which UPDATEs the DB and calls
 * revalidateTag('cms-texts'). The public site picks up the change on
 * its next render.
 */
export function CmsContentEditor({ rows }: { rows: CmsTextRow[] }) {
  const [page, setPage] = useState<CmsPage>("homepage");

  // Per-page filtering + section grouping. Memoised on `rows` + `page`
  // so the only re-computation cost is when the admin switches tabs.
  const sections = useMemo(() => {
    const pageRows = rows.filter((r) => r.page === page);
    const grouped = new Map<string, CmsTextRow[]>();
    for (const row of pageRows) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    // Sort sections by name for stable presentation. Inside each
    // section, sort by key (so e.g. `homeV2.hero.tag` sits before
    // `homeV2.hero.headline` alphabetically — admin can scan).
    return Array.from(grouped.entries())
      .map(([name, list]) => ({
        name,
        rows: list.sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, page]);

  const totalKeys = rows.filter((r) => r.page === page).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link to admin dashboard. Uses next/link so client-side
          nav (no full page reload) and the dashboard's locale/auth
          state is preserved across the bounce. */}
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        חזרה ללוח אדמין
      </Link>

      {/* Header */}
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold">
          Mioshy CMS — Content Editor
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit user-facing copy on the live site. Every save publishes
          immediately — the public site reflects the change on the
          next request (cache invalidates automatically).
        </p>
      </header>

      {/* Page tabs */}
      <Tabs
        value={page}
        onValueChange={(v) => setPage(v as CmsPage)}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-6">
          {CMS_PAGES.map((p) => {
            const enabled = ENABLED_PAGES.has(p);
            return (
              <TabsTrigger
                key={p}
                value={p}
                disabled={!enabled}
                title={
                  enabled
                    ? undefined
                    : "Coming soon — components for this page haven't been migrated to the CMS yet."
                }
              >
                {PAGE_LABELS[p]}
                {!enabled ? (
                  <span className="ms-1 text-[10px] opacity-60">soon</span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Per-page summary */}
      <div className="mb-6 flex items-center gap-3 text-sm text-slate-600">
        <Badge variant="secondary">{totalKeys} keys</Badge>
        <span>·</span>
        <span>{sections.length} sections</span>
      </div>

      {/* Sections accordion */}
      <div className="space-y-3">
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No CMS rows for {PAGE_LABELS[page]} yet.
          </div>
        ) : (
          sections.map((section, i) => (
            <SectionGroup
              key={section.name}
              name={section.name}
              rows={section.rows}
              defaultOpen={i === 0}
            />
          ))
        )}
      </div>
    </main>
  );
}

/**
 * SectionGroup — collapsible card for one section under the current
 * page tab. Uses native <details>/<summary> for the accordion behaviour
 * — no client state, no JS framework needed for the toggle. shadcn's
 * Card primitives style the container.
 */
function SectionGroup({
  name,
  rows,
  defaultOpen,
}: {
  name: string;
  rows: CmsTextRow[];
  defaultOpen: boolean;
}) {
  return (
    <details
      className="group rounded-xl border border-slate-200 bg-white shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500 transition group-open:rotate-90">
            ▸
          </span>
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {rows.length}
          </Badge>
        </div>
      </summary>
      <Separator />
      <div className="space-y-4 p-5">
        {rows.map((row) => (
          <CmsTextRowEditor key={row.id} row={row} />
        ))}
      </div>
    </details>
  );
}
