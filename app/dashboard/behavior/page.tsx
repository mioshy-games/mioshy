/**
 * /dashboard/behavior — aggregate behavior insights (admin-analytics-spec §7.3,
 * Phase 5). "What works and what doesn't": content opened/completed/abandoned
 * (v_chapter_funnel), abandonment by context (v_abandonment), peak login hours
 * (auth_login_events), and average dwell per pillar (v_service_dwell).
 *
 * All reads go through the service-role client (the views are RLS-locked to
 * service_role) behind requireAdmin. Metadata only (privacy approach A, §10.1)
 * — chapter titles are curriculum metadata, never user content. Charts are pure
 * SVG/CSS (no charting dependency is installed and we must not npm install).
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const HOURS_SAMPLE = 10000; // cap on recent logins scanned for the peak-hours chart
const JERUSALEM_TZ = "Asia/Jerusalem";

function jHour(iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: JERUSALEM_TZ, hour: "2-digit", hour12: false }).format(new Date(iso));
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n % 24 : 0;
}

export default async function BehaviorInsightsPage() {
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

  const [funnelRes, abandonRes, hoursRes, dwellRes] = await Promise.all([
    admin.from("v_chapter_funnel").select("item_id, opened_count, completed_count, abandoned_count").order("opened_count", { ascending: false }).limit(15),
    admin.from("v_abandonment").select("context, started, abandoned, abandonment_pct"),
    admin.from("auth_login_events").select("created_at").order("created_at", { ascending: false }).limit(HOURS_SAMPLE),
    admin.from("v_service_dwell").select("pillar, total_ms").limit(5000),
  ]);

  const funnel = (funnelRes.data ?? []) as { item_id: string; opened_count: number; completed_count: number; abandoned_count: number }[];

  // Chapter titles (curriculum metadata) for the funnel rows — one batched read.
  const itemIds = funnel.map((f) => f.item_id);
  const titlesRes = itemIds.length
    ? await admin.from("journey_items").select("id, title_he, title_en").in("id", itemIds)
    : { data: [] };
  const titleMap = new Map<string, string>();
  for (const r of (titlesRes.data ?? []) as { id: string; title_he: string | null; title_en: string | null }[]) {
    titleMap.set(r.id, (locale === "he" ? r.title_he : r.title_en) || r.title_he || r.title_en || r.id);
  }

  const abandon = (abandonRes.data ?? []) as { context: string; started: number; abandoned: number; abandonment_pct: number | null }[];

  // Peak hours histogram (Israel time) from the recent login sample.
  const hours = Array.from({ length: 24 }, () => 0);
  for (const r of (hoursRes.data ?? []) as { created_at: string }[]) hours[jHour(r.created_at)] += 1;
  const maxHour = Math.max(1, ...hours);

  // Average dwell per pillar (ms → minutes) across users.
  const dwellAgg = new Map<string, { totalMs: number; n: number }>();
  for (const r of (dwellRes.data ?? []) as { pillar: string; total_ms: number }[]) {
    const cur = dwellAgg.get(r.pillar) ?? { totalMs: 0, n: 0 };
    cur.totalMs += Number(r.total_ms ?? 0);
    cur.n += 1;
    dwellAgg.set(r.pillar, cur);
  }
  const dwellRows = ["journey", "games", "adults"].map((p) => {
    const a = dwellAgg.get(p);
    return { pillar: p, avgMin: a && a.n ? a.totalMs / a.n / 60000 : 0, users: a?.n ?? 0 };
  });
  const maxDwell = Math.max(0.1, ...dwellRows.map((d) => d.avgMin));

  const maxOpened = Math.max(1, ...funnel.map((f) => f.opened_count));

  return (
    <div className="flex flex-col gap-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{tt("insights.title")}</h1>
        <p className="text-sm text-muted-foreground">{tt("insights.desc")}</p>
      </div>

      {/* ── Chapter funnel ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{tt("insights.chapter_funnel")}</CardTitle>
          <CardDescription>{tt("insights.chapter_funnel_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {funnel.length ? (
            funnel.map((f) => (
              <div key={f.item_id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium" dir="auto">{titleMap.get(f.item_id) ?? f.item_id}</span>
                  <span className="flex shrink-0 gap-2 text-xs">
                    <Badge variant="secondary">{tt("insights.opened")} {f.opened_count}</Badge>
                    <Badge variant="default">{tt("insights.completed")} {f.completed_count}</Badge>
                    <Badge variant={f.abandoned_count ? "destructive" : "outline"}>{tt("insights.abandoned")} {f.abandoned_count}</Badge>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-white/5">
                  <div
                    className="h-full rounded bg-emerald-500/70"
                    style={{ width: `${(f.completed_count / maxOpened) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <Empty text={tt("insights.no_data")} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Abandonment by context ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{tt("insights.abandonment")}</CardTitle>
            <CardDescription>{tt("insights.abandonment_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {abandon.length ? (
              abandon.map((a) => (
                <BarRow
                  key={a.context}
                  label={tt(`insights.ctx_${a.context}`)}
                  pct={a.abandonment_pct ?? 0}
                  value={`${a.abandonment_pct ?? 0}% · ${a.abandoned}/${a.started}`}
                  color="bg-rose-500/70"
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>

        {/* ── Average dwell per pillar ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{tt("insights.dwell_avg")}</CardTitle>
            <CardDescription>{tt("insights.dwell_avg_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dwellRows.some((d) => d.users) ? (
              dwellRows.map((d) => (
                <BarRow
                  key={d.pillar}
                  label={tt(`customers.pillar_${d.pillar}`)}
                  pct={(d.avgMin / maxDwell) * 100}
                  value={`${d.avgMin.toFixed(1)} ${tt("behavior.minutes")} · ${d.users}`}
                  color="bg-indigo-500/70"
                />
              ))
            ) : (
              <Empty text={tt("insights.no_data")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Peak hours ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{tt("insights.peak_hours")}</CardTitle>
          <CardDescription>{tt("insights.peak_hours_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1" dir="ltr" style={{ height: 120 }}>
            {hours.map((c, h) => (
              <div key={h} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${String(h).padStart(2, "0")}:00 — ${c}`}>
                <div className="w-full rounded-t bg-amber-400/70" style={{ height: `${(c / maxHour) * 100}%`, minHeight: c ? 2 : 0 }} />
                <span className="text-[9px] text-muted-foreground">{h}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function BarRow({ label, pct, value, color }: { label: string; pct: number; value: string; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-white/5">
        <div className={`h-full rounded ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
