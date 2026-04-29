/**
 * /dashboard/journey/clients
 *
 * Index of every owner (user OR couple) that has at least one Journey
 * assignment — active or cancelled. Each row links into the Manage-Client
 * page where the admin can bulk-assign content, nudge unlock dates, and
 * re-materialize.
 *
 * This is deliberately cheap to load: we aggregate in memory rather than
 * pushing it down to Postgres. With a few hundred owners that's fine; if
 * it grows we'll swap to an RPC.
 */

import Link from "next/link";
import { ArrowLeft, Search, UserRound, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OwnerSummary {
  ownerKey: string;
  kind: "user" | "couple";
  label: string;
  sublabel: string | null;
  active: number;
  cancelled: number;
  total_items: number;
  completed_items: number;
  last_activity: string | null;
}

async function collectOwnerSummaries(
  search: string,
): Promise<OwnerSummary[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  // 1. Assignments — grouped client-side
  const { data: assignmentRows, error: aErr } = await admin
    .from("journey_assignments")
    .select("id, user_id, couple_id, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (aErr) throw new Error(aErr.message);

  const assignments = (assignmentRows ?? []) as Array<{
    id: string;
    user_id: string | null;
    couple_id: string | null;
    is_active: boolean;
    created_at: string;
  }>;

  const byOwner = new Map<
    string,
    {
      kind: "user" | "couple";
      id: string;
      active: number;
      cancelled: number;
      assignmentIds: string[];
      lastCreated: string;
    }
  >();

  for (const a of assignments) {
    const kind: "user" | "couple" = a.couple_id ? "couple" : "user";
    const id = a.couple_id ?? a.user_id;
    if (!id) continue;
    const key = `${kind}:${id}`;
    const bucket = byOwner.get(key) ?? {
      kind,
      id,
      active: 0,
      cancelled: 0,
      assignmentIds: [],
      lastCreated: a.created_at,
    };
    if (a.is_active) bucket.active += 1;
    else bucket.cancelled += 1;
    bucket.assignmentIds.push(a.id);
    if (a.created_at > bucket.lastCreated) bucket.lastCreated = a.created_at;
    byOwner.set(key, bucket);
  }

  if (byOwner.size === 0) return [];

  // 2. Scheduled items + completions — for the "X / Y done" stat.
  const allAssignmentIds = Array.from(byOwner.values()).flatMap(
    (b) => b.assignmentIds,
  );

  const { data: scheduledRows, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id")
    .in("assignment_id", allAssignmentIds);
  if (sErr) throw new Error(sErr.message);
  const scheduledByAssignment = new Map<string, string[]>();
  for (const s of (scheduledRows ?? []) as Array<{
    id: string;
    assignment_id: string;
  }>) {
    const list = scheduledByAssignment.get(s.assignment_id) ?? [];
    list.push(s.id);
    scheduledByAssignment.set(s.assignment_id, list);
  }
  const allScheduledIds = (scheduledRows ?? []).map(
    (r) => (r as { id: string }).id,
  );

  let completedSet = new Set<string>();
  if (allScheduledIds.length > 0) {
    const { data: completions, error: cErr } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", allScheduledIds);
    if (cErr) throw new Error(cErr.message);
    completedSet = new Set(
      ((completions ?? []) as Array<{ scheduled_item_id: string }>).map(
        (c) => c.scheduled_item_id,
      ),
    );
  }

  // 3. Labels — users via admin_users_overview, couples via couples.
  const userIds = Array.from(byOwner.values())
    .filter((b) => b.kind === "user")
    .map((b) => b.id);
  const coupleIds = Array.from(byOwner.values())
    .filter((b) => b.kind === "couple")
    .map((b) => b.id);

  const [userRowsRes, coupleRowsRes] = await Promise.all([
    userIds.length > 0
      ? admin
          .from("admin_users_overview")
          .select("user_id, email")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; email: string }>, error: null }),
    coupleIds.length > 0
      ? admin
          .from("couples")
          .select("id, display_name, pair_code")
          .in("id", coupleIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            display_name: string | null;
            pair_code: string | null;
          }>,
          error: null,
        }),
  ]);

  const userLabel = new Map(
    ((userRowsRes.data ?? []) as Array<{ user_id: string; email: string }>).map(
      (u) => [u.user_id, u.email],
    ),
  );
  const coupleLabel = new Map(
    (
      (coupleRowsRes.data ?? []) as Array<{
        id: string;
        display_name: string | null;
        pair_code: string | null;
      }>
    ).map((c) => [c.id, c]),
  );

  const summaries: OwnerSummary[] = [];
  for (const [key, bucket] of Array.from(byOwner.entries())) {
    let label: string;
    let sublabel: string | null = null;
    if (bucket.kind === "user") {
      label = userLabel.get(bucket.id) ?? `User · ${bucket.id.slice(0, 8)}`;
    } else {
      const c = coupleLabel.get(bucket.id);
      label = c?.display_name?.trim() || `Couple · ${bucket.id.slice(0, 8)}`;
      sublabel = c?.pair_code ?? null;
    }

    // Aggregate scheduled / completed across all of this owner's assignments
    let total = 0;
    let completed = 0;
    for (const aid of bucket.assignmentIds) {
      const ids = scheduledByAssignment.get(aid) ?? [];
      total += ids.length;
      for (const id of ids) if (completedSet.has(id)) completed += 1;
    }

    summaries.push({
      ownerKey: key,
      kind: bucket.kind,
      label,
      sublabel,
      active: bucket.active,
      cancelled: bucket.cancelled,
      total_items: total,
      completed_items: completed,
      last_activity: bucket.lastCreated,
    });
  }

  // Search filter (case-insensitive label or sublabel match)
  const q = search.trim().toLowerCase();
  const filtered = q
    ? summaries.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.sublabel ?? "").toLowerCase().includes(q) ||
          s.ownerKey.toLowerCase().includes(q),
      )
    : summaries;

  // Sort: active first, then by last activity desc
  filtered.sort((a, b) => {
    if (a.active !== b.active) return b.active - a.active;
    return (b.last_activity ?? "").localeCompare(a.last_activity ?? "");
  });

  return filtered;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stateBadge(s: OwnerSummary) {
  if (s.active === 0 && s.cancelled > 0) {
    return <Badge variant="secondary">Paused</Badge>;
  }
  if (s.active === 0) return <Badge variant="outline">No content</Badge>;
  if (s.total_items > 0 && s.completed_items >= s.total_items) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600/90">Complete</Badge>
    );
  }
  if (s.completed_items > 0) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500/90">Progressing</Badge>
    );
  }
  return <Badge>Active</Badge>;
}

