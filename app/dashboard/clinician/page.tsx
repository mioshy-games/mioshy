/**
 * /dashboard/clinician
 *
 * Phase 4 - clinician CRM. The "what's on my plate today" page.
 *
 * Sources:
 *   - listExpertClients()       - couples this clinician is linked to
 *   - getClinicianWorkQueue()   - workflow signals per couple
 *
 * Tabs:
 *   - All
 *   - Urgent (concerning / crisis_keyword)
 *   - Stuck (>7d available with no response)
 *   - Awaiting reply (responses + messages without clinician_status)
 *   - New (created in last 7 days, no activity)
 *
 * Each row links into /dashboard/my-clients/[coupleId] where the
 * existing inbox and assignment surfaces live. This page is the
 * triage front; that page is where the work happens.
 */

import Link from "next/link";
import {
  AlertCircle,
  Clock,
  MessageSquare,
  Sparkles,
  Users,
  ArrowRight,
} from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { listExpertClients } from "@/lib/experts/queries";
import {
  getClinicianWorkQueue,
  signalLabel,
  type ClinicianQueueRow,
  type ClinicianSignal,
} from "@/lib/dashboard/clinician-queue";

export const dynamic = "force-dynamic";

const FILTERS: Array<{
  key: "all" | ClinicianSignal;
  label_he: string;
  label_en: string;
}> = [
  { key: "all", label_he: "הכל", label_en: "All" },
  { key: "urgent", label_he: "דחוף", label_en: "Urgent" },
  { key: "stuck", label_he: "תקועים", label_en: "Stuck" },
  { key: "pending_reply", label_he: "ממתינים לתגובתי", label_en: "Awaiting reply" },
  { key: "new", label_he: "חדשים", label_en: "New" },
];

