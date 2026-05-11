"use client";

/**
 * Feedback list / timeline + the "new feedback" entry button.
 *
 * Two render modes:
 *   • list      - flat newest-first cards, each expandable
 *   • timeline  - same data grouped by day, with a vertical rail and
 *                 a date header. Used for couple-detail timeline view.
 *
 * The component is intentionally pure-presentational: it receives
 * the rows already hydrated (with author + subject names) from the
 * server and just renders. All write actions go through the
 * FeedbackForm dialog.
 */

import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
// Client-safe imports only - see comment in FeedbackFilterBar.tsx.
import {
  SEVERITY_LABEL_HE,
  SEVERITY_TONE,
  type FeedbackSeverity,
  type JourneyFeedbackHydrated,
} from "@/lib/journey/feedback-shared";
import { FeedbackForm } from "./FeedbackForm";
import { deleteFeedback } from "@/app/actions/journey-feedback";

interface CoupleOption {
  id: string;
  display_name: string | null;
  pair_code: string;
}
interface CategoryOption {
  id: string;
  // journey_categories uses name_he/name_en.
  name_he: string | null;
  name_en: string | null;
}

interface Props {
  rows: JourneyFeedbackHydrated[];
  view: "list" | "timeline";
  couples: CoupleOption[];
  categories: CategoryOption[];
  page: number;
  totalPages: number;
}

export function FeedbackList({
  rows,
  view,
  couples,
  categories,
  page,
  totalPages,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<JourneyFeedbackHydrated | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this feedback note? This cannot be undone.")) return;
    const res = await deleteFeedback({ id });
    if (!res.ok) alert(`Delete failed: ${res.error}`);
  };

  // Group rows by day for timeline view. We treat "day" as YYYY-MM-DD
  // in the server's local TZ; the timeline doesn't need TZ precision
  // - it's a clinical scan, not an audit log.
  const grouped = useMemo(() => {
    if (view !== "timeline") return null;
    const map = new Map<string, JourneyFeedbackHydrated[]>();
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows, view]);

  if (rows.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-lg border p-12 text-center text-sm">
        No clinical notes match the current filter.
      </div>
    );
  }

  return (
    <>
      {view === "list" ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <FeedbackRow
                row={r}
                expanded={expanded.has(r.id)}
                onToggle={() => toggle(r.id)}
                onEdit={() => setEditing(r)}
                onDelete={() => onDelete(r.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          {grouped!.map(([day, items]) => (
            <section key={day} className="relative pl-6">
              <div className="bg-border absolute bottom-0 left-2 top-0 w-px" />
              <h3 className="text-muted-foreground -ml-6 mb-3 text-xs font-semibold uppercase tracking-wider">
                {day}
              </h3>
              <ul className="space-y-3">
                {items.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="bg-foreground absolute -left-[19px] top-3 size-2 rounded-full" />
                    <FeedbackRow
                      row={r}
                      expanded={expanded.has(r.id)}
                      onToggle={() => toggle(r.id)}
                      onEdit={() => setEditing(r)}
                      onDelete={() => onDelete(r.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span>
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      {editing && (
        <FeedbackForm
          mode="edit"
          existing={editing}
          couples={couples}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FeedbackRow({
  row,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  row: JourneyFeedbackHydrated;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = SEVERITY_TONE[row.severity as FeedbackSeverity];
  const subjectLabel =
    row.subject_user_display ??
    row.subject_user_email ??
    (row.couple_id ? `Couple ${row.couple_id.slice(0, 8)}` : "-");

  return (
    <article className="bg-card rounded-lg border p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
          >
            {SEVERITY_LABEL_HE[row.severity]}
          </span>
          <span className="text-sm font-medium">{subjectLabel}</span>
          {row.category_label && (
            <span className="text-muted-foreground text-xs">
              · {row.category_label}
            </span>
          )}
          {row.item_label && (
            <span className="text-muted-foreground text-xs">
              · {row.item_label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit"
            className="hover:bg-accent rounded-md p-1.5"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="hover:bg-accent text-rose-700 rounded-md p-1.5"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </header>

      <p className="mt-2 text-sm leading-relaxed">{row.short_summary}</p>

      {row.extended_text && (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
          {expanded ? "Hide full analysis" : "Show full analysis"}
        </button>
      )}

      {expanded && row.extended_text && (
        <div className="bg-muted/50 mt-3 whitespace-pre-wrap rounded-md p-3 text-sm leading-relaxed">
          {row.extended_text}
        </div>
      )}

      <footer className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span>{new Date(row.created_at).toLocaleString()}</span>
        {row.author_email && <span>· by {row.author_email}</span>}
        {row.updated_at !== row.created_at && (
          <span>· edited {new Date(row.updated_at).toLocaleString()}</span>
        )}
      </footer>
    </article>
  );
}

// ─── New-button - separate named export ──────────────────────────────────────
//
// Earlier this was attached as a static on FeedbackList (FeedbackList.NewButton
// = NewButton). That pattern blew up at runtime with
//   "Cannot read properties of null (reading 'useState')"
// because Next.js' RSC client-boundary serialiser only treats top-level
// named exports as proper client components - a property assigned at module
// load time isn't exposed as one, so when the server-rendered page tried to
// hydrate the button React got a dehydrated Suspense node it couldn't
// connect a hook context to.
//
// Plain named export = the conventional, supported way. Importers update
// from `<FeedbackList.NewButton ... />` to `<FeedbackNewButton ... />`.
export function FeedbackNewButton({
  couples,
  categories,
}: {
  couples: CoupleOption[];
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-medium"
      >
        <Plus className="size-4" />
        New note
      </button>
      {open && (
        <FeedbackForm
          mode="create"
          couples={couples}
          categories={categories}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
