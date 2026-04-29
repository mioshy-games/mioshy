"use client";

// ============================================================
// AssignmentCard — the main unit of the Manage-Client panel.
//
// One card per journey_assignment row. Summarises the assignment
// (source, anchor, state, progress dots) and — when expanded —
// exposes the full, scannable per-item timeline underneath, grouped
// by category. Each row has inline controls for unlock date editing
// and removal so the admin never has to bounce to a different page
// to nudge a schedule.
//
// Assignment-level ops (re-materialize, cancel/reactivate, delete)
// reuse the existing AssignmentControls component — the user-facing
// behaviour is identical to /dashboard/journey/assignments/[id].
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  FolderOpen,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AssignmentControls } from "@/components/dashboard/journey/AssignmentControls";
import { ScheduledItemRow } from "./ScheduledItemRow";
import type {
  JourneyAssignment,
  JourneyItem,
  JourneyScheduledItem,
  ScheduledItemStatus,
} from "@/lib/journey-content/types";

export interface AssignmentCardItem {
  scheduled: JourneyScheduledItem;
  item: JourneyItem;
  category_name: string;
  status: ScheduledItemStatus;
  completed_at: string | null;
}

export interface AssignmentCardSourceRef {
  kind: "program" | "category" | "item";
  label: string;
  href: string;
}

interface Stats {
  total: number;
  locked: number;
  available: number;
  completed: number;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceIcon(kind: AssignmentCardSourceRef["kind"]) {
  if (kind === "program") return Sparkles;
  if (kind === "category") return FolderOpen;
  return FileText;
}

/**
 * Tiny horizontal progress bar that splits into segments — one per
 * scheduled item. Admins get a visual density that tells them at a
 * glance how many items are completed, available, and still locked
 * without counting numbers.
 */
function ProgressDots({ items }: { items: AssignmentCardItem[] }) {
  if (items.length === 0) return null;
  // Cap to 40 segments so wildly large assignments still render cleanly.
  const shown = items.slice(0, 40);
  return (
    <div className="flex items-center gap-[3px]">
      {shown.map((i) => (
        <span
          key={i.scheduled.id}
          title={`${i.item.title_he} · ${i.status}`}
          className={cn(
            "h-1.5 w-3 rounded-full",
            i.status === "completed" && "bg-emerald-500",
            i.status === "available" && "bg-amber-500",
            i.status === "locked" && "bg-muted-foreground/25",
          )}
        />
      ))}
      {items.length > shown.length ? (
        <span className="text-muted-foreground ms-1 text-[10px]">
          +{items.length - shown.length}
        </span>
      ) : null}
    </div>
  );
}

export function AssignmentCard({
  ownerKey,
  assignment,
  sourceRef,
  items,
  stats,
  defaultCollapsed = false,
}: {
  ownerKey: string;
  assignment: JourneyAssignment;
  sourceRef: AssignmentCardSourceRef;
  items: AssignmentCardItem[];
  stats: Stats;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const SourceIcon = sourceIcon(sourceRef.kind);

  // Group items by category (preserving insertion / unlock order).
  const grouped = useMemo(() => {
    const out: Array<{ name: string; items: AssignmentCardItem[] }> = [];
    const seen = new Map<string, number>();
    for (const it of items) {
      const key = it.category_name;
      if (!seen.has(key)) {
        seen.set(key, out.length);
        out.push({ name: key, items: [it] });
      } else {
        out[seen.get(key)!].items.push(it);
      }
    }
    return out;
  }, [items]);

  const pct =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <article className="bg-card overflow-hidden rounded-xl border shadow-sm">
      {/* ── Card header ───────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
            aria-label={open ? "Collapse timeline" : "Expand timeline"}
          >
            {open ? (
              <ChevronDown className="size-5" />
            ) : (
              <ChevronRight className="size-5 rtl:rotate-180" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {sourceRef.kind}
              </Badge>
              <Link
                href={sourceRef.href}
                className="group inline-flex max-w-[28ch] items-center gap-1 truncate font-semibold hover:underline"
              >
                <SourceIcon className="size-4 text-muted-foreground group-hover:text-foreground" />
                <span className="truncate">{sourceRef.label}</span>
                <ExternalLink className="text-muted-foreground/0 group-hover:text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              {assignment.is_active ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600/90">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Cancelled</Badge>
              )}
            </div>

            {/* Meta row */}
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="font-medium text-foreground/80">Anchor:</span>{" "}
                {fmtDate(assignment.anchor_date)}
                <span className="ms-1 text-muted-foreground/70">
                  ({assignment.anchor_kind})
                </span>
              </span>
              <span>
                <span className="font-medium text-foreground/80">Origin:</span>{" "}
                {assignment.origin}
              </span>
              <span>
                <span className="font-medium text-foreground/80">Created:</span>{" "}
                {fmtDate(assignment.created_at)}
              </span>
              {assignment.notes ? (
                <span className="inline-flex items-center gap-1">
                  <StickyNote className="size-3" />
                  <span className="line-clamp-1 max-w-[36ch]">
                    {assignment.notes}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Progress */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <ProgressDots items={items} />
              <span className="text-muted-foreground tabular-nums">
                {stats.completed}/{stats.total}
                <span className="ms-1">
                  ({pct}%)
                </span>
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <LegendDot tone="emerald" /> {stats.completed}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <LegendDot tone="amber" /> {stats.available}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <LegendDot tone="muted" /> {stats.locked}
              </span>
            </div>
          </div>
        </div>

        {/* Assignment-level controls */}
        <div className="shrink-0">
          <AssignmentControls
            assignmentId={assignment.id}
            isActive={assignment.is_active}
          />
        </div>
      </header>

      {/* ── Expanded timeline ─────────────────────────────────── */}
      {open ? (
        <div className="border-t">
          {items.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              No scheduled items for this assignment. Try re-materialize — the
              source may have been empty at creation time.
            </div>
          ) : (
            <div className="divide-y">
              {grouped.map((group) => (
                <section key={group.name} className="p-5">
                  <header className="mb-3 flex items-center justify-between">
                    <h3 className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <Circle className="size-2 fill-current" />
                      {group.name}
                    </h3>
                    <span className="text-muted-foreground text-[11px]">
                      {group.items.length} item
                      {group.items.length === 1 ? "" : "s"}
                    </span>
                  </header>
                  <ul className="space-y-1">
                    {group.items.map((it) => (
                      <li key={it.scheduled.id}>
                        <ScheduledItemRow
                          ownerKey={ownerKey}
                          scheduled={it.scheduled}
                          item={it.item}
                          status={it.status}
                          completedAt={it.completed_at}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function LegendDot({ tone }: { tone: "emerald" | "amber" | "muted" }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        tone === "emerald" && "bg-emerald-500",
        tone === "amber" && "bg-amber-500",
        tone === "muted" && "bg-muted-foreground/25",
      )}
    />
  );
}
