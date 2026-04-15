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
import { SubscriptionActions } from "@/components/dashboard/SubscriptionActions";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function SubscriptionsAdminPage() {
  const { supabase } = await requireAdmin();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, user_id, email, status, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage subscription status (simulation).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent subscriptions</CardTitle>
          <CardDescription>Newest first (limited to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs?.length ? (
                subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "active"
                            ? "default"
                            : s.status === "paused"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.plan ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(s.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <SubscriptionActions
                        subscriptionId={s.id}
                        status={String(s.status)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                    No subscriptions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

