// ============================================================
// UserLiveStatsPanel — slice 9 read-only inspector for a single
// journey user. Renders queue snapshot, engagement bundle,
// eligibility verdict, recent skips. Server component.
//
// Used on /dashboard/journey/clients/[ownerKey] (when ownerKey is
// a user) and on /dashboard/journey/clients/[ownerKey] (when
// ownerKey is a couple, the page renders one panel per partner).
// ============================================================

import {
  AlarmClockOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UserLiveStats } from "@/lib/journey-content/observability";
import type { EligibilityResult } from "@/lib/journey-content/cadence-engine";
import { cn } from "@/lib/utils";

const ELIGIBILITY_LABEL: Record<NonNullable<EligibilityResult["reason"]>, string> = {
  no_journey_subscription: "No active journey subscription",
  in_grace: "In grace window — cadence paused",
  blocked: "Blocked — grace expired without renewal",
  no_priorities: "No priority ranking yet",
  manually_paused: "Manually paused (profiles.journey_paused_at)",
};

export function UserLiveStatsPanel({
  stats,
  eligibility,
  partnerLabel,
}: {
  stats: UserLiveStats;
  eligibility: EligibilityResult;
  /** Optional label shown in the header — used on the couple workspace
   *  to disambiguate "Partner A" vs "Partner B". */
  partnerLabel?: string;
}) {
  return (
    <article className="bg-card rounded-lg border">
      <header className="border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Cadence inspector
            {partnerLabel ? (
              <span className="text-muted-foreground ms-2 font-normal">
                · {partnerLabel}
              </span>
            ) : null}
          </h2>
          <EligibilityPill eligibility={eligibility} />
        </div>
        <div className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-[11px]">
          <Engagement
            icon={MessageSquare}
            label="Last response"
            iso={stats.lastResponseAt}
          />
          <Engagement
            icon={MessageSquare}
            label="Last channel msg"
            iso={stats.lastChannelMessageAt}
          />
        </div>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* Pending pushes — with reason notes finally rendered */}
        <Section
          title={`Pending pushes (${stats.pendingPushes.length})`}
          icon={Send}
          empty={stats.pendingPushes.length === 0}
          emptyText="No pending pushes."
        >
          <ul className="space-y-2">
            {stats.pendingPushes.map((p) => (
              <li
                key={p.id}
                className="border-border bg-muted/30 rounded-md border p-2 text-xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {p.item_title_he ?? `(item ${p.item_id.slice(0, 8)}…)`}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {p.age_days}d
                  </span>
                </div>
                {p.reason_note ? (
                  <p className="text-muted-foreground mt-1 italic">
                    &quot;{p.reason_note}&quot;
                  </p>
                ) : null}
                {p.pushed_by_label ? (
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    by {p.pushed_by_label}
                    {p.group_id ? " · via group" : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>

        {/* Upcoming scheduled (cadence) */}
        <Section
          title={`Upcoming (${stats.upcoming.length})`}
          icon={Clock}
          empty={stats.upcoming.length === 0}
          emptyText="No upcoming scheduled items."
        >
          <ul className="space-y-2">
            {stats.upcoming.map((u) => (
              <li
                key={u.id}
                className="border-border bg-muted/30 rounded-md border p-2 text-xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {u.item_title_he ?? `(item ${u.item_id.slice(0, 8)}…)`}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(u.unlock_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  source: {u.source ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Recent delivered */}
        <Section
          title={`Last 5 delivered`}
          icon={CheckCircle2}
          empty={stats.recentDelivered.length === 0}
          emptyText="Nothing delivered yet."
        >
          <ul className="space-y-2">
            {stats.recentDelivered.map((d) => {
              const tone = d.completed_at
                ? "text-emerald-600 dark:text-emerald-400"
                : d.skipped_at
                  ? "text-rose-600 dark:text-rose-400"
                  : d.responded_at
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";
              const label = d.completed_at
                ? "completed"
                : d.skipped_at
                  ? "skipped"
                  : d.responded_at
                    ? "responded"
                    : "open";
              return (
                <li
                  key={d.scheduled_item_id}
                  className="border-border bg-muted/30 rounded-md border p-2 text-xs"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {d.item_title_he ??
                        `(item ${d.item_id.slice(0, 8)}…)`}
                    </span>
                    <span className={cn("text-[10px] uppercase tracking-wide", tone)}>
                      {label}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {new Date(d.unlock_at).toLocaleDateString()} · source:{" "}
                    {d.source ?? "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Recent skipped (only show if any) */}
        <Section
          title={`Recent skipped (${stats.recentSkipped.length})`}
          icon={AlarmClockOff}
          empty={stats.recentSkipped.length === 0}
          emptyText="No skipped items."
        >
          <ul className="space-y-2">
            {stats.recentSkipped.map((d) => (
              <li
                key={d.scheduled_item_id}
                className="border-border bg-muted/30 rounded-md border p-2 text-xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {d.item_title_he ?? `(item ${d.item_id.slice(0, 8)}…)`}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {d.skipped_at
                      ? new Date(d.skipped_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  unlocked {new Date(d.unlock_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </article>
  );
}

function EligibilityPill({
  eligibility,
}: {
  eligibility: EligibilityResult;
}) {
  if (eligibility.eligible) {
    return (
      <Badge
        variant="default"
        className="inline-flex items-center gap-1 text-[10px]"
      >
        <Sparkles className="size-3" aria-hidden />
        Cadence eligible
      </Badge>
    );
  }
  const label =
    eligibility.reason && ELIGIBILITY_LABEL[eligibility.reason]
      ? ELIGIBILITY_LABEL[eligibility.reason]
      : "Not eligible";
  return (
    <Badge
      variant="destructive"
      className="inline-flex items-center gap-1 text-[10px]"
      title={label}
    >
      <AlertTriangle className="size-3" aria-hidden />
      {eligibility.reason ?? "ineligible"}
    </Badge>
  );
}

function Engagement({
  icon: Icon,
  label,
  iso,
}: {
  icon: LucideIcon;
  label: string;
  iso: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3" aria-hidden />
      {label}: {iso ? new Date(iso).toLocaleDateString() : "never"}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: LucideIcon;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <Icon className="size-3" aria-hidden />
        {title}
      </div>
      {empty ? (
        <p className="text-muted-foreground text-xs italic">{emptyText}</p>
      ) : (
        children
      )}
    </div>
  );
}
