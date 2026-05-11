/**
 * /dashboard
 *
 * Role-aware landing page.
 *  - admin role: games + content overview (the historical view).
 *  - expert role: coaching-first orientation (Phase 8) — greeting,
 *    onboarding checklist, today's queue counters, quick navigation.
 *
 * Both branches are server components rendered at the top level so a
 * coach hitting /dashboard sees their workspace, not the games table.
 */

import Link from "next/link";
import { requireExpert } from "@/lib/auth/expert";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { CoachOverviewPanel } from "@/components/dashboard/coach/CoachOverviewPanel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { GameActions } from "@/components/dashboard/GameActions";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const session = await requireExpert();

  // ── Coach branch (Phase 8) ───────────────────────────────────
  if (!session.isAdmin) {
    return (
      <div className="mx-auto max-w-6xl">
        <CoachOverviewPanel expertId={session.user.id} />
      </div>
    );
  }

  // ── Admin branch (original games view) ───────────────────────
  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Service role unavailable — check Supabase env vars.
        </p>
      </div>
    );
  }

  const [{ count: totalGames }, { count: totalQuestions }, { count: activeGames }] =
    await Promise.all([
      admin.from("games").select("*", { count: "exact", head: true }),
      admin.from("questions").select("*", { count: "exact", head: true }),
      admin
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

  const { data: games } = await admin
    .from("games")
    .select("id, name_en, name_he, slug, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of games and content.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total games</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {totalGames ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total questions</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {totalQuestions ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active games</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {activeGames ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Games</CardTitle>
            <CardDescription>Quick actions and status</CardDescription>
          </div>
          <Link
            href="/dashboard/games/new"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            New game
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name (EN)</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games?.length ? (
                games.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name_en}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {g.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.is_active ? "default" : "secondary"}>
                        {g.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <GameActions gameId={g.id} isActive={g.is_active} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No games yet. Create one to get started.
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
