import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getCronHealthSnapshot,
  getPendingPushesSummary,
  getStuckUsers,
  type CronHealthRow,
} from "@/lib/journey-content/observability";
import { getUnreadAdminAlerts } from "@/lib/journey-content/notifications-read";
import { AdminAlertsBanner } from "@/components/dashboard/journey/AdminAlertsBanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HintIcon } from "@/components/ui/hint-icon";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const JOB_LABEL: Record<string, string> = {
  cadence_advance: "Cadence advance (every 15 min)",
  notify_unlocks: "Notify unlocks (hourly :15)",
  grace_watcher: "Grace watcher (hourly :00)",
  scores_recompute: "User-scores recompute (daily 04:00)",
};

export default async function JourneyHealthPage() {
  await requireAdmin();
  const [crons, pending, stuck, alerts] = await Promise.all([
    getCronHealthSnapshot(),
    getPendingPushesSummary(),
    getStuckUsers(7, 50),
    getUnreadAdminAlerts(20),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href="/dashboard/journey"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to Journey overview
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Health</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Cron status, stuck-user alerts, and pending push backlog. All
          read-only — no actions on this page.
        </p>
      </div>

      {/* ── v3 slice 10 admin alerts banner ──────────────────────── */}
      <AdminAlertsBanner alerts={alerts} />

      {/* ── Cron status table ─────────────────────────────────────── */}
      <section className="bg-card rounded-lg border">
        <header className="border-b border-border p-4">
          <h2 className="font-semibold">Cron jobs (last 24 h)</h2>
          <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 text-xs">
            <span>"Stale" = last run is older than 1.5× the expected interval.</span>
            <HintIcon topic="health.cron_stale_threshold" />
          </p>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className="text-end">Last rows</TableHead>
              <TableHead className="text-end">
                <span className="inline-flex items-center gap-1">
                  Σ rows 24 h
                  <HintIcon topic="health.sum_rows_24h" />
                </span>
              </TableHead>
              <TableHead className="text-end">Failures 24 h</TableHead>
              <TableHead>Last error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crons.map((c) => (
              <CronRow key={c.job_name} row={c} />
            ))}
          </TableBody>
        </Table>
      </section>

      {/* ── Pending pushes summary ────────────────────────────────── */}
      <section className="bg-card rounded-lg border">
        <header className="border-b border-border p-4">
          <h2 className="font-semibold">Pending pushes</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Push rows not yet consumed by the cadence engine. They drain
            one per recipient per delivery slot.
          </p>
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <StatTile
            label="Total unconsumed"
            value={pending.totalUnconsumed}
            tone={pending.totalUnconsumed > 100 ? "warn" : "neutral"}
          />
          <StatTile
            label="Oldest age (days)"
            value={pending.oldestAgeDays ?? "—"}
            tone={
              pending.oldestAgeDays && pending.oldestAgeDays > 14
                ? "warn"
                : "neutral"
            }
          />
          <StatTile
            label="Group push rows"
            value={pending.byKind.group}
            tone="neutral"
          />
        </div>
      </section>

      {/* ── Stuck users ───────────────────────────────────────────── */}
      <section className="bg-card rounded-lg border">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-semibold">Stuck users (≥7 days idle, no pending push)</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The cadence engine should be picking for them. Empty queue
              usually means the picker found no candidates — check
              priority ranking + active items in their categories.
            </p>
          </div>
          <Badge
            variant={stuck.length === 0 ? "secondary" : "destructive"}
            className="text-[11px]"
          >
            {stuck.length}
          </Badge>
        </header>
        {stuck.length === 0 ? (
          <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
            All clear — nobody is stuck.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-end">Days idle</TableHead>
                <TableHead>Last delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stuck.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/journey/clients/${encodeURIComponent(`user:${u.user_id}`)}`}
                      className="font-medium hover:underline"
                    >
                      {u.full_name || u.email || `${u.user_id.slice(0, 8)}…`}
                    </Link>
                    {u.full_name && u.email ? (
                      <div className="text-muted-foreground text-xs">
                        {u.email}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {u.days_since_delivery >= 999
                      ? "never"
                      : u.days_since_delivery}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.last_delivery_at
                      ? new Date(u.last_delivery_at).toLocaleString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function CronRow({ row }: { row: CronHealthRow }) {
  const status = !row.lastRunAt
    ? { tone: "destructive" as const, label: "Never run", Icon: AlertTriangle }
    : row.isStale
      ? { tone: "destructive" as const, label: "Stale", Icon: AlertTriangle }
      : row.lastRunOk === false
        ? { tone: "destructive" as const, label: "Failed", Icon: AlertTriangle }
        : { tone: "default" as const, label: "OK", Icon: CheckCircle2 };
  const StatusIcon = status.Icon;
  return (
    <TableRow>
      <TableCell className="font-medium">
        {JOB_LABEL[row.job_name] ?? row.job_name}
      </TableCell>
      <TableCell>
        <Badge variant={status.tone} className="inline-flex items-center gap-1 text-[10px]">
          <StatusIcon className="size-3" aria-hidden />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {row.lastRunAt ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {new Date(row.lastRunAt).toLocaleString()}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-end tabular-nums">{row.lastRunRows}</TableCell>
      <TableCell className="text-end tabular-nums">
        {row.rowsProcessed24h}
      </TableCell>
      <TableCell className="text-end tabular-nums">
        {row.failures24h > 0 ? (
          <span className="text-rose-500 font-semibold">{row.failures24h}</span>
        ) : (
          0
        )}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[280px] truncate text-xs">
        {row.lastRunError ?? ""}
      </TableCell>
    </TableRow>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "warn"
          ? "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60"
          : "bg-muted/30",
      )}
    >
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
