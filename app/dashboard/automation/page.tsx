/**
 * /dashboard/automation
 *
 * Observability over the engagement queue:
 *   - Aggregate counts by status (pending / sent / failed / skipped)
 *   - Next 20 pending sends (chronological)
 *   - Last 20 failures (for debugging templates / provider)
 *
 * Actions are all per-user; bulk actions happen in the users list or
 * programmatically via the cron endpoint.
 */

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ScheduleRow = {
  id: string;
  user_id: string;
  template_id: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
  reason: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

export default async function AutomationPage() {
  const { supabase } = await requireAdmin();

  const [{ data: pending }, { data: failed }, { data: templateRows }] = await Promise.all([
    supabase
      .from("engagement_schedules")
      .select("id, user_id, template_id, status, scheduled_for, sent_at, error, reason")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(20),
    supabase
      .from("engagement_schedules")
      .select("id, user_id, template_id, status, scheduled_for, sent_at, error, reason")
      .eq("status", "failed")
      .order("scheduled_for", { ascending: false })
      .limit(20),
    supabase.from("message_templates").select("id, key"),
  ]);

  const keyMap = new Map((templateRows ?? []).map((t) => [t.id, t.key] as const));

  // Quick aggregate counts. A richer dashboard would use a DB function or
  // pre-aggregated view; this is fine for admin volume.
  const { count: pendingCount } = await supabase
    .from("engagement_schedules")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: sentCount } = await supabase
    .from("engagement_schedules")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent");
  const { count: failedCount } = await supabase
    .from("engagement_schedules")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");
  const { count: skippedCount } = await supabase
    .from("engagement_schedules")
    .select("id", { count: "exact", head: true })
    .eq("status", "skipped");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Pending" value={pendingCount ?? 0} tone="default" />
        <StatCard title="Sent" value={sentCount ?? 0} tone="default" />
        <StatCard title="Skipped" value={skippedCount ?? 0} tone="outline" />
        <StatCard title="Failed" value={failedCount ?? 0} tone="destructive" />
      </div>

      <ScheduleTable
        title="Upcoming sends"
        description="Next 20 pending messages the cron worker will pick up."
        rows={(pending ?? []) as ScheduleRow[]}
        keyMap={keyMap}
        dateCol="scheduled_for"
      />

      <ScheduleTable
        title="Recent failures"
        description="Investigate template, provider credentials, or rate-limit issues."
        rows={(failed ?? []) as ScheduleRow[]}
        keyMap={keyMap}
        dateCol="scheduled_for"
        showError
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "default" | "outline" | "destructive";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold">{value}</span>
          <Badge variant={tone}>{title.toLowerCase()}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleTable({
  title,
  description,
  rows,
  keyMap,
  dateCol,
  showError = false,
}: {
  title: string;
  description: string;
  rows: ScheduleRow[];
  keyMap: Map<string, string>;
  dateCol: "scheduled_for" | "sent_at";
  showError?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>{dateCol === "scheduled_for" ? "Scheduled" : "Sent"}</TableHead>
              {showError ? <TableHead>Error</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/dashboard/users/${r.user_id}`} className="underline underline-offset-4">
                    {r.user_id.slice(0, 8)}…
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{keyMap.get(r.template_id) ?? r.template_id.slice(0, 8)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.reason ?? "-"}</TableCell>
                <TableCell>{fmt(r[dateCol])}</TableCell>
                {showError ? (
                  <TableCell className="max-w-[280px] truncate text-destructive">
                    {r.error ?? "-"}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={showError ? 5 : 4} className="text-center text-muted-foreground">
                  Nothing here.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
