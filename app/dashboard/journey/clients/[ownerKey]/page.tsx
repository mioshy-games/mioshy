/**
 * /dashboard/journey/clients/[ownerKey]
 *
 * The Manage-Client "control panel" for one owner (single user OR couple).
 * This is where the admin does all day-to-day Journey ops for that client:
 *
 *   • See state at a glance (active / progressing / complete / paused)
 *   • Add another program/category/item to their timeline
 *   • Inspect every assignment's full schedule with scannable status dots
 *   • Nudge the unlock date of any single item
 *   • Clear an override back to the catalog default
 *   • Re-materialize, cancel, reactivate, delete an assignment
 *
 * We intentionally do the joins in-process rather than pushing down a view:
 * the per-client dataset is small (tens of items) and keeping it in TS means
 * the admin UI can iterate without chasing migrations.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  PauseCircle,
  UserRound,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  adminGetOwnerLabel,
  adminListAssignments,
} from "@/lib/journey-content/queries";
import { parseOwnerKey } from "@/lib/journey-content/owner";
import { deriveStatus } from "@/lib/journey-content/status";
import type {
  JourneyAssignment,
  JourneyCategory,
  JourneyItem,
  JourneyItemCompletion,
  JourneyProgram,
  JourneyScheduledItem,
  ScheduledItemStatus,
} from "@/lib/journey-content/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssignmentCard } from "@/components/dashboard/journey/manage/AssignmentCard";
import type {
  AssignmentCardItem,
  AssignmentCardSourceRef,
} from "@/components/dashboard/journey/manage/AssignmentCard";

export const dynamic = "force-dynamic";

// ------------------------------------------------------------
// Data loading — one pass that hydrates every assignment with its
// scheduled items, items, category labels, and completion state.
// ------------------------------------------------------------

interface LoadedAssignment {
  assignment: JourneyAssignment;
  sourceRef: AssignmentCardSourceRef;
  items: AssignmentCardItem[];
  stats: {
    total: number;
    locked: number;
    available: number;
    completed: number;
  };
}

interface LoadedOwner {
  assignments: LoadedAssignment[];
  totals: {
    total_items: number;
    completed_items: number;
    active_assignments: number;
    cancelled_assignments: number;
    last_activity: string | null;
  };
}

async function loadOwner(ownerKey: string): Promise<LoadedOwner> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const assignments = await adminListAssignments({ ownerKey, limit: 500 });
  if (assignments.length === 0) {
    return {
      assignments: [],
      totals: {
        total_items: 0,
        completed_items: 0,
        active_assignments: 0,
        cancelled_assignments: 0,
        last_activity: null,
      },
    };
  }

  const assignmentIds = assignments.map((a) => a.id);

  // Scheduled rows for every assignment — active or cancelled. Admins need
  // visibility into cancelled timelines too so they can reason about history.
  const { data: scheduledRows, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .in("assignment_id", assignmentIds)
    .order("unlock_at", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  const scheduled = (scheduledRows ?? []) as JourneyScheduledItem[];
  const scheduledIds = scheduled.map((s) => s.id);

  // Items + categories + completions in parallel. We only load ACTIVE
  // catalog content for labels — if an admin soft-deleted an item the row
  // stays in the timeline, but its title will be ambiguous; that's
  // acceptable for now.
  const itemIds = Array.from(new Set(scheduled.map((s) => s.item_id)));

  const [itemsRes, completionsRes] = await Promise.all([
    itemIds.length > 0
      ? admin.from("journey_items").select("*").in("id", itemIds)
      : Promise.resolve({ data: [] as JourneyItem[], error: null }),
    scheduledIds.length > 0
      ? admin
          .from("journey_item_completions")
          .select("*")
          .in("scheduled_item_id", scheduledIds)
      : Promise.resolve({ data: [] as JourneyItemCompletion[], error: null }),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (completionsRes.error) throw new Error(completionsRes.error.message);

  const items = (itemsRes.data ?? []) as JourneyItem[];
  const itemsById = new Map(items.map((it) => [it.id, it]));

  const categoryIds = Array.from(new Set(items.map((it) => it.category_id)));
  const { data: categoryRows } =
    categoryIds.length > 0
      ? await admin
          .from("journey_categories")
          .select("id, name_he, name_en, slug, program_id")
          .in("id", categoryIds)
      : { data: [] as Array<Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug" | "program_id">> };
  const categoriesById = new Map(
    ((categoryRows ?? []) as Array<
      Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug" | "program_id">
    >).map((c) => [c.id, c]),
  );

  // Source labels: we need distinct program/category/item ids from the
  // assignments themselves so the card header can say "Program · Clear
  // Communication" instead of just "program · <uuid>".
  const programSourceIds = assignments
    .filter((a) => a.source_kind === "program")
    .map((a) => a.source_id);
  const categorySourceIds = assignments
    .filter((a) => a.source_kind === "category")
    .map((a) => a.source_id);
  const itemSourceIds = assignments
    .filter((a) => a.source_kind === "item")
    .map((a) => a.source_id);

  const [programsRes, extraCategoriesRes, extraItemsRes] = await Promise.all([
    programSourceIds.length > 0
      ? admin
          .from("journey_programs")
          .select("id, name_he, name_en, slug")
          .in("id", programSourceIds)
      : Promise.resolve({
          data: [] as Array<Pick<JourneyProgram, "id" | "name_he" | "name_en" | "slug">>,
          error: null,
        }),
    categorySourceIds.length > 0
      ? admin
          .from("journey_categories")
          .select("id, name_he, name_en, slug, program_id")
          .in("id", categorySourceIds)
      : Promise.resolve({ data: [] as Array<Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug" | "program_id">>, error: null }),
    itemSourceIds.length > 0
      ? admin
          .from("journey_items")
          .select("id, title_he, title_en, slug")
          .in("id", itemSourceIds)
      : Promise.resolve({ data: [] as Array<Pick<JourneyItem, "id" | "title_he" | "title_en" | "slug">>, error: null }),
  ]);

  const programLabelById = new Map(
    ((programsRes.data ?? []) as Array<Pick<JourneyProgram, "id" | "name_he">>).map(
      (p) => [p.id, p.name_he],
    ),
  );
  // Merge extra source-category rows into the main map.
  for (const c of (extraCategoriesRes.data ?? []) as Array<
    Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug" | "program_id">
  >) {
    if (!categoriesById.has(c.id)) categoriesById.set(c.id, c);
  }
  const itemLabelById = new Map(
    ((extraItemsRes.data ?? []) as Array<
      Pick<JourneyItem, "id" | "title_he">
    >).map((i) => [i.id, i.title_he]),
  );

  const completionsById = new Map(
    ((completionsRes.data ?? []) as JourneyItemCompletion[]).map((c) => [
      c.scheduled_item_id,
      c,
    ]),
  );

  // Group scheduled rows by assignment. Preserve the unlock_at ordering
  // we already established.
  const scheduledByAssignment = new Map<string, JourneyScheduledItem[]>();
  for (const s of scheduled) {
    const list = scheduledByAssignment.get(s.assignment_id) ?? [];
    list.push(s);
    scheduledByAssignment.set(s.assignment_id, list);
  }

  const now = new Date();

  const loaded: LoadedAssignment[] = assignments.map((a) => {
    const rows = scheduledByAssignment.get(a.id) ?? [];
    const cardItems: AssignmentCardItem[] = rows
      .map((s) => {
        const item = itemsById.get(s.item_id);
        if (!item) return null;
        const category = categoriesById.get(item.category_id);
        const completion = completionsById.get(s.id) ?? null;
        const status = deriveStatus({
          unlockAt: s.unlock_at,
          hasCompletion: !!completion,
          now,
        });
        return {
          scheduled: s,
          item,
          category_name: category?.name_he ?? "—",
          status,
          completed_at: completion?.completed_at ?? null,
        } satisfies AssignmentCardItem;
      })
      .filter((x): x is AssignmentCardItem => x !== null);

    const stats = {
      total: cardItems.length,
      locked: cardItems.filter((i) => i.status === "locked").length,
      available: cardItems.filter((i) => i.status === "available").length,
      completed: cardItems.filter((i) => i.status === "completed").length,
    };

    let sourceRef: AssignmentCardSourceRef;
    if (a.source_kind === "program") {
      sourceRef = {
        kind: "program",
        label: programLabelById.get(a.source_id) ?? "(unknown program)",
        href: `/dashboard/journey/programs/${a.source_id}`,
      };
    } else if (a.source_kind === "category") {
      const c = categoriesById.get(a.source_id);
      sourceRef = {
        kind: "category",
        label: c?.name_he ?? "(unknown category)",
        href: `/dashboard/journey/categories/${a.source_id}`,
      };
    } else {
      sourceRef = {
        kind: "item",
        label: itemLabelById.get(a.source_id) ?? "(unknown item)",
        href: `/dashboard/journey/items/${a.source_id}`,
      };
    }

    return {
      assignment: a,
      sourceRef,
      items: cardItems,
      stats,
    };
  });

  // Totals across active assignments only — cancelled items shouldn't
  // colour the owner's "state at a glance".
  const totals = loaded.reduce(
    (acc, L) => {
      if (L.assignment.is_active) {
        acc.active_assignments += 1;
        acc.total_items += L.stats.total;
        acc.completed_items += L.stats.completed;
      } else {
        acc.cancelled_assignments += 1;
      }
      const created = L.assignment.created_at;
      if (!acc.last_activity || created > acc.last_activity) {
        acc.last_activity = created;
      }
      return acc;
    },
    {
      total_items: 0,
      completed_items: 0,
      active_assignments: 0,
      cancelled_assignments: 0,
      last_activity: null as string | null,
    },
  );

  return { assignments: loaded, totals };
}

// ------------------------------------------------------------
// View helpers
// ------------------------------------------------------------

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type OwnerStateTone = "emerald" | "amber" | "sky" | "slate";

interface OwnerState {
  tone: OwnerStateTone;
  icon: React.ElementType;
  title: string;
  caption: string;
}

function deriveOwnerState(totals: LoadedOwner["totals"]): OwnerState {
  if (totals.active_assignments === 0) {
    if (totals.cancelled_assignments > 0) {
      return {
        tone: "slate",
        icon: PauseCircle,
        title: "Paused",
        caption:
          "All assignments are cancelled. Reactivate one below or add a new one.",
      };
    }
    return {
      tone: "slate",
      icon: Compass,
      title: "No content yet",
      caption: "Assign this client a program, category, or single item to begin.",
    };
  }
  if (totals.total_items === 0) {
    return {
      tone: "sky",
      icon: Compass,
      title: "Active — but empty",
      caption:
        "Active assignments exist but have no scheduled items. Try re-materialize.",
    };
  }
  if (totals.completed_items >= totals.total_items) {
    return {
      tone: "emerald",
      icon: CheckCircle2,
      title: "Complete",
      caption: "Every scheduled item across active assignments is done.",
    };
  }
  if (totals.completed_items > 0) {
    return {
      tone: "amber",
      icon: Flame,
      title: "Progressing",
      caption: `${totals.completed_items} of ${totals.total_items} items completed.`,
    };
  }
  return {
    tone: "sky",
    icon: Clock,
    title: "Active",
    caption: "Timeline is ready — waiting for the first item to be completed.",
  };
}

function toneClasses(tone: OwnerStateTone) {
  switch (tone) {
    case "emerald":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-emerald-200 dark:border-emerald-900/60",
        text: "text-emerald-900 dark:text-emerald-100",
        accent: "text-emerald-600 dark:text-emerald-300",
      };
    case "amber":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-200 dark:border-amber-900/60",
        text: "text-amber-900 dark:text-amber-100",
        accent: "text-amber-600 dark:text-amber-300",
      };
    case "sky":
      return {
        bg: "bg-sky-50 dark:bg-sky-950/40",
        border: "border-sky-200 dark:border-sky-900/60",
        text: "text-sky-900 dark:text-sky-100",
        accent: "text-sky-600 dark:text-sky-300",
      };
    case "slate":
    default:
      return {
        bg: "bg-muted/50",
        border: "border-border",
        text: "text-foreground",
        accent: "text-muted-foreground",
      };
  }
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

export default async function ManageClientPage({
  params,
}: {
  params: { ownerKey: string };
}) {
  await requireAdmin();

  const ownerKey = decodeURIComponent(params.ownerKey);
  const owner = parseOwnerKey(ownerKey);
  if (!owner) notFound();

  const [ownerLabel, loaded] = await Promise.all([
    adminGetOwnerLabel(ownerKey),
    loadOwner(ownerKey),
  ]);

  const state = deriveOwnerState(loaded.totals);
  const toneCls = toneClasses(state.tone);
  const StateIcon = state.icon;
  const OwnerIcon = owner.kind === "couple" ? Users : UserRound;

  const progressPct =
    loaded.totals.total_items > 0
      ? Math.round(
          (loaded.totals.completed_items / loaded.totals.total_items) * 100,
        )
      : 0;

  const activeAssignments = loaded.assignments.filter(
    (a) => a.assignment.is_active,
  );
  const cancelledAssignments = loaded.assignments.filter(
    (a) => !a.assignment.is_active,
  );

  const assignHref = `/dashboard/journey/assignments/new?owner=${encodeURIComponent(ownerKey)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Back link ───────────────────────────────────────────── */}
      <Link
        href="/dashboard/journey/clients"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>

      {/* ── Header — identity + primary CTA ─────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-full border">
            <OwnerIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {ownerLabel ?? "Unknown owner"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="text-[10px] uppercase">
                {owner.kind}
              </Badge>
              <span className="text-muted-foreground font-mono text-xs">
                {ownerKey}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={assignHref}
          className={cn(buttonVariants({ variant: "default" }))}
        >
          + Assign to this client
        </Link>
      </header>

      {/* ── State banner — immediately legible summary ──────────── */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5",
          toneCls.bg,
          toneCls.border,
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full bg-white/70 dark:bg-black/30",
              toneCls.accent,
            )}
          >
            <StateIcon className="size-5" />
          </div>
          <div>
            <div className={cn("text-lg font-semibold", toneCls.text)}>
              {state.title}
            </div>
            <div
              className={cn("mt-0.5 max-w-xl text-sm", toneCls.accent)}
            >
              {state.caption}
            </div>
          </div>
        </div>

        {/* Progress ring + pct */}
        {loaded.totals.total_items > 0 ? (
          <div className="flex items-center gap-3">
            <div className="relative size-16">
              <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-border"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(progressPct / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`}
                  className={toneCls.accent}
                />
              </svg>
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-sm font-semibold",
                  toneCls.text,
                )}
              >
                {progressPct}%
              </div>
            </div>
            <div className="text-xs">
              <div className={cn("font-medium", toneCls.text)}>
                {loaded.totals.completed_items} / {loaded.totals.total_items}
              </div>
              <div className={toneCls.accent}>items completed</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatPill
          label="Active assignments"
          value={loaded.totals.active_assignments}
        />
        <StatPill
          label="Cancelled"
          value={loaded.totals.cancelled_assignments}
          muted
        />
        <StatPill
          label="Items done"
          value={`${loaded.totals.completed_items}/${loaded.totals.total_items}`}
        />
        <StatPill
          label="Last added"
          value={fmtDate(loaded.totals.last_activity)}
        />
      </div>

      {/* ── Active assignments ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Active assignments
          </h2>
          <span className="text-muted-foreground text-xs">
            {activeAssignments.length} assignment
            {activeAssignments.length === 1 ? "" : "s"}
          </span>
        </div>

        {activeAssignments.length === 0 ? (
          <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No active assignments yet.{" "}
            <Link
              href={assignHref}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Assign a program
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {activeAssignments.map((L) => (
              <AssignmentCard
                key={L.assignment.id}
                ownerKey={ownerKey}
                assignment={L.assignment}
                sourceRef={L.sourceRef}
                items={L.items}
                stats={L.stats}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Cancelled assignments (only if any) ─────────────────── */}
      {cancelledAssignments.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
              Cancelled
            </h2>
            <span className="text-muted-foreground text-xs">
              {cancelledAssignments.length}
            </span>
          </div>
          <div className="space-y-4 opacity-70">
            {cancelledAssignments.map((L) => (
              <AssignmentCard
                key={L.assignment.id}
                ownerKey={ownerKey}
                assignment={L.assignment}
                sourceRef={L.sourceRef}
                items={L.items}
                stats={L.stats}
                defaultCollapsed
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Local components
// ------------------------------------------------------------

function StatPill({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        muted ? "bg-muted/40" : "bg-card",
      )}
    >
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

// Just so TS doesn't complain about unused imports when status variants change.
export type { ScheduledItemStatus };
