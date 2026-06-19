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
import { PendingMessagesCard } from "@/components/dashboard/PendingMessagesCard";
import { getPendingExpertMessages } from "@/lib/journey/pending-messages";
import { AdminOverview } from "@/components/dashboard/AdminOverview";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
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

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams?: { range?: string; from?: string; to?: string };
}) {
  const session = await requireExpert();
  const locale = getAdminLocale();

  // ── Coach branch (Phase 8) ───────────────────────────────────
  if (!session.isAdmin) {
    // 2026-06-01 — surface pending user messages above the queue. Coach
    // walks in here, the first thing they see is "X clients need a reply".
    const pending = await getPendingExpertMessages({ limit: 8 });
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PendingMessagesCard
          rows={pending.rows}
          totalCount={pending.count}
          degraded={!pending.ok}
        />
        <CoachOverviewPanel expertId={session.user.id} />
      </div>
    );
  }

  // ── Admin branch (original games view) ───────────────────────
  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {t(locale, "home.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(locale, "home.service_unavailable")}
        </p>
      </div>
    );
  }

  const [
    { count: totalGames },
    { count: totalQuestions },
    { count: activeGames },
  ] = await Promise.all([
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
        <h1 className="text-3xl font-bold tracking-tight">
          {t(locale, "home.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t(locale, "home.subtitle")}
        </p>
      </div>

      {/* Admin overview — range metrics + inquiries list (admin-only). The
          inquiries list reuses the same pending-replies source the coaches'
          PendingMessagesCard uses, so it replaces that card here (no duplicate
          source / no duplicate widget). Coaches keep their card untouched. */}
      <AdminOverview searchParams={searchParams} locale={locale} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t(locale, "home.total_games")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {totalGames ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t(locale, "home.total_questions")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {totalQuestions ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t(locale, "home.active_games")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {activeGames ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t(locale, "home.games")}</CardTitle>
            <CardDescription>{t(locale, "home.quick_actions")}</CardDescription>
          </div>
          <Link
            href="/dashboard/games/new"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            {t(locale, "home.new_game")}
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(locale, "home.col_name_en")}</TableHead>
                <TableHead>{t(locale, "home.col_slug")}</TableHead>
                <TableHead>{t(locale, "home.col_status")}</TableHead>
                <TableHead className="text-right">{t(locale, "home.col_actions")}</TableHead>
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
                        {g.is_active ? t(locale, "common.active") : t(locale, "common.inactive")}
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
                    {t(locale, "home.no_games")}
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
