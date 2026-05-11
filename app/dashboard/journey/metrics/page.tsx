/**
 * /dashboard/journey/metrics
 *
 * Phase 3 — single-screen admin dashboard. Cross-system KPIs for the
 * Journey product: subscriptions, completion, replies, drift, coach
 * load, category heat, stage funnel, alerts.
 *
 * Server component — fans out the metric calls in parallel via
 * Promise.all and renders. Heavy queries cached for ~60s by Next's
 * default `force-dynamic` semantics; admin can hit Refresh.
 */

import Link from "next/link";
import {
  ArrowLeft, Activity, Users as UsersIcon, MessageSquare,
  Clock, Sparkles, AlertCircle, ExternalLink, TrendingUp, TrendingDown,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getJourneyKPIs,
  getCoachLoad,
  getCategoryHeat,
  getStageFunnel,
  getAdminAlerts,
  getUrgentUserMessages,
} from "@/lib/journey/metrics";
import { Badge } from "@/components/ui/badge";
import { BackfillClassifierButton } from "@/components/dashboard/journey/BackfillClassifierButton";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { SectionHelp } from "@/components/dashboard/SectionHelp";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<number, string> = {
  1: "יסודות",
  2: "העמקה",
  3: "אינטגרציה",
  4: "הבשלה",
};

const ALERT_ICON: Record<string, React.ReactNode> = {
  drift:             <AlertCircle className="size-4 text-amber-500" />,
  coach_backlog:     <Clock        className="size-4 text-rose-500" />,
  stale_item:        <AlertCircle className="size-4 text-slate-500" />,
  negative_feedback: <AlertCircle className="size-4 text-rose-500" />,
};

