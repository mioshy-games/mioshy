/**
 * /dashboard/consultation-requests — admin "בקשות שיחה" (Stage 2).
 *
 * Read-only list of Calendly consultation bookings (consultation_requests,
 * migration 185). Admin-only (requireAdmin). Metadata only. Service-role read
 * (the table is RLS-locked to service_role).
 */

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
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

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string | null;
  email: string | null;
  source: string | null;
  calendly_invitee_uri: string | null;
  status: string | null;
  created_at: string;
};

export default async function ConsultationRequestsPage() {
  await requireAdmin();
  const locale = getAdminLocale();
  const rtl = isRtl(locale);
  const he = locale === "he";
  const dateLocale = he ? "he-IL" : "en-US";

  const admin = createServiceRoleClient();
  let rows: Row[] = [];
  if (admin) {
    const { data } = await admin
      .from("consultation_requests")
      .select("id, user_id, email, source, calendly_invitee_uri, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    rows = (data ?? []) as Row[];
  }

  const fmt = (v: string) =>
    new Date(v).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {he ? "בקשות שיחה" : "Consultation requests"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {he
            ? "קביעות שיחה עם נציג דרך Calendly, מהחדש לישן."
            : "Calendly consultation bookings, newest first."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{he ? "בקשות" : "Requests"} ({rows.length})</CardTitle>
          <CardDescription>
            {!admin
              ? he
                ? "אין service role — לא ניתן לקרוא."
                : "Service role unavailable."
              : he
                ? "תאריך · מי · מקור · סטטוס · לינק"
                : "Date · who · source · status · link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{he ? "תאריך" : "Date"}</TableHead>
                <TableHead>{he ? "מי" : "Who"}</TableHead>
                <TableHead>{he ? "מקור" : "Source"}</TableHead>
                <TableHead>{he ? "סטטוס" : "Status"}</TableHead>
                <TableHead>{he ? "לינק" : "Link"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap tabular-nums" dir="ltr">
                      {fmt(r.created_at)}
                    </TableCell>
                    <TableCell dir="ltr">
                      {r.user_id ? (
                        <Link
                          href={`/dashboard/users/${r.user_id}`}
                          className="underline underline-offset-4"
                        >
                          {r.email || r.user_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{r.email || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.source || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "scheduled" ? "default" : "outline"}>
                        {r.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.calendly_invitee_uri ? (
                        <a
                          href={r.calendly_invitee_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          {he ? "פתח ב-Calendly" : "Open in Calendly"}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                    {he ? "אין בקשות עדיין." : "No requests yet."}
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
