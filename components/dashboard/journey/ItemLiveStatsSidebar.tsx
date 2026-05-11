// ============================================================
// ItemLiveStatsSidebar - slice 9 read-only stats panel for the
// catalog item editor. Server-rendered, no interactivity.
//
// Layout: a card of 5 stats - queued / delivered / completed / skipped
// / avg-days-to-first-response - each with a hint of what drives them.
// ============================================================

import {
  AlarmClockOff,
  CheckCircle2,
  Clock,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ItemLiveStats } from "@/lib/journey-content/observability";

export function ItemLiveStatsSidebar({ stats }: { stats: ItemLiveStats }) {
  const completionRate =
    stats.delivered > 0
      ? Math.round((stats.completed / stats.delivered) * 100)
      : null;
  const skipRate =
    stats.delivered > 0
      ? Math.round((stats.skipped / stats.delivered) * 100)
      : null;

  return (
    <aside className="bg-card rounded-lg border">
      <header className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Live stats</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Read-only snapshot. Updates on every page load.
        </p>
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Tile
          icon={Send}
          label="Queued"
          value={stats.queued}
          hint="Pending pushes for this item, not yet consumed."
        />
        <Tile
          icon={Users}
          label="Delivered"
          value={stats.delivered}
          hint="Distinct users who got this item."
        />
        <Tile
          icon={CheckCircle2}
          label="Completed"
          value={
            stats.completed +
            (completionRate !== null ? ` (${completionRate}%)` : "")
          }
          hint="Users who marked complete on the delivery."
        />
        <Tile
          icon={AlarmClockOff}
          label="Skipped"
          value={
            stats.skipped + (skipRate !== null ? ` (${skipRate}%)` : "")
          }
          hint="Cadence engine auto-skipped (no response in time)."
        />
        <Tile
          icon={Clock}
          label="Avg days to first response"
          value={
            stats.avgDaysToFirstResponse !== null
              ? `${stats.avgDaysToFirstResponse} d`
              : "-"
          }
          hint="From unlock_at to the user's first message in the thread."
          wide
        />
      </div>
    </aside>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  wide,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "bg-muted/30 col-span-2 rounded-lg border p-3"
          : "bg-muted/30 rounded-lg border p-3"
      }
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        <Icon className="size-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>
    </div>
  );
}
