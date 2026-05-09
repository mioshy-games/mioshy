/**
 * /dashboard/my-clients
 *
 * The expert's home view. Lists every couple linked to them via
 * `expert_couples` (or every couple for admins). Each row links into
 * /dashboard/my-clients/[coupleId] where the expert can view both partners
 * and assign Journey content.
 */

import Link from "next/link";
import { Users, ArrowRight, Clock, AlertTriangle, Check, HeartPulse } from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";
import { listExpertClients } from "@/lib/experts/queries";
import { getSlaForCouples, type SlaTone } from "@/lib/experts/sla";
import { getDriftForCouples } from "@/lib/journey/drift";
import { getCoupleAsymmetry } from "@/lib/journey/asymmetry";
import { Badge } from "@/components/ui/badge";
import { NeedsAttentionPanel } from "@/components/dashboard/coach/NeedsAttentionPanel";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { getWorkflowStatesForCouples } from "@/lib/journey/couple-workflow-state";
import { CoupleStatusChip } from "@/components/dashboard/coach/CoupleStatusChip";

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
  const locale = getAdminLocale();
  const clients = await listExpertClients({
    expertId: session.user.id,
    isAdmin: session.isAdmin,
  });
  // Layer-2 SLA chip per couple — single batched lookup.
  const slaMap = await getSlaForCouples(clients.map((c) => c.coupleId));
  // Layer-3 drift snapshot per couple — same batched pattern.
  const driftMap = await getDriftForCouples(clients.map((c) => c.coupleId));
  // Phase 13 — workflow state per couple. Drives the status chip.
  const workflowMap = await getWorkflowStatesForCouples(
    clients.map((c) => c.coupleId),
  );

  // Layer-5 asymmetry per couple. One row per couple in flight; we
  // only render when sustained=true so most couples don't add a chip.
  const asymmetryMap = new Map<
    string,
    Awaited<ReturnType<typeof getCoupleAsymmetry>>
  >();
  await Promise.all(
    clients.map(async (c) => {
      asymmetryMap.set(c.coupleId, await getCoupleAsymmetry(c.coupleId));
    }),
  );

  // Surface couples in drifting/silent state at the top.
  // Sort: silent first, then drifting; within bucket sort by days desc.
  const driftingClients = clients
    .filter((c) => {
      const s = driftMap.get(c.coupleId);
      return s && s.state !== "active";
    })
    .sort((a, b) => {
      const da = driftMap.get(a.coupleId);
      const db = driftMap.get(b.coupleId);
      const sa = da?.state === "silent" ? 2 : 1;
      const sb = db?.state === "silent" ? 2 : 1;
      if (sa !== sb) return sb - sa;
      return (db?.daysSinceLastSignal ?? 0) - (da?.daysSinceLastSignal ?? 0);
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t(locale, "page.my_clients.title")}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {t(locale, "page.my_clients.subtitle")}
        </p>
      </div>

      {/* Phase 7 — coach urgent surface. Sits above the drift widget so
          the most acute signals (AI-flagged urgent/concerning user
          messages) are seen first. */}
      <NeedsAttentionPanel expertId={session.user.id} />

      {/* Layer-3 drift widget — surfaces couples that need a check-in.
          Renders only when at least one couple is drifting/silent. */}
      {driftingClients.length > 0 ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <header className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
            <HeartPulse className="size-4" />
            {t(locale, "mc.needs_checkin")}
            <span className="text-amber-200/70 text-xs font-normal">
              ({driftingClients.length})
            </span>
          </header>
          <ul className="divide-y divide-amber-500/15">
            {driftingClients.map((c) => {
              const d = driftMap.get(c.coupleId);
              const days = d?.daysSinceLastSignal;
              const checkedIn = !!d?.coachCheckedInAt;
              return (
                <li key={c.coupleId}>
                  <Link
                    href={`/dashboard/my-clients/${c.coupleId}`}
                    className="flex items-center justify-between gap-3 px-1 py-2 text-sm hover:bg-amber-500/10"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {c.displayName ||
                        c.members.map((m) => m.email ?? m.userId.slice(0, 6)).join(" & ") ||
                        c.coupleId.slice(0, 8)}
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={
                          d?.state === "silent"
                            ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                            : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                        }
                      >
                        {d?.state === "silent" ? "Silent" : "Drifting"} ·{" "}
                        {days != null ? `${days}d` : "?"}
                      </Badge>
                      {checkedIn ? (
                        <span className="text-emerald-300/85 inline-flex items-center gap-0.5">
                          <Check className="size-3" /> sent
                        </span>
                      ) : (
                        <span className="text-amber-300/80">needs you</span>
                      )}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
                    {(() => {
                      const ws = workflowMap.get(c.coupleId);
                      if (!ws) return null;
                      return (
                        <div onClick={(e) => e.preventDefault()}>
                          <CoupleStatusChip
                            coupleLabel={
                              c.displayName ||
                              c.members
                                .map((m) => m.email ?? m.userId.slice(0, 6))
                                .join(" & ") ||
                              `Couple · ${c.coupleId.slice(0, 8)}`
                            }
                            state={ws}
                          />
                        </div>
                      );
                    })()}
                    <SlaChip sla={slaMap.get(c.coupleId) ?? null} />
                    {(() => {
                      const asym = asymmetryMap.get(c.coupleId);
                      return asym?.sustained ? (
                        <div className="min-w-[6rem]">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                            Gap {Math.round(asym.gapFraction * 100)}%
                          </span>
                          <div className="text-muted-foreground mt-1 text-[10px] uppercase tracking-wide">
                            Asymmetry
                          </div>
                        </div>
                      ) : null;
                    })()}
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

/**
 * Layer-2 SLA chip — colored pill summarising oldest open response.
 * Green when nothing's pending. Amber > 12h. Red > 24h.
 * No state surface = nothing to triage; the chip stays subtle.
 */
function SlaChip({
  sla,
}: {
  sla: { openCount: number; oldestOpenHours: number | null; tone: SlaTone } | null;
}) {
  const tone: SlaTone = sla?.tone ?? "green";
  const Icon =
    tone === "red" ? AlertTriangle : tone === "amber" ? Clock : Check;

  const cls =
    tone === "red"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";

  const label =
    tone === "green"
      ? "On time"
      : `${sla?.openCount ?? 0} open · ${
          sla?.oldestOpenHours != null
            ? `${Math.round(sla.oldestOpenHours)}h`
            : "?"
        }`;

  return (
    <div className="min-w-[6rem]">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
      >
        <Icon className="size-3" />
        {label}
      </span>
      <div className="text-muted-foreground mt-1 text-[10px] uppercase tracking-wide">
        SLA
      </div>
    </div>
  );
}
