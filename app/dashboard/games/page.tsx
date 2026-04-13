import { requireAdmin } from "@/lib/auth/admin";
import Link from "next/link";
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

export default async function GamesListPage() {
  const { supabase } = await requireAdmin();

  const { data: games } = await supabase
    .from("games")
    .select("id, name_en, name_he, slug, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Games</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create, edit, duplicate, and activate games.
          </p>
        </div>
        <Link
          href="/dashboard/games/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          New game
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All games</CardTitle>
          <CardDescription>
            Sorted by newest. Use actions to edit or duplicate.
          </CardDescription>
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
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No games yet.
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
