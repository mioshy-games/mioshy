import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listGames } from "@/lib/between-us/queries";
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
import { ArrowLeft } from "lucide-react";
import { ExperienceGameActions } from "@/components/dashboard/between-us/ExperienceGameActions";
import { NewExperienceGameButton } from "@/components/dashboard/between-us/NewExperienceGameButton";

export const dynamic = "force-dynamic";

export default async function BetweenUsGamesListPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; active?: string }>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const search = params.q?.trim() ?? "";
  const onlyActive = params.active === "1";

  const games = await listGames({ search, onlyActive });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/adults"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Games</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            All couples games in the Adults Only library. Inactive games are
            hidden from the public site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewExperienceGameButton />
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>All games</CardTitle>
              <CardDescription>
                {games.length} {games.length === 1 ? "game" : "games"}
                {search ? ` matching “${search}”` : ""}
                {onlyActive ? " · active only" : ""}
              </CardDescription>
            </div>
            <form
              action="/dashboard/adults/games"
              className="flex flex-wrap items-center gap-2"
            >
              <input
                name="q"
                defaultValue={search}
                placeholder="Search by title or slug…"
                className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
              />
              <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name="active"
                  value="1"
                  defaultChecked={onlyActive}
                />
                Active only
              </label>
              <button
                type="submit"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Filter
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No games yet — click &quot;New game&quot; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                games.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">
                        {g.title_he || g.title_en || "—"}
                      </div>
                      {g.title_en ? (
                        <div className="text-muted-foreground text-xs">
                          {g.title_en}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top font-mono text-xs">
                      {g.slug}
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {g.price_ils != null ? (
                        <>
                          ₪{Number(g.price_ils).toFixed(0)}
                          {g.price_usd != null
                            ? ` / $${Number(g.price_usd).toFixed(0)}`
                            : ""}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          uses default
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {g.is_new ? (
                          <Badge variant="default">New</Badge>
                        ) : null}
                        {g.is_popular ? (
                          <Badge variant="secondary">Popular</Badge>
                        ) : null}
                        {g.is_subscription_eligible ? (
                          <Badge variant="outline">Sub</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={g.is_active ? "default" : "secondary"}>
                        {g.is_active ? "Active" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <ExperienceGameActions
                        gameId={g.id}
                        isActive={g.is_active}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
