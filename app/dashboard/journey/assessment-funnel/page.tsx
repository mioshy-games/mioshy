/**
 * /dashboard/journey/assessment-funnel — the JOURNEY-assessment funnel
 * (journey-assessment-funnel-brief §C). Separate page from the standalone
 * assessment funnel (/dashboard/assessments/analytics).
 *
 * Admin-only (requireAdmin → non-admins redirected). Reads
 * loadJourneyAssessmentFunnel with the service-role client. Controls (date
 * range, day/week) live in the URL via a native GET form — no client state, no
 * assessment selector (single assessment). Charts are pure SVG/CSS. Metadata
 * only (privacy approach A) — ids/counts/timestamps/dwell ms, never content.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import {
  loadJourneyAssessmentFunnel,
  type FunnelGranularity,
} from "@/lib/dashboard/journey-assessment-funnel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const JERUSALEM_TZ = "Asia/Jerusalem";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function jToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function pct(a: number, b: number): number | null {
  return b > 0 ? Math.round((a / b) * 100) : null;
}

function dwellLabel(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 60_000 ? `${(ms / 60_000).toFixed(1)}m` : `${Math.round(ms / 1000)}s`;
}

export default async function JourneyAssessmentFunnelPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; granularity?: string };
}) {
  await requireAdmin();
  const locale = getAdminLocale();
  const tt = (k: string) => t(locale, k);
  const rtl = isRtl(locale);
  const admin = createServiceRoleClient();

  if (!admin) {
    return (
      <div className="p-6" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-sm text-muted-foreground">{tt("insights.no_service_role")}</p>
      </div>
    );
  }

  const to = searchParams?.to && DATE_RE.test(searchParams.to) ? searchParams.to : jToday();
  const from =
    searchParams?.from && DATE_RE.test(searchParams.from)
      ? searchParams.from
      : addDays(to, -29);
  const granularity: FunnelGranularity =
    searchParams?.granularity === "week" ? "week" : "day";

  const funnel = await loadJourneyAssessmentFunnel(admin, { from, to, granularity });
  const { totals, completedShortFromDb, conversions, buckets, dropoffShort, dropoffFull, behavioral, warnings } = funnel;

  // ── Funnel stages, in order (short + long stages explicit) ─────────────────
  const stages: { label: string; value: number; extra?: string }[] = [
    { label: tt("af.stage.intro"), value: totals.introViews },
    { label: tt("af.stage.started"), value: totals.started },
    {
      label: tt("jaf.stage.completed_short"),
      value: totals.completedShort,
      extra: `${tt("af.completed_db")} ${completedShortFromDb}`,
    },
    { label: tt("af.stage.registered"), value: totals.registered },
    { label: tt("af.stage.purchased"), value: totals.purchased },
    { label: tt("jaf.stage.full_started"), value: totals.fullStarted },
    {
      label: tt("jaf.stage.full_completed"),
      value: totals.fullCompleted,
      extra: `${tt("jaf.full_rate")} ${conversions.fullCompletedRate ?? "—"}%`,
    },
    { label: tt("af.stage.partner_invited"), value: totals.partnerInvited },
    {
      label: tt("af.stage.partner_joined"),
      value: totals.partnerJoined,
      extra: `${tt("af.join_rate")} ${conversions.partnerJoinRate ?? "—"}%`,
    },
    { label: tt("af.stage.first_chapter"), value: totals.firstChapterViewed },
  ];
  const maxIntro = Math.max(1, totals.introViews);

  const maxShortStuck = Math.max(1, ...dropoffShort.map((d) => d.stuck));
  const maxFullStuck = Math.max(1, ...dropoffFull.map((d) => d.stuck));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.introViews));
  const maxRef = Math.max(1, ...behavioral.topReferrers.map((r) => r.sessions));
  const maxExit = Math.max(1, ...behavioral.exitTargets.map((e) => e.count));

  const series: { key: "introViews" | "started" | "completedShort" | "registered"; color: string; label: string }[] = [
    { key: "introViews", color: "bg-sky-400/80", label: tt("af.stage.intro") },
    { key: "started", color: "bg-violet-400/80", label: tt("af.stage.started") },
    { key: "completedShort", color: "bg-emerald-400/80", label: tt("jaf.stage.completed_short") },
    { key: "registered", color: "bg-amber-400/80", label: tt("af.stage.registered") },
  ];

  return (
    <div className="flex flex-col gap-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{tt("jaf.title")}</h1>
        <p className="text-sm text-muted-foreground">{tt("jaf.desc")}</p>
      </div>

      {/* ── Controls (native GET form — no client state, no assessment selector) ── */}
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {tt("af.controls.from")}
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {tt("af.controls.to")}
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {tt("af.controls.granularity")}
              <select
                name="granularity"
                defaultValue={granularity}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="day">{tt("af.controls.day")}</option>
                <option value="week">{tt("af.controls.week")}</option>
              </select>
            </label>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {tt("af.controls.apply")}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* ── Degradation banner ───────────────────────────────────────────── */}
      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            {tt("af.warnings.title")}
          </p>
          <p className="mt-0.5 text-muted-foreground">{tt("af.warnings.desc")}</p>
          <ul className="mt-1 list-disc ps-5 text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i} dir="ltr" className="font-mono">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Funnel ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{tt("af.funnel.title")}</CardTitle>
          <CardDescription>{tt("af.funnel.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stages.map((s, i) => {
            const conv = i > 0 ? pct(s.value, stages[i - 1].value) : null;
            return (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {s.label}
                    {s.extra ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {s.extra}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                    {i > 0 ? (
                      <span className="text-xs text-muted-foreground">→ {conv ?? "—"}%</span>
                    ) : null}
                    <span className="font-semibold">{s.value}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded bg-white/5">
                  <div
                    className="h-full rounded bg-gradient-to-r from-fuchsia-500/70 to-sky-500/70"
                    style={{ width: `${(s.value / maxIntro) * 100}%`, minWidth: s.value ? 2 : 0 }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Drop-off: two tables (short + long) ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tt("jaf.dropoff_short.title")}</CardTitle>
            <CardDescription>{tt("jaf.dropoff.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dropoffShort.length ? (
              dropoffShort.map((d) => (
                <BarRow
                  key={d.step}
                  label={`${tt("af.dropoff.step")} ${d.step}`}
                  pct={(d.stuck / maxShortStuck) * 100}
                  value={`${d.stuck} · ${d.pct ?? "—"}%`}
                  color="bg-rose-500/70"
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tt("jaf.dropoff_full.title")}</CardTitle>
            <CardDescription>{tt("jaf.dropoff.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dropoffFull.length ? (
              dropoffFull.map((d) => (
                <BarRow
                  key={d.step}
                  label={`${tt("af.dropoff.step")} ${d.step}`}
                  pct={(d.stuck / maxFullStuck) * 100}
                  value={`${d.stuck} · ${d.pct ?? "—"}%`}
                  color="bg-orange-500/70"
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Behavioural stats ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{tt("af.behavioral.title")}</CardTitle>
          <CardDescription>
            {from} → {to}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Stat label={tt("af.pages_avg")} value={behavioral.avgPagesPerSession ?? "—"} />
          <Stat label={tt("af.dwell_avg")} value={dwellLabel(behavioral.avgDwellMs)} />
        </CardContent>
      </Card>

      {/* ── Time series ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{tt("af.timeseries.title")}</CardTitle>
          <CardDescription>{tt("af.timeseries.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {buckets.length ? (
            <>
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {series.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.color}`} />
                    {s.label}
                  </span>
                ))}
              </div>
              <div className="flex items-end gap-2 overflow-x-auto" dir="ltr" style={{ height: 140 }}>
                {buckets.map((b) => (
                  <div key={b.bucket} className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1">
                    <div className="flex h-[110px] w-full items-end justify-center gap-[2px]">
                      {series.map((s) => (
                        <div
                          key={s.key}
                          className={`w-full max-w-[8px] rounded-t ${s.color}`}
                          style={{ height: `${(b[s.key] / maxBucket) * 100}%`, minHeight: b[s.key] ? 2 : 0 }}
                          title={`${b.bucket} · ${s.label}: ${b[s.key]}`}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{b.bucket.slice(5)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty text={tt("insights.no_data")} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Top referrers ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{tt("af.referrers.title")}</CardTitle>
            <CardDescription>{tt("af.referrers.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {behavioral.topReferrers.length ? (
              behavioral.topReferrers.map((r) => (
                <BarRow
                  key={r.referrer}
                  label={r.referrer}
                  pct={(r.sessions / maxRef) * 100}
                  value={`${r.sessions} ${tt("af.sessions")}`}
                  color="bg-sky-500/70"
                  ltr
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>

        {/* ── Exit targets ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{tt("af.exits.title")}</CardTitle>
            <CardDescription>{tt("af.exits.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {behavioral.exitTargets.length ? (
              behavioral.exitTargets.map((e) => (
                <BarRow
                  key={e.path}
                  label={e.path}
                  pct={(e.count / maxExit) * 100}
                  value={String(e.count)}
                  color="bg-indigo-500/70"
                  ltr
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  pct,
  value,
  color,
  ltr,
}: {
  label: string;
  pct: number;
  value: string;
  color: string;
  ltr?: boolean;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium" dir={ltr ? "ltr" : "auto"}>
          {label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-white/5">
        <div className={`h-full rounded ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
