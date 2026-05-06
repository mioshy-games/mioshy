/**
 * /dashboard/my-clients
 *
 * The expert's home view. Lists every couple linked to them via
 * `expert_couples` (or every couple for admins). Each row links into
 * /dashboard/my-clients/[coupleId] where the expert can view both partners
 * and assign Journey content.
 */

import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { listExpertClients } from "@/lib/experts/queries";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MyClientsPage() {
  const session = await requireExpert();
  const clients = await listExpertClients({
    expertId: session.user.id,
    isAdmin: session.isAdmin,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Clients</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Couples you&apos;re coaching. Click a row to see both partners,
          their assigned content, and prescribe new programs or articles.
          {session.isAdmin
            ? " (Admin view - listing your linked couples only. Use Experts to manage links.)"
            : ""}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {session.isAdmin
            ? "You haven't been linked to any couples yet. An admin can add links from "
            : "No clients yet - an admin will link couples to you from "}
          <Link href="/dashboard/experts" className="underline">
            Experts
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-border border-border overflow-hidden rounded-lg border divide-y">
          {clients.map((c) => {
            const pct =
              c.scheduledItems > 0
                ? Math.round((c.completedItems / c.scheduledItems) * 100)
                : 0;
            return (
              <li
                key={c.coupleId}
                className="bg-card hover:bg-muted/40 transition-colors"
              >
                <Link
                  href={`/dashboard/my-clients/${c.coupleId}`}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                    <Users className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {c.displayName ||
                          c.members
                            .map((m) => m.email ?? m.userId.slice(0, 6))
                            .join(" & ") ||
                          `Couple · ${c.coupleId.slice(0, 8)}`}
                      </span>
                      {c.pairCode ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {c.pairCode}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {c.members.length === 0
                        ? "No members"
                        : c.members
                            .map((m) => m.email ?? m.userId.slice(0, 8))
                            .join(" · ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-center text-xs">
                    <Stat value={c.activeAssignments} label="active" />
                    <Stat
                      value={`${c.completedItems}/${c.scheduledItems}`}
                      label="done"
                      hint={`${pct}%`}
                    />
                    <Stat
                      value={fmtDate(c.lastActivityAt)}
                      label="last add"
                      wide
                    />
                    <ArrowRight className="text-muted-foreground size-4" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
  wide,
}: {
  value: number | string;
  label: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "min-w-[5.5rem]" : "min-w-[3.5rem]"}>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
        {hint ? ` · ${hint}` : ""}
      </div>
    </div>
  );
}
