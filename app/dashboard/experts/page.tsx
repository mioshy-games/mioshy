/**
 * /dashboard/experts — admin-only.
 *
 * Manage expert ↔ couple links. Each row is a couple; the admin can:
 *   - See which expert(s) are currently linked.
 *   - Add a new expert by email (auto-promotes profile.role → 'expert').
 *   - Soft-unlink (set is_active=false).
 *
 * Once linked, the expert can sign in and see this couple in their
 * /dashboard/my-clients view, where they can assign Journey content.
 */

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LinkExpertForm, UnlinkExpertButton } from "./forms";

export const dynamic = "force-dynamic";

interface CoupleRow {
  id: string;
  displayName: string | null;
  pairCode: string | null;
  members: { userId: string; email: string | null; role: string }[];
  experts: {
    linkId: string;
    expertId: string;
    expertEmail: string | null;
    notes: string | null;
    createdAt: string;
  }[];
}

async function loadCoupleRows(search: string): Promise<CoupleRow[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const { data: coupleRows } = await admin
    .from("couples")
    .select("id, display_name, pair_code, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(500);

  const allCoupleIds = ((coupleRows ?? []) as Array<{ id: string }>).map(
    (c) => c.id,
  );
  if (allCoupleIds.length === 0) return [];

  const [{ data: memberRows }, { data: linkRows }] = await Promise.all([
    admin
      .from("couple_members")
      .select("couple_id, user_id, role")
      .in("couple_id", allCoupleIds),
    admin
      .from("expert_couples")
      .select("id, couple_id, expert_id, notes, created_at")
      .eq("is_active", true)
      .in("couple_id", allCoupleIds),
  ]);

  const allUserIds = Array.from(
    new Set([
      ...((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
      ...((linkRows ?? []) as Array<{ expert_id: string }>).map((l) => l.expert_id),
    ]),
  );
  const emailById = new Map<string, string | null>();
  if (allUserIds.length > 0) {
    const { data: userRows } = await admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", allUserIds);
    for (const u of (userRows ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      emailById.set(u.user_id, u.email);
    }
  }

  const rows: CoupleRow[] = [];
  for (const c of (coupleRows ?? []) as Array<{
    id: string;
    display_name: string | null;
    pair_code: string | null;
  }>) {
    const members = ((memberRows ?? []) as Array<{
      couple_id: string;
      user_id: string;
      role: string;
    }>)
      .filter((m) => m.couple_id === c.id)
      .map((m) => ({
        userId: m.user_id,
        email: emailById.get(m.user_id) ?? null,
        role: m.role,
      }));
    const experts = ((linkRows ?? []) as Array<{
      id: string;
      couple_id: string;
      expert_id: string;
      notes: string | null;
      created_at: string;
    }>)
      .filter((l) => l.couple_id === c.id)
      .map((l) => ({
        linkId: l.id,
        expertId: l.expert_id,
        expertEmail: emailById.get(l.expert_id) ?? null,
        notes: l.notes,
        createdAt: l.created_at,
      }));
    rows.push({
      id: c.id,
      displayName: c.display_name,
      pairCode: c.pair_code,
      members,
      experts,
    });
  }

  // Search filter
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    if ((r.displayName ?? "").toLowerCase().includes(q)) return true;
    if ((r.pairCode ?? "").toLowerCase().includes(q)) return true;
    if (r.members.some((m) => (m.email ?? "").toLowerCase().includes(q))) return true;
    if (r.experts.some((e) => (e.expertEmail ?? "").toLowerCase().includes(q))) return true;
    return false;
  });
}

export default async function ExpertsAdminPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireAdmin();
  const search = searchParams?.q ?? "";
  const rows = await loadCoupleRows(search);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Experts</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Link a coaching expert to a couple. Once linked the expert sees the
          couple in their <code>My Clients</code> view and can assign Journey
          content. Linking by email auto-promotes the user to{" "}
          <code>profile.role = expert</code>.
        </p>
      </div>

      <form
        action="/dashboard/experts"
        method="get"
        className="flex items-center gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search couple, member, expert"
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No couples found.
        </div>
      ) : (
        <ul className="divide-border border-border overflow-hidden rounded-lg border divide-y">
          {rows.map((r) => (
            <li key={r.id} className="bg-card space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="size-4" />
                    <span className="font-semibold">
                      {r.displayName || `Couple · ${r.id.slice(0, 8)}`}
                    </span>
                    {r.pairCode ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {r.pairCode}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {r.members.length === 0
                      ? "No members yet"
                      : r.members
                          .map((m) => m.email ?? m.userId.slice(0, 8))
                          .join(" · ")}
                  </div>
                </div>
              </div>

              {/* Currently linked experts */}
              {r.experts.length > 0 ? (
                <div className="space-y-1.5">
                  {r.experts.map((e) => (
                    <div
                      key={e.linkId}
                      className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md px-3 py-1.5 text-xs"
                    >
                      <Badge>Expert</Badge>
                      <span className="font-mono">
                        {e.expertEmail ?? e.expertId.slice(0, 8)}
                      </span>
                      {e.notes ? (
                        <span className="text-muted-foreground">· {e.notes}</span>
                      ) : null}
                      <UnlinkExpertButton linkId={e.linkId} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs italic">
                  No expert assigned yet
                </div>
              )}

              <LinkExpertForm coupleId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
