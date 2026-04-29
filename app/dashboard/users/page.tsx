/**
 * /dashboard/users
 *
 * Admin users list with journey + subscription overview. Reads from the
 * `admin_users_overview` view created in migration 026.
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

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin();

  const { data: rows } = await supabase
    .from("admin_users_overview")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Every user who has started the journey. Click a row for full detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Journey</TableHead>
                <TableHead>Sub</TableHead>
                <TableHead>Friendship</TableHead>
                <TableHead>Conflict</TableHead>
                <TableHead>Passion risk</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell>
                    <Link href={`/dashboard/users/${r.user_id}`} className="underline underline-offset-4">
                      {r.email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.journey_status ? (
                      <Badge variant="secondary">
                        {r.journey_status} · {r.current_step}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.subscription_status ? (
                      <Badge variant={r.subscription_status === "active" ? "default" : "outline"}>
                        {r.plan ?? ""} {r.subscription_status}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{r.friendship_score ?? "—"}</TableCell>
                  <TableCell>{r.conflict_health ?? "—"}</TableCell>
                  <TableCell>{r.passion_risk ?? "—"}</TableCell>
                  <TableCell>
                    {r.four_horsemen_flag ? <Badge variant="destructive">horsemen</Badge> : null}
                    {r.open_tasks_count ? <Badge variant="secondary" className="ml-1">{r.open_tasks_count} tasks</Badge> : null}
                  </TableCell>
                  <TableCell>{fmt(r.last_activity_at)}</TableCell>
                </TableRow>
              ))}
              {!rows?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">No users yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
