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
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { SectionHelp } from "@/components/dashboard/SectionHelp";
import {
  Layers,
  FolderTree,
  FileText,
  Route,
  Users as UsersIcon,
  Filter,
  MessageSquare,
  Activity,
} from "lucide-react";
import { HintIcon } from "@/components/ui/hint-icon";

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
  const locale = getAdminLocale();

  const [counts, programs, standaloneCats] = await Promise.all([
    getCounts(),
    adminListPrograms(),
    adminListCategoriesWithItemCounts(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">
              {t(locale, "journey.hub.title")}
            </h1>
            <HintIcon topic="journey.hub_intro" />
            <SectionHelp
              title="מסע — מערכת תוכן"
              body={
                <>
                  <p>
                    מרכז ניהול התוכן של מוצר Journey. הבית של 250 השיעורים
                    הקיימים, חמש קטגוריות הליבה (תקשורת / מיניות / אהבה /
                    חברות / משפחה), וההצמדות לזוגות.
                  </p>
                  <p>
                    <strong>4 הקלפים העליונים</strong> — קליקבילים. הם
                    מובילים לרשימת התוכן או לרשימת ההצמדות.
                  </p>
                  <p>
                    <strong>4 השורטקאטים מתחת</strong> — &quot;כללי התאמה&quot;
                    מסביר למה פריט נשלח, &quot;פידבק&quot; מציג איזה תוכן
                    עובד, &quot;הודעות מומחים&quot; היא מעקב חוצה־מאמנים,
                    ו-&quot;מטריקות&quot; היא הדשבורד הכללי.
                  </p>
                </>
              }
              aiNote={
                <p>
                  ה-AI מפעיל את &quot;Smart Suggestions&quot; שאתם רואים
                  בעמוד הזוג הספציפי. כאן בעמוד ההאב ה-AI לא מתערב — זה ניהול
                  תוכן ידני.
                </p>
              }
            />
          </span>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {t(locale, "journey.hub.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {/* Primary actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/journey/programs/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              {t(locale, "journey.hub.new_program")}
            </Link>
            <Link
              href="/dashboard/journey/items/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t(locale, "journey.hub.new_item")}
            </Link>
            <Link
              href="/dashboard/journey/assignments/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t(locale, "journey.hub.assign_owner")}
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
          label={t(locale, "journey.hub.programs")}
          value={counts.programs.total}
          hint={`${counts.programs.active} ${t(locale, "journey.hub.active")}`}
          href="/dashboard/journey/programs"
        />
        <CountCard
          icon={<FolderTree className="size-5" />}
          label={t(locale, "journey.hub.categories")}
          value={counts.categories.total}
          hint={`${counts.categories.active} ${t(locale, "journey.hub.active")}`}
          href="/dashboard/journey/categories"
        />
        <CountCard
          icon={<FileText className="size-5" />}
          label={t(locale, "journey.hub.items")}
          value={counts.items.total}
          hint={`${counts.items.active} ${t(locale, "journey.hub.active")}`}
          href="/dashboard/journey/items"
        />
        <CountCard
          icon={<UsersIcon className="size-5" />}
          label={t(locale, "journey.hub.active_owners")}
          value={counts.assignments.ownerCount}
          hint={`${counts.assignments.active} ${t(locale, "journey.hub.active")}`}
          href="/dashboard/journey/assignments"
        />
      </div>

      {/* Governance shortcuts — Layer-1 surfaces */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/journey/cycles"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 transition"
        >
          <Layers className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">מחזורי תוכן</div>
            <div className="text-muted-foreground text-xs">
              מאגר לפי קטגוריה, מצב המשתמשים וכלי התערבות
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/journey/match-rules"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 transition"
        >
          <Filter className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t(locale, "journey.hub.match_rules")}</div>
            <div className="text-muted-foreground text-xs">
              {t(locale, "journey.hub.match_rules_hint")}
            </div>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
        <Link
          href="/dashboard/journey/feedback"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 transition"
        >
          <FileText className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t(locale, "journey.hub.feedback")}</div>
            <div className="text-muted-foreground text-xs">
              {t(locale, "journey.hub.feedback_hint")}
            </div>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
        <Link
          href="/dashboard/journey/expert-messages"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 transition"
        >
          <MessageSquare className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t(locale, "journey.hub.expert_messages")}</div>
            <div className="text-muted-foreground text-xs">
              {t(locale, "journey.hub.expert_messages_hint")}
            </div>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
        <Link
          href="/dashboard/journey/metrics"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 transition"
        >
          <Activity className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t(locale, "journey.hub.metrics")}</div>
            <div className="text-muted-foreground text-xs">
              {t(locale, "journey.hub.metrics_hint")}
            </div>
          </div>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
      </div>

      {/* Programs + standalone categories quick peek */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border bg-card rounded-lg border">
          <header className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Route className="size-4" />
              <h2 className="font-semibold">{t(locale, "journey.hub.programs")}</h2>
            </div>
            <Link
              href="/dashboard/journey/programs"
              className="text-primary text-sm hover:underline"
            >
              {t(locale, "journey.hub.manage")}
            </Link>
          </header>
          <ul className="divide-border divide-y">
            {programs.length === 0 ? (
              <li className="text-muted-foreground p-4 text-sm">
                {t(locale, "journey.hub.no_programs")} —{" "}
                <Link
                  href="/dashboard/journey/programs/new"
                  className="text-primary hover:underline"
                >
                  {t(locale, "journey.hub.create_one")}
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
              <h2 className="font-semibold">{t(locale, "journey.hub.standalone_cats")}</h2>
            </div>
            <Link
              href="/dashboard/journey/categories"
              className="text-primary text-sm hover:underline"
            >
              {t(locale, "journey.hub.manage")}
            </Link>
          </header>
          <ul className="divide-border divide-y">
            {standaloneCats.length === 0 ? (
              <li className="text-muted-foreground p-4 text-sm">
                {t(locale, "journey.hub.no_standalone")}
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