export default async function JourneyMetricsPage() {
  await requireAdmin();
  const locale = getAdminLocale();

  const [kpis, coaches, categoryHeat, funnel, alerts, urgent] = await Promise.all([
    getJourneyKPIs(),
    getCoachLoad(),
    getCategoryHeat(),
    getStageFunnel(),
    getAdminAlerts(),
    getUrgentUserMessages(15),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          {t(locale, "btn.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">
              {t(locale, "journey.metrics.title")}
            </h1>
            <SectionHelp
              title="מטריקות פלטפורמה"
              body={
                <>
                  <p>
                    KPIs חוצי־מערכת. מסך אחד שאתם פותחים פעם ביום לבדיקת
                    דופק כללי של הפלטפורמה.
                  </p>
                  <p><strong>מה רואים:</strong></p>
                  <ul className="list-disc space-y-1 ps-5 text-[13px]">
                    <li>4 KPIs עליונים — בעלים פעילים, אחוז השלמה, זמן
                      תגובה ממוצע, drift</li>
                    <li>עומס מאמנים — כמה זוגות פר מאמן, כמה הודעות 30
                      יום, כמה threads פתוחים</li>
                    <li>Funnel שלבים — איפה זוגות &quot;נתקעים&quot; במסע</li>
                    <li>חום קטגוריות — איזה תחום פעיל יותר השבוע</li>
                    <li>הודעות דחופות + מדאיגות — רשימת AI</li>
                    <li>Attention list — drift cohorts + פריטים גרועים</li>
                  </ul>
                </>
              }
              aiNote={
                <>
                  <p>
                    הפאנל &quot;Concerning + urgent&quot; מתבסס לחלוטין על
                    סיווג Claude. אם הוא ריק — או שאין הודעות בעייתיות, או
                    שה-AI עוד לא רץ על ההיסטוריה.
                  </p>
                  <p className="mt-1.5">
                    <strong>הריצו את &quot;הרץ מסווג&quot;</strong> פעם אחת
                    בהתחלה — מסווג עד 500 הודעות אחורה. עלות ~$0.10. אחרי
                    זה הודעות חדשות מסווגות אוטומטית.
                  </p>
                </>
              }
            />
          </span>
          <span className="text-muted-foreground text-xs">
            {t(locale, "journey.metrics.refreshed")} · {new Date().toLocaleString("he-IL")}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          {t(locale, "journey.metrics.subtitle")}
        </p>
      </div>

      {/* Top KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<UsersIcon className="size-5" />}
          label={t(locale, "journey.metrics.kpi_active")}
          value={kpis.activeOwners}
          hint={`${kpis.activeAssignments} ${t(locale, "journey.metrics.kpi_active_hint")}`}
        />
        <KpiCard
          icon={<Activity className="size-5" />}
          label={t(locale, "journey.metrics.kpi_completion")}
          value={`${kpis.completionRate30d}%`}
          hint={`${kpis.completionsLast30d} / ${kpis.unlockedItemsLast30d} ${t(locale, "journey.metrics.kpi_completion_hint")}`}
        />
        <KpiCard
          icon={<Clock className="size-5" />}
          label={t(locale, "journey.metrics.kpi_reply")}
          value={
            kpis.avgReplyHours30d != null
              ? `${kpis.avgReplyHours30d}h`
              : "—"
          }
          hint={t(locale, "journey.metrics.kpi_reply_hint")}
        />
        <KpiCard
          icon={<AlertCircle className="size-5" />}
          label={t(locale, "journey.metrics.kpi_drifting")}
          value={kpis.driftingCouples}
          hint={`${kpis.activeCouples} ${t(locale, "journey.metrics.kpi_drifting_hint")}`}
          tone={kpis.driftingCouples > 5 ? "amber" : "default"}
        />
      </div>

      {/* Second row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<MessageSquare className="size-5" />}
          label={t(locale, "journey.metrics.kpi_msgs7d")}
          value={kpis.expertMessages7d}
        />
        <KpiCard
          icon={<Sparkles className="size-5" />}
          label={t(locale, "journey.metrics.kpi_comp7d")}
          value={kpis.completionsLast7d}
        />
        <KpiCard
          icon={<TrendingUp className="size-5" />}
          label={t(locale, "journey.metrics.kpi_comp30d")}
          value={kpis.completionsLast30d}
        />
      </div>

      {/* Coach load + Stage funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border bg-card rounded-lg border">
          <header className="border-b border-border p-3">
            <h2 className="text-sm font-semibold">{t(locale, "journey.metrics.coach_load")}</h2>
            <p className="text-muted-foreground text-xs">
              {t(locale, "journey.metrics.coach_load_hint")}
            </p>
          </header>
          <ul className="divide-border divide-y">
            {coaches.length === 0 ? (
              <li className="text-muted-foreground p-3 text-xs">
                {t(locale, "journey.metrics.no_coach_activity")}
              </li>
            ) : (
              coaches.map((c) => (
                <li key={c.expertId} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name_he}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {c.activeCouples} {t(locale, "journey.metrics.couples")} · {c.messages30d} {t(locale, "journey.metrics.msgs")}
                    </div>
                  </div>
                  {c.openThreads > 0 ? (
                    <Badge variant={c.openThreads > 5 ? "destructive" : "secondary"}>
                      {c.openThreads} {t(locale, "journey.metrics.open")}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">{t(locale, "journey.metrics.caught_up")}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="border-border bg-card rounded-lg border">
          <header className="border-b border-border p-3">
            <h2 className="text-sm font-semibold">{t(locale, "journey.metrics.stage_funnel")}</h2>
            <p className="text-muted-foreground text-xs">
              {t(locale, "journey.metrics.stage_funnel_hint")}
            </p>
          </header>
          <ul className="divide-border divide-y">
            {funnel.map((s) => (
              <li
                key={s.stage}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {t(locale, "journey.metrics.stage")} {s.stage} · {STAGE_LABEL[s.stage] ?? "?"}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {s.itemsInCatalog} {t(locale, "journey.metrics.items_in_catalog")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">
                    {s.ownersReached}
                  </div>
                  <div className="text-muted-foreground text-[11px]">{t(locale, "journey.metrics.owners_reached")}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Category heat */}
      <section className="border-border bg-card rounded-lg border">
        <header className="border-b border-border p-3">
          <h2 className="text-sm font-semibold">{t(locale, "journey.metrics.cat_heat")}</h2>
          <p className="text-muted-foreground text-xs">
            {t(locale, "journey.metrics.cat_heat_hint")}
          </p>
        </header>
        <ul className="divide-border divide-y">
          {categoryHeat.length === 0 ? (
            <li className="text-muted-foreground p-3 text-xs">
              {t(locale, "journey.metrics.no_completions")}
            </li>
          ) : (
            categoryHeat.map((c) => (
              <li
                key={c.key}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{c.name_he}</div>
                  <div className="text-muted-foreground text-[11px] font-mono">
                    {c.key}
                  </div>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-muted-foreground text-[11px]">
                    {c.completions7d} (7d) · {c.completions30d} (30d)
                  </span>
                  {c.woWPct !== 0 ? (
                    <Badge
                      variant={c.woWPct > 0 ? "default" : "secondary"}
                      className="font-mono text-[10px]"
                    >
                      {c.woWPct > 0 ? <TrendingUp className="me-0.5 size-3" /> : <TrendingDown className="me-0.5 size-3" />}
                      {Math.abs(c.woWPct)}%
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Urgent / concerning user messages — Phase 4 AI */}
      <section className="border-border bg-card rounded-lg border">
        <header className="space-y-2 border-b border-border p-3">
          <div>
            <h2 className="text-sm font-semibold">
              {t(locale, "journey.metrics.urgent_panel")}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t(locale, "journey.metrics.urgent_panel_hint")}
            </p>
          </div>
          <BackfillClassifierButton locale={locale} />
        </header>
        <ul className="divide-border divide-y">
          {urgent.length === 0 ? (
            <li className="text-muted-foreground p-4 text-center text-xs">
              {t(locale, "journey.metrics.urgent_empty")}
            </li>
          ) : (
            urgent.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-1.5 p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant={u.sentiment === "urgent" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {u.sentiment === "urgent" ? "🚨 urgent" : "concerning"}
                  </Badge>
                  <span className="font-medium">{u.couple_label}</span>
                  <span className="text-muted-foreground text-[11px] ms-auto">
                    {new Date(u.created_at).toLocaleString("he-IL", {
                      month: "2-digit",
                      day:   "2-digit",
                      hour:  "2-digit",
                      minute:"2-digit",
                    })}
                  </span>
                  <Link
                    href={u.drill_href}
                    className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Open
                  </Link>
                </div>
                {u.auto_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {u.auto_tags.map((t) => (
                      <span
                        key={t}
                        className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm leading-snug text-foreground/90">
                  {u.body_preview}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Alerts */}
      <section className="border-border bg-card rounded-lg border">
        <header className="border-b border-border p-3">
          <h2 className="text-sm font-semibold">Attention list</h2>
          <p className="text-muted-foreground text-xs">
            Items needing the admin&apos;s eyes today. Empty = healthy.
          </p>
        </header>
        <ul className="divide-border divide-y">
          {alerts.length === 0 ? (
            <li className="text-muted-foreground p-4 text-center text-xs">
              ✨ Nothing flagged. Platform looks calm.
            </li>
          ) : (
            alerts.map((a, i) => (
              <li
                key={`${a.kind}-${i}`}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {ALERT_ICON[a.kind] ?? <AlertCircle className="size-4" />}
                  <div className="min-w-0">
                    <div className="font-medium">{a.label}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {a.detail}
                    </div>
                  </div>
                </div>
                {a.href ? (
                  <Link
                    href={a.href}
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Open
                  </Link>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="text-muted-foreground pt-2 text-center text-[11px]">
        Phase 3 V1 — KPIs only. Cohort retention curves, completion-by-stage
        heatmap, and per-coach quality scores ship in V2.
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={
        "border-border bg-card rounded-lg border p-4 " +
        (tone === "amber" ? "border-amber-300/30 bg-amber-500/[0.03]" : "")
      }
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </div>
  );
}
