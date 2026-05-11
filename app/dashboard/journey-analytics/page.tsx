/**
 * /dashboard/journey-analytics
 *
 * Phase 4 - admin product analytics. Single-page funnel + KPI rollup
 * for the Journey product.
 *
 * Authorization: admin only. Reuses requireExpert() and checks isAdmin.
 */

import { redirect } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  TrendingDown,
  Users,
} from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { getJourneyKPIs } from "@/lib/dashboard/journey-kpis";

export const dynamic = "force-dynamic";

export default async function JourneyAnalyticsPage({
  searchParams,
}: {
  searchParams?: { window?: string };
}) {
  const session = await requireExpert();
  if (!session.isAdmin) {
    // Non-admin clinicians don't see global KPIs - redirect them home.
    redirect("/dashboard/clinician");
  }

  const windowDays = clampWindow(searchParams?.window);
  const kpis = await getJourneyKPIs(windowDays);

  if (!kpis) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Service-role unavailable. Set SUPABASE_SERVICE_ROLE_KEY to view
          analytics.
        </p>
      </div>
    );
  }

  // Funnel ratios (guarded against div-by-zero)
  const ratio = (a: number, b: number): number =>
    b === 0 ? 0 : Math.round((a / b) * 1000) / 10; // 1 decimal

  const completionRate = ratio(kpis.itemsCompleted, kpis.itemsAvailable);
  const responseRate = ratio(kpis.responsesSubmitted, kpis.itemsCompleted);
  const replyRate = ratio(kpis.clinicianReplies, kpis.responsesSubmitted);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Journey analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Where users drop off, where the team is keeping up, where to look
            next. Last {kpis.windowDays} days.
          </p>
        </div>
        <WindowSwitcher current={kpis.windowDays} />
      </header>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi
          label="Entitled users"
          value={kpis.entitledUsers}
          icon={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          label="Assessments completed"
          value={kpis.assessmentCompleted}
          icon={<CheckCircle2 className="size-4" aria-hidden />}
        />
        <Kpi
          label="Items completed"
          value={kpis.itemsCompleted}
          icon={<BookOpen className="size-4" aria-hidden />}
        />
        <Kpi
          label="Avg reply latency"
          value={
            kpis.averageReplyLatencyHours === null
              ? "-"
              : `${kpis.averageReplyLatencyHours}h`
          }
          icon={<MessageSquare className="size-4" aria-hidden />}
        />
      </div>

      {/* Funnel */}
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-4 flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">Funnel</h2>
        </header>
        <FunnelStep
          label="Entitled (active subscribers)"
          value={kpis.entitledUsers}
          base={kpis.entitledUsers}
        />
        <FunnelStep
          label="Started assessment"
          value={kpis.assessmentStarted}
          base={kpis.entitledUsers}
        />
        <FunnelStep
          label="Completed assessment"
          value={kpis.assessmentCompleted}
          base={kpis.entitledUsers}
        />
        <FunnelStep
          label="Has scheduled items"
          value={kpis.itemsScheduled}
          base={kpis.entitledUsers}
          unit="items"
        />
        <FunnelStep
          label="Items available"
          value={kpis.itemsAvailable}
          base={kpis.itemsScheduled}
          unit="items"
        />
        <FunnelStep
          label="Items completed"
          value={kpis.itemsCompleted}
          base={kpis.itemsAvailable}
          unit="items"
        />
        <FunnelStep
          label="Responses submitted"
          value={kpis.responsesSubmitted}
          base={kpis.itemsCompleted}
        />
        <FunnelStep
          label="Clinician replies sent"
          value={kpis.clinicianReplies}
          base={kpis.responsesSubmitted}
        />
      </section>

      {/* Health chips */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HealthCard
          title="Item completion rate"
          value={`${completionRate}%`}
          hint="completed / available"
          tone={completionRate < 30 ? "rose" : completionRate < 60 ? "amber" : "emerald"}
        />
        <HealthCard
          title="Response rate"
          value={`${responseRate}%`}
          hint="responses / completed items"
          tone={responseRate < 30 ? "rose" : responseRate < 60 ? "amber" : "emerald"}
        />
        <HealthCard
          title="Clinician reply rate"
          value={`${replyRate}%`}
          hint="replies / responses"
          tone={replyRate < 50 ? "rose" : replyRate < 80 ? "amber" : "emerald"}
        />
      </section>

      {/* Tag signals */}
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-3 flex items-center gap-2">
          <AlertCircle
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          <h2 className="text-lg font-semibold">Auto-tag signals</h2>
        </header>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <TagStat
            label="Short responses"
            value={kpis.responsesShort}
            base={kpis.responsesSubmitted}
            tone="amber"
            hint="< 25 chars - possibly low engagement"
          />
          <TagStat
            label="Crisis keyword"
            value={kpis.responsesCrisis}
            base={kpis.responsesSubmitted}
            tone="rose"
            hint="needs clinician attention"
          />
          <TagStat
            label="Unread messages"
            value={kpis.messagesUnread}
            base={kpis.messagesSent}
            tone="violet"
            hint="awaiting clinician triage"
          />
        </ul>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Generated {new Date(kpis.generatedAt).toLocaleString()} · window
        {" "}{kpis.windowDays}d
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function clampWindow(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "30", 10);
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(180, n));
}

function WindowSwitcher({ current }: { current: number }) {
  const options = [7, 30, 90];
  return (
    <nav className="inline-flex rounded-full border border-border bg-card p-1">
      {options.map((d) => (
        <a
          key={d}
          href={`/dashboard/journey-analytics?window=${d}`}
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            d === current
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {d}d
        </a>
      ))}
    </nav>
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  base,
  unit,
}: {
  label: string;
  value: number;
  base: number;
  unit?: string;
}) {
  const pct = base === 0 ? 0 : Math.round((value / base) * 100);
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{value.toLocaleString()}</span>
          {unit ? ` ${unit}` : ""}
          <span className="ms-2 text-[11px]">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground/70"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function HealthCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "rose" | "amber" | "emerald";
}) {
  const palette =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-300"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
        : "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  return (
    <div className={["rounded-lg border p-4", palette].join(" ")}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {title}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      <p className="mt-1 text-[11px] opacity-70">{hint}</p>
    </div>
  );
}

function TagStat({
  label,
  value,
  base,
  hint,
  tone,
}: {
  label: string;
  value: number;
  base: number;
  hint: string;
  tone: "rose" | "amber" | "violet";
}) {
  const pct = base === 0 ? 0 : Math.round((value / base) * 100);
  const c =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-violet-700 dark:text-violet-300";
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={["mt-1 text-2xl font-bold tabular-nums", c].join(" ")}>
        {value.toLocaleString()}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {pct}% of total · {hint}
      </p>
    </li>
  );
}