export default async function JourneyClientsIndexPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireAdmin();

  const search = searchParams?.q ?? "";
  const summaries = await collectOwnerSummaries(search);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/journey"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Journey
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Users and couples with a Journey timeline. Click a row to manage
            their programs, timing, and content.
          </p>
        </div>
        <Link
          href="/dashboard/journey/assignments/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          + Assign to owner
        </Link>
      </div>

      {/* Search */}
      <form
        action="/dashboard/journey/clients"
        method="get"
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute inset-y-0 start-3 my-auto size-4" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by name, email, or pair code"
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-9 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </div>
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Search
        </button>
      </form>

      {/* Results list */}
      {summaries.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {search
            ? `No clients match “${search}”.`
            : "No clients yet — bulk-assign a program to someone to see them here."}
        </div>
      ) : (
        <ul className="divide-border border-border overflow-hidden rounded-lg border divide-y">
          {summaries.map((s) => {
            const pct =
              s.total_items > 0
                ? Math.round((s.completed_items / s.total_items) * 100)
                : 0;
            return (
              <li
                key={s.ownerKey}
                className="bg-card hover:bg-muted/40 transition-colors"
              >
                <Link
                  href={`/dashboard/journey/clients/${s.ownerKey}`}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                    {s.kind === "couple" ? (
                      <Users className="size-5" />
                    ) : (
                      <UserRound className="size-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {s.label}
                      </span>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {s.kind}
                      </Badge>
                      {stateBadge(s)}
                    </div>
                    <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {s.ownerKey}
                      {s.sublabel ? ` · ${s.sublabel}` : ""}
                    </div>
                  </div>

                  {/* Stat cluster */}
                  <div className="flex items-center gap-6 text-center text-xs">
                    <Stat value={s.active} label="active" />
                    <Stat
                      value={`${s.completed_items}/${s.total_items}`}
                      label="done"
                      hint={`${pct}%`}
                    />
                    <Stat
                      value={fmtDate(s.last_activity)}
                      label="last add"
                      wide
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
  wide,
}: {
  value: number | string;
  label: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "min-w-[5.5rem]" : "min-w-[3.5rem]"}>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
        {hint ? ` · ${hint}` : ""}
      </div>
    </div>
  );
}
