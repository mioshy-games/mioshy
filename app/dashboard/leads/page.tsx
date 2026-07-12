/**
 * /dashboard/leads — admin Leads / follow-up view.
 *
 * Sources REAL signups (profiles) that have not converted to an active paid
 * subscription, via lib/dashboard/leads.loadLeads — not the near-empty `leads`
 * table the old page read. Admin-only (requireAdmin). Read-only.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { loadLeads } from "@/lib/dashboard/leads";
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
import { cn } from "@/lib/utils";
import Link from "next/link";

const DISPLAY_LIMIT = 500;

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function LeadsAdminPage({
  searchParams,
}: {
  searchParams?: { lang?: string; status?: string };
}) {
  await requireAdmin();

  const lang = searchParams?.lang === "he" || searchParams?.lang === "en" ? searchParams.lang : null;
  const status =
    searchParams?.status === "converted" || searchParams?.status === "all"
      ? searchParams.status
      : "not";

  const { rows, total, last7d, degraded } = await loadLeads({ lang, status });
  const shown = rows.slice(0, DISPLAY_LIMIT);

  const hrefWith = (o: { lang?: string | null; status?: string }) => {
    const sp = new URLSearchParams();
    const l = o.lang !== undefined ? o.lang : lang;
    const s = o.status !== undefined ? o.status : status;
    if (l) sp.set("lang", l);
    if (s && s !== "not") sp.set("status", s);
    const q = sp.toString();
    return q ? `/dashboard/leads?${q}` : "/dashboard/leads";
  };

  const filterLink = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-sm",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Real signups that have not converted to a paid subscription. Test
          accounts excluded.
        </p>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Language:</span>
          {filterLink("All", hrefWith({ lang: null }), lang === null)}
          {filterLink("HE", hrefWith({ lang: "he" }), lang === "he")}
          {filterLink("EN", hrefWith({ lang: "en" }), lang === "en")}
          <span className="text-muted-foreground mx-1 text-xs">·</span>
          <span className="text-muted-foreground text-xs">Status:</span>
          {filterLink("Not converted", hrefWith({ status: "not" }), status === "not")}
          {filterLink("Converted", hrefWith({ status: "converted" }), status === "converted")}
          {filterLink("All", hrefWith({ status: "all" }), status === "all")}
        </div>

        {/* CSV exports. Plain <a> so the route's attachment download fires. The
            outreach exports are consented-only (compliance); the internal one
            includes everyone with a marketing_consent column. */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent" href="/dashboard/leads/export">
            ⬇ Export all (internal, CSV)
          </a>
          <a className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent" href="/dashboard/leads/export?consented=1">
            ⬇ Export outreach — consented (CSV)
          </a>
          <a className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent" href="/dashboard/leads/export?source=marathon-7day&consented=1">
            ⬇ Export marathon 7-day — consented (CSV)
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>
            {degraded
              ? "Service role unavailable — cannot read signups."
              : `${total} matching · ${last7d} new in the last 7 days · newest first${
                  total > DISPLAY_LIMIT ? ` (showing ${DISPLAY_LIMIT})` : ""
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length ? (
                shown.map((l) => (
                  <TableRow key={l.userId}>
                    <TableCell className="font-medium" dir="auto">
                      <Link
                        href={`/dashboard/users/${l.userId}`}
                        className="underline underline-offset-4"
                      >
                        {l.fullName || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {l.email || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {l.phone || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{l.language || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.marketingConsent ? "default" : "outline"}>
                        {l.marketingConsent ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.assessmentDone ? "secondary" : "outline"}>
                        {l.assessmentDone ? "Done" : "Not done"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(l.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                    No leads match.
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
