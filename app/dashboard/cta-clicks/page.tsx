/**
 * /dashboard/cta-clicks — admin CTA-click dashboard.
 *
 * Read-only observability over the generic `click` analytics event, filtered to
 * an explicit allow-list of CTA targets (lib/dashboard/cta-clicks.ts →
 * CTA_TARGETS). Per CTA: total clicks, unique clicks (distinct device_id), and a
 * per-page split. Plus a time trend (hourly for a single day, daily for a range).
 *
 * Same look/gate as the other admin analytics screens: requireAdmin, date-range
 * picker, force-dynamic, admin i18n. Nothing here writes or edits.
 *
 * To add a CTA: instrument the click with track("click", { target, label }) and
 * add one row to CTA_TARGETS — this page picks it up automatically.
 */

import { MousePointerClick, Users, BarChart3 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import {
  resolveCtaRange,
  getCtaClicks,
  type CtaRow,
} from "@/lib/dashboard/cta-clicks";
import { CtaRangePicker } from "@/components/dashboard/CtaRangePicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <div className={"flex items-center gap-1.5 text-xs " + tone}>
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function CtaClicksPage({
  searchParams,
}: {
  searchParams?: { range?: string; from?: string; to?: string };
}) {
  await requireAdmin(); // self-gates (redirects non-admins home)

  const locale = getAdminLocale();
  const isHe = isRtl(locale);
  const range = resolveCtaRange(searchParams);
  const data = await getCtaClicks(range);

  const friendly = (row: CtaRow) => (isHe ? row.labelHe : row.labelEn);
  const maxBucket = Math.max(1, ...data.buckets.map((b) => b.total));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t(locale, "cta.title")}</h1>
          <p className="text-muted-foreground text-sm">{t(locale, "cta.subtitle")}</p>
        </div>
        <CtaRangePicker
          active={range.key}
          from={range.fromInput}
          to={range.toInput}
          locale={locale}
        />
      </div>

      {data.degraded ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          {t(locale, "cta.degraded")}
        </p>
      ) : (
        <>
          {data.capped ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              {t(locale, "cta.capped")}
            </p>
          ) : null}

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <StatTile
              icon={<MousePointerClick className="size-3.5" />}
              label={t(locale, "cta.total")}
              value={data.totalClicks}
              tone="text-sky-500"
            />
            <StatTile
              icon={<Users className="size-3.5" />}
              label={t(locale, "cta.unique")}
              value={data.totalUnique}
              tone="text-emerald-500"
            />
          </div>

          {/* Per-CTA table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(locale, "cta.per_cta")}</CardTitle>
              <CardDescription>{t(locale, "cta.per_cta_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-xs uppercase tracking-wide">
                    <th className="py-2 text-start font-medium">{t(locale, "cta.col.button")}</th>
                    <th className="py-2 text-start font-medium">{t(locale, "cta.col.page")}</th>
                    <th className="py-2 text-end font-medium">{t(locale, "cta.col.total")}</th>
                    <th className="py-2 text-end font-medium">{t(locale, "cta.col.unique")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const pages = row.paths.length;
                    return (
                      <Fragment key={row.target}>
                        {/* CTA summary row */}
                        <tr className="border-border border-b last:border-0">
                          <td className="py-2.5 pe-3 align-top">
                            <div className="font-medium">{friendly(row)}</div>
                            <div className="text-muted-foreground font-mono text-[11px]">{row.target}</div>
                          </td>
                          <td className="text-muted-foreground py-2.5 pe-3 align-top">
                            {pages === 0
                              ? "—"
                              : pages === 1
                                ? <span className="font-mono text-xs">{row.paths[0].path}</span>
                                : <Badge variant="outline">{t(locale, "cta.pages_count").replace("{n}", String(pages))}</Badge>}
                          </td>
                          <td className="py-2.5 text-end align-top font-semibold tabular-nums">{row.total}</td>
                          <td className="py-2.5 text-end align-top tabular-nums">{row.unique}</td>
                        </tr>
                        {/* Per-page breakdown (only when a CTA spans >1 page) */}
                        {pages > 1
                          ? row.paths.map((p) => (
                              <tr key={row.target + p.path} className="border-border/60 border-b last:border-0">
                                <td className="py-1.5 pe-3" />
                                <td className="text-muted-foreground py-1.5 pe-3 font-mono text-xs">↳ {p.path}</td>
                                <td className="text-muted-foreground py-1.5 text-end tabular-nums">{p.total}</td>
                                <td className="text-muted-foreground py-1.5 text-end tabular-nums">{p.unique}</td>
                              </tr>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Time trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t(locale, data.granularity === "hour" ? "cta.trend_hourly" : "cta.trend_daily")}
              </CardTitle>
              <CardDescription>
                <BarChart3 className="me-1 inline size-3.5" />
                {t(locale, "cta.trend_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.buckets.every((b) => b.total === 0) ? (
                <p className="text-muted-foreground text-sm">{t(locale, "cta.no_data")}</p>
              ) : (
                <div className="space-y-1">
                  {data.buckets.map((b) => (
                    <div key={b.startIso} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-12 shrink-0 text-end font-mono text-[11px] tabular-nums">
                        {b.label}
                      </span>
                      <div className="bg-muted/40 h-4 flex-1 overflow-hidden rounded">
                        <div
                          className="bg-primary/70 h-full rounded"
                          style={{ width: `${Math.round((b.total / maxBucket) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-end text-xs tabular-nums">{b.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
