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
import Link from "next/link";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function LeadsAdminPage({
  searchParams,
}: {
  searchParams: { lang?: string; status?: string } | undefined;
}) {
  const { supabase } = await requireAdmin();

  const lang = searchParams?.lang;
  const status = searchParams?.status;

  let q = supabase
    .from("leads")
    .select("id, email, name, language, device_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (lang === "he" || lang === "en") q = q.eq("language", lang);
  if (status) q = q.eq("status", status);

  const { data: leads } = await q;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Anonymous-first lead capture (pre-payment).
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link className="underline underline-offset-4" href="/dashboard/leads">
            All
          </Link>
          <Link className="underline underline-offset-4" href="/dashboard/leads?lang=en">
            EN
          </Link>
          <Link className="underline underline-offset-4" href="/dashboard/leads?lang=he">
            HE
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link className="underline underline-offset-4" href="/dashboard/leads?status=new">
            New
          </Link>
          <Link
            className="underline underline-offset-4"
            href="/dashboard/leads?status=converted"
          >
            Converted
          </Link>
        </div>
        {/* G4 — CSV export for manual (WhatsApp) outreach. Plain <a> so the
            route's attachment download fires instead of client navigation. */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a
            className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
            href="/dashboard/leads/export"
          >
            ⬇ Export all (CSV)
          </a>
          <a
            className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
            href="/dashboard/leads/export?source=marathon-7day"
          >
            ⬇ Export marathon (CSV)
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent leads</CardTitle>
          <CardDescription>Newest first (limited to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.length ? (
                leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.email}
                      {l.name ? (
                        <div className="text-muted-foreground text-xs">{l.name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{l.language}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          l.status === "converted"
                            ? "default"
                            : l.status === "new"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(l.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No leads yet.
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