export default async function ClinicianQueuePage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const session = await requireExpert();
  const isHe = false; // dashboard surface is currently English-first; flip when localised

  // Fetch couples linked to this clinician, then enrich with the queue.
  const clients = await listExpertClients({
    expertId: session.user.id,
    isAdmin: session.isAdmin,
  });
  const coupleIds = clients.map((c) => c.coupleId);

  const queue =
    coupleIds.length > 0
      ? await getClinicianWorkQueue({ coupleIds })
      : [];

  const activeFilter = (searchParams?.filter ?? "all") as
    | "all"
    | ClinicianSignal;

  const filtered =
    activeFilter === "all"
      ? queue
      : queue.filter((q) => q.signal === activeFilter);

  // Tab counts for the badges
  const counts: Record<"all" | ClinicianSignal, number> = {
    all: queue.length,
    urgent: queue.filter((q) => q.signal === "urgent").length,
    stuck: queue.filter((q) => q.signal === "stuck").length,
    pending_reply: queue.filter((q) => q.signal === "pending_reply").length,
    new: queue.filter((q) => q.signal === "new").length,
    active: queue.filter((q) => q.signal === "active").length,
    idle: queue.filter((q) => q.signal === "idle").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Today&apos;s queue</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Triage view. Couples are grouped by what needs your attention next.
          Click a row to open the full client surface and act.
        </p>
      </header>

      {/* Top stats - calm summary band */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat
          label="Couples"
          value={queue.length}
          icon={<Users className="size-4" aria-hidden />}
        />
        <SummaryStat
          label="Urgent"
          value={counts.urgent}
          tone="rose"
          icon={<AlertCircle className="size-4" aria-hidden />}
        />
        <SummaryStat
          label="Stuck >7d"
          value={counts.stuck}
          tone="amber"
          icon={<Clock className="size-4" aria-hidden />}
        />
        <SummaryStat
          label="Awaiting reply"
          value={counts.pending_reply}
          tone="violet"
          icon={<MessageSquare className="size-4" aria-hidden />}
        />
        <SummaryStat
          label="New (7d)"
          value={counts.new}
          tone="emerald"
          icon={<Sparkles className="size-4" aria-hidden />}
        />
      </div>

      {/* Filter tabs */}
      <nav
        aria-label="Filter queue"
        className="flex flex-wrap gap-2 border-b border-border pb-2"
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const c = counts[f.key];
          return (
            <Link
              key={f.key}
              href={`/dashboard/clinician?filter=${f.key}`}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-foreground/30",
              ].join(" ")}
            >
              <span>{isHe ? f.label_he : f.label_en}</span>
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {c}
              </span>
            </Link>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
          {queue.length === 0
            ? "No clients yet. An admin can link couples to you under Experts."
            : "Nothing matches this filter - try a different tab."}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filtered.map((row) => (
            <ClinicianRow key={row.coupleId} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ClinicianRow({ row }: { row: ClinicianQueueRow }) {
  const sig = signalLabel(row.signal, false);
  const completionPct =
    row.scheduledItems > 0
      ? Math.round((row.completedItems / row.scheduledItems) * 100)
      : 0;

  const partnerSummary =
    row.displayName ||
    row.partnerLabels.slice(0, 2).join(" · ") ||
    `Couple · ${row.coupleId.slice(0, 8)}`;

  return (
    <li>
      <Link
        href={`/dashboard/my-clients/${row.coupleId}`}
        className="flex flex-wrap items-center gap-4 p-4 hover:bg-muted/40"
      >
        <SignalDot tone={sig.tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{partnerSummary}</span>
            <SignalChip label={sig.label} tone={sig.tone} />
            {row.pairCode ? (
              <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {row.pairCode}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.partnerLabels.join(" · ") || "no members"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {row.lastUserActivityAt
              ? `Last activity: ${formatRel(row.lastUserActivityAt)}`
              : `Created ${row.daysSinceCreated}d ago, no activity yet`}
          </p>
        </div>

        <div className="hidden items-center gap-5 text-center text-xs sm:flex">
          {row.concerningCount > 0 ? (
            <SignalNumber
              value={row.concerningCount}
              label="concerning"
              tone="rose"
            />
          ) : null}
          {row.stuckCount > 0 ? (
            <SignalNumber
              value={row.stuckCount}
              label="stuck"
              tone="amber"
            />
          ) : null}
          {row.pendingReplies > 0 ? (
            <SignalNumber
              value={row.pendingReplies}
              label="to reply"
              tone="violet"
            />
          ) : null}
          {row.unreadMessages > 0 ? (
            <SignalNumber
              value={row.unreadMessages}
              label="new msgs"
              tone="violet"
            />
          ) : null}
          <SignalNumber
            value={`${row.completedItems}/${row.scheduledItems}`}
            label={`${completionPct}% done`}
          />
        </div>

        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "rose" | "amber" | "violet" | "emerald";
  icon: React.ReactNode;
}) {
  const palette =
    tone === "rose"
      ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
        : tone === "violet"
          ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300"
          : tone === "emerald"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-card text-foreground";
  return (
    <div className={["rounded-lg border p-3", palette].join(" ")}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SignalDot({
  tone,
}: {
  tone: "rose" | "amber" | "violet" | "emerald" | "white" | "muted";
}) {
  const c =
    tone === "rose"
      ? "bg-rose-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "violet"
          ? "bg-violet-500"
          : tone === "emerald"
            ? "bg-emerald-500"
            : tone === "muted"
              ? "bg-muted-foreground/40"
              : "bg-foreground";
  return (
    <span
      className={["inline-block size-2.5 shrink-0 rounded-full", c].join(" ")}
      aria-hidden
    />
  );
}

function SignalChip({
  label,
  tone,
}: {
  label: string;
  tone: "rose" | "amber" | "violet" | "emerald" | "white" | "muted";
}) {
  const c =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : tone === "violet"
          ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200"
          : tone === "emerald"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
            : tone === "muted"
              ? "border-muted-foreground/30 bg-muted text-muted-foreground"
              : "border-border bg-card text-foreground";
  return (
    <span
      className={[
        "inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        c,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SignalNumber({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "rose" | "amber" | "violet";
}) {
  const c =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "violet"
          ? "text-violet-700 dark:text-violet-300"
          : "text-foreground";
  return (
    <div className="min-w-[3.5rem]">
      <div className={["text-sm font-semibold", c].join(" ")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function formatRel(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "-";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
