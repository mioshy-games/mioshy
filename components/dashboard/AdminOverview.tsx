/**
 * AdminOverview — admin-only overview block at the top of /dashboard.
 *
 * Server component: resolves the date range from searchParams, fetches the four
 * range-scoped metrics (+ %-change vs the previous period) and the inquiries
 * list via lib/dashboard/overview.ts, then renders compact metric tiles (each a
 * drill-down link) + the inquiries table. Reuses the existing pending-replies
 * source of truth — it does not introduce a second one.
 */

import Link from "next/link";
import {
  UserPlus,
  Gamepad2,
  Flame,
  MessageCircle,
  HeartHandshake,
  Route,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  resolveRange,
  getOverviewData,
  type MetricDelta,
} from "@/lib/dashboard/overview";
import { OverviewRangePicker } from "./OverviewRangePicker";
import { InquiriesTable, type InquiryTableRow } from "./InquiriesTable";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

function Pct({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return null;
  const up = pct > 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] " +
        (up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")
      }
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

function MetricTile({
  href,
  icon,
  label,
  m,
  sub,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  m: MetricDelta;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-accent/40 block rounded-lg border p-4 transition"
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{m.current}</span>
        <Pct pct={m.pct} />
      </div>
      {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
    </Link>
  );
}

export async function AdminOverview({
  searchParams,
  locale,
}: {
  searchParams?: { range?: string; from?: string; to?: string };
  locale: AdminLocale;
}) {
  const range = resolveRange(searchParams);
  const data = await getOverviewData(range);

  const rows: InquiryTableRow[] = data.inquiries.map((r) => ({
    userId: r.userId,
    coupleId: r.coupleId,
    displayName: r.displayName,
    phone: r.phone,
    email: r.email,
    inquiryAt: r.lastUserMessageAt,
    assessmentDone: r.assessmentDone,
    replyPending: r.replyPending,
  }));

  const awaiting = t(locale, "overview.metric.awaiting").replace(
    "{n}",
    String(data.awaitingReply),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{t(locale, "overview.title")}</h2>
          <p className="text-muted-foreground text-xs">{t(locale, "overview.subtitle")}</p>
        </div>
        <OverviewRangePicker
          active={range.key}
          from={range.fromInput}
          to={range.toInput}
          locale={locale}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          href="/dashboard/users"
          icon={<UserPlus className="size-3.5" />}
          label={t(locale, "overview.metric.signups")}
          m={data.signups}
        />
        <MetricTile
          href="/dashboard/subscriptions"
          icon={<Gamepad2 className="size-3.5" />}
          label={t(locale, "overview.metric.subs_games")}
          m={data.gamesSubs}
        />
        <MetricTile
          href="/dashboard/users?pillar=journey&coaching=with"
          icon={<HeartHandshake className="size-3.5" />}
          label={t(locale, "overview.metric.journey_coach")}
          m={data.journeyCoachSubs}
        />
        <MetricTile
          href="/dashboard/users?pillar=journey&coaching=without"
          icon={<Route className="size-3.5" />}
          label={t(locale, "overview.metric.journey_nocoach")}
          m={data.journeyNoCoachSubs}
        />
        <MetricTile
          href="/dashboard/subscriptions"
          icon={<Flame className="size-3.5" />}
          label={t(locale, "overview.metric.sex_buy")}
          m={data.sexPurchases}
        />
        <MetricTile
          href="/dashboard/journey/replies"
          icon={<MessageCircle className="size-3.5" />}
          label={t(locale, "overview.metric.chat")}
          m={data.chatInquiries}
          sub={awaiting}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t(locale, "overview.inq.title")}</h3>
        <InquiriesTable rows={rows} locale={locale} />
      </div>
    </section>
  );
}
