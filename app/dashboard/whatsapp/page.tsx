/**
 * /dashboard/whatsapp — admin WhatsApp campaign dashboard (View 1).
 *
 * Read-only observability over public.whatsapp_messages, in the same shape /
 * look&feel as the other admin analytics screens (requireAdmin gate, date-range
 * picker, force-dynamic, i18n). Per campaign template it shows the send funnel
 * (sent → delivered → read), failures, would_send (safe-test), and skipped rows
 * broken down by reason. Nothing here sends or edits — see
 * lib/dashboard/whatsapp-overview.ts for the data layer.
 *
 * Per-user history (View 2) lives on the user profile page (/dashboard/users/[id]).
 */

import {
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Clock,
  MinusCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { resolveRange } from "@/lib/dashboard/overview";
import {
  getWhatsAppCampaignData,
  type CampaignStats,
} from "@/lib/dashboard/whatsapp-overview";
import { OverviewRangePicker } from "@/components/dashboard/OverviewRangePicker";
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

function CampaignCard({
  stats,
  locale,
}: {
  stats: CampaignStats;
  locale: ReturnType<typeof getAdminLocale>;
}) {
  const reasons = Object.entries(stats.skippedByReason);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="font-mono text-base">
            {t(locale, `whatsapp.tpl.${stats.template}`)}
          </CardTitle>
          <CardDescription>
            {t(locale, "whatsapp.total")}: {stats.total}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            icon={<Send className="size-3.5" />}
            label={t(locale, "whatsapp.stat.sent")}
            value={stats.sent}
            tone="text-sky-500"
          />
          <StatTile
            icon={<CheckCheck className="size-3.5" />}
            label={t(locale, "whatsapp.stat.delivered")}
            value={stats.delivered}
            tone="text-indigo-500"
          />
          <StatTile
            icon={<Eye className="size-3.5" />}
            label={t(locale, "whatsapp.stat.read")}
            value={stats.read}
            tone="text-emerald-500"
          />
          <StatTile
            icon={<XCircle className="size-3.5" />}
            label={t(locale, "whatsapp.stat.failed")}
            value={stats.failed}
            tone="text-red-500"
          />
          <StatTile
            icon={<Clock className="size-3.5" />}
            label={t(locale, "whatsapp.stat.would_send")}
            value={stats.wouldSend}
            tone="text-amber-500"
          />
          <StatTile
            icon={<MinusCircle className="size-3.5" />}
            label={t(locale, "whatsapp.stat.skipped")}
            value={stats.skipped}
            tone="text-muted-foreground"
          />
        </div>

        {reasons.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t(locale, "whatsapp.skipped_by_reason")}:
            </span>
            {reasons.map(([reason, n]) => (
              <Badge key={reason} variant="outline" className="gap-1">
                {t(locale, `whatsapp.reason.${reason}`)}
                <span className="tabular-nums font-semibold">{n}</span>
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function WhatsAppDashboardPage({
  searchParams,
}: {
  searchParams?: { range?: string; from?: string; to?: string };
}) {
  await requireAdmin();
  const locale = getAdminLocale();
  const rtl = isRtl(locale);

  const range = resolveRange(searchParams);
  const data = await getWhatsAppCampaignData(range);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t(locale, "whatsapp.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t(locale, "whatsapp.subtitle")}
          </p>
        </div>
        <OverviewRangePicker
          active={range.key}
          from={range.fromInput}
          to={range.toInput}
          locale={locale}
        />
      </div>

      {data.degraded ? (
        <p className="text-muted-foreground text-sm">
          {t(locale, "whatsapp.no_service_role")}
        </p>
      ) : (
        <div className="space-y-4">
          {data.rows.map((stats) => (
            <CampaignCard key={stats.template} stats={stats} locale={locale} />
          ))}
        </div>
      )}

      {/* already-sent is the idempotency guard: it returns without writing a
          journal row, so it never appears in the skipped breakdown above. */}
      <p className="text-muted-foreground text-xs">
        {t(locale, "whatsapp.note_already_sent")}
      </p>
    </div>
  );
}
