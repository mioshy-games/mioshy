import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListPrograms,
  adminListCategoriesWithItemCounts,
} from "@/lib/journey-content/queries";
import { createAdminClient } from "@/lib/supabase-admin";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JourneyDataTools } from "@/components/dashboard/journey/DataTools";
import {
  Layers,
  FolderTree,
  FileText,
  Route,
  Users as UsersIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getCounts() {
  const admin = await createAdminClient();
  const [progRes, catRes, itemRes, assignRes] = await Promise.all([
    admin.from("journey_programs").select("id, is_active"),
    admin.from("journey_categories").select("id, is_active"),
    admin.from("journey_items").select("id, is_active"),
    admin
      .from("journey_assignments")
      .select("id, is_active, user_id, couple_id"),
  ]);

  const programs = progRes.data ?? [];
  const categories = catRes.data ?? [];
  const items = itemRes.data ?? [];
  const assignments = (assignRes.data ?? []) as Array<{
    id: string;
    is_active: boolean;
    user_id: string | null;
    couple_id: string | null;
  }>;

  const owners = new Set<string>();
  for (const a of assignments) {
    if (!a.is_active) continue;
    owners.add(a.couple_id ? `c:${a.couple_id}` : `u:${a.user_id}`);
  }

  return {
    programs: {
      total: programs.length,
      active: programs.filter((p) => p.is_active).length,
    },
    categories: {
      total: categories.length,
      active: categories.filter((c) => c.is_active).length,
    },
    items: {
      total: items.length,
      active: items.filter((i) => i.is_active).length,
    },
    assignments: {
      total: assignments.length,
      active: assignments.filter((a) => a.is_active).length,
      ownerCount: owners.size,
    },
  };
}

export default async function JourneyDashboardPage() {
  await requireAdmin();

  const [counts, programs, standaloneCats] = await Promise.all([
    getCounts(),
    adminListPrograms(),
    adminListCategoriesWithItemCounts(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Journey - Content System
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Time-released roadmaps for couples. Build programs, categories and
            items here; assign to owners (user or couple) in the clients view.
            Content edits propagate retroactively.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {/* Primary actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/journey/programs/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              + New program
            </Link>
            <Link
              href="/dashboard/journey/items/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              + New item
            </Link>
            <Link
              href="/dashboard/journey/assignments/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              + Assign to owner
            </Link>
          </div>
          {/* Data tools: Export / Import / Templates */}
          <JourneyDataTools />
        </div>
      </div>

      {/* Count cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          icon={<Layers className="size-5" />}
          label="Programs"
          value={counts.programs.total}
          hint={`${counts.programs.active} active`}
          href="/dashboard/journey/programs"
        />
        <CountCard
          icon={<FolderTree className="size-5" />}
          label="Categories"
          value={counts.categories.total}
          hint={`${counts.categories.active} active`}
          href="/dashboard/journey/categories"
        />
        <CountCard
          icon={<FileText className="size-5" />}
          label="Items"
          value={counts.items.total}
          hint={`${counts.items.active} active`}
          href="/dashboard/journey/items"
        />
        <CountCard
          icon={<UsersIcon className="size-5" />}
          label="Active owners"
          value={counts.assignments.ownerCount}
          hint={`${counts.assignments.active} active assignments`}
          href="/dashboard/journey/assignments"
        />
      </div>

      {/* Programs + standalone categories quick peek */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border bg-card rounded-lg border">
          <header className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Route className="size-4" />
              <h2 className="font-semibold">Programs</h2>
            </div>
            <Link
              href="/dashboard/journey/programs"
              className="text-primary text-sm hover:underline"
            >
              Manage →
            </Link>
          </header>
          <ul className="divide-border divide-y">
            {programs.length === 0 ? (
              <li className="text-muted-foreground p-4 text-sm">
                No programs yet -{" "}
                <Link
                  href="/dashboard/journey/programs/new"
                  className="text-primary hover:underline"
                >
                  create one
                </Link>
                .
              </li>
            ) : (
              programs.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/journey/programs/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name_he}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">
                      {p.slug}
                    </div>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.is_active ? "Active" : "Draft"}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="border-border bg-card rounded-lg border">
          <header className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <FolderTree className="size-4" />
              <h2 className="font-semibold">Standalone categories</h2>
            </div>
            <Link
              href="/dashboard/journey/categories"
              className="text-primary text-sm hover:underline"
            >
              Manage →
            </Link>
          </header>
          <ul className="divide-border divide-y">
            {standaloneCats.length === 0 ? (
              <li className="text-muted-foreground p-4 text-sm">
                No standalone categories. These are categories not tied to any
                program - useful for one-off assigns.
              </li>
            ) : (
              standaloneCats.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/journey/categories/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name_he}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">
                      {c.slug} · {c.item_count} items
                    </div>
                  </div>
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.is_active ? "Active" : "Draft"}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CountCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </Link>
  );
}
