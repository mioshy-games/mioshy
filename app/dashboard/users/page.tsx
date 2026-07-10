/**
 * /dashboard/users — admin customer list (admin-analytics-spec §7.1, Phase 4).
 *
 * Search (name / email / phone) + filters (last-login date, entitlement pillar,
 * activity level) + sort (last login / activity level) + pagination — all done
 * IN THE DB against v_user_directory (migration 133), so there is no per-user
 * loop and no N+1. The view is RLS-locked to service_role, so we read it with
 * the service-role client (requireAdmin already gated the route). Metadata only
 * (privacy approach A, §10.1).
 */

import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const PILLARS = ["journey", "games", "adults"] as const;
const LEVELS = ["active", "cooling", "churned"] as const;
// Coaching add-on filter (journey subs only). "with"/"without" map to
// subscriptions.coaching = true/false on an active journey subscription.
const COACHINGS = ["with", "without"] as const;
const SORTS = ["last_login_at", "activity_level"] as const;

type SearchParams = {
  q?: string;
  from?: string;
  pillar?: string;
  level?: string;
  coaching?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const inputCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

function levelBadge(level: string | null, label: string) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const variant =
    level === "active" ? "default" : level === "cooling" ? "secondary" : "destructive";
  return <Badge variant={variant}>{label}</Badge>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin(); // gate
  const locale = getAdminLocale();
  const tt = (k: string) => t(locale, k);
  const rtl = isRtl(locale);
  const dateLocale = locale === "he" ? "he-IL" : "en-US";

  const admin = createServiceRoleClient();

  // ── Parse params ───────────────────────────────────────────────────────────
  const q = (searchParams.q ?? "").trim();
  // Strip PostgREST .or() control chars so a search term can't break the filter.
  const qSafe = q.replace(/[,()*%\\]/g, "").slice(0, 80);
  const from = (searchParams.from ?? "").trim();
  const pillar = PILLARS.includes(searchParams.pillar as never) ? searchParams.pillar! : "";
  const level = LEVELS.includes(searchParams.level as never) ? searchParams.level! : "";
  const coaching = COACHINGS.includes(searchParams.coaching as never) ? searchParams.coaching! : "";
  const sort = SORTS.includes(searchParams.sort as never) ? (searchParams.sort as string) : "last_login_at";
  const ascending = searchParams.dir === "asc";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // ── Query (filter + sort + paginate, all in the DB) ────────────────────────
  let rows: Record<string, unknown>[] = [];
  let count = 0;
  if (admin) {
    // Coaching filter: v_user_directory has no coaching column, so resolve the
    // set of users with an active journey subscription of the requested coaching
    // flag directly from subscriptions, then constrain the view query by user_id.
    // Keeps filtering + pagination + count in the DB (no per-user loop).
    let coachingUserIds: string[] | null = null;
    if (coaching) {
      const { data: subRows } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("product", "journey")
        .eq("status", "active")
        .eq("coaching", coaching === "with");
      coachingUserIds = [
        ...new Set(
          ((subRows ?? []) as Array<{ user_id: string | null }>)
            .map((s) => s.user_id)
            .filter((id): id is string => !!id),
        ),
      ];
    }

    let query = admin.from("v_user_directory").select("*", { count: "exact" });
    if (qSafe) {
      query = query.or(
        `email.ilike.%${qSafe}%,full_name.ilike.%${qSafe}%,phone.ilike.%${qSafe}%`,
      );
    }
    if (from) query = query.gte("last_login_at", from);
    // Entitlement filter uses the bool_or flags (a user can own >1 pillar).
    if (pillar === "journey") query = query.eq("owns_journey", true);
    else if (pillar === "games") query = query.eq("owns_games", true);
    else if (pillar === "adults") query = query.eq("owns_adults", true);
    if (level) query = query.eq("activity_level", level);
    // Empty set → match nothing (sentinel), else constrain to the resolved users.
    if (coachingUserIds) {
      query = query.in(
        "user_id",
        coachingUserIds.length
          ? coachingUserIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    query = query
      .order(sort, { ascending, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const res = await query;
    rows = (res.data ?? []) as Record<string, unknown>[];
    count = res.count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Build an href preserving current params with overrides.
  const hrefWith = (overrides: Partial<SearchParams>) => {
    const sp = new URLSearchParams();
    const merged: SearchParams = {
      q, from, pillar, level, coaching, sort,
      dir: ascending ? "asc" : "desc",
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/dashboard/users?${s}` : "/dashboard/users";
  };

  // Sortable column header — toggles direction on the active column.
  const sortHeader = (key: (typeof SORTS)[number], label: string) => {
    const active = sort === key;
    const nextDir = active && !ascending ? "asc" : "desc";
    const arrow = active ? (ascending ? " ▲" : " ▼") : "";
    return (
      <Link href={hrefWith({ sort: key, dir: nextDir, page: "1" })} className="underline-offset-4 hover:underline">
        {label}{arrow}
      </Link>
    );
  };

  const fmtDate = (v: unknown) =>
    v ? new Date(v as string).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" }) : "—";

  // Short date + time for consent timestamps (e.g. "23 ביוני 2026, 14:05").
  const fmtDateTime = (v: unknown) =>
    v
      ? new Date(v as string).toLocaleString(dateLocale, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";

  // Consent cell: yes/no badge + the acceptance timestamp. `undefined` means
  // the view column isn't present yet (migration 142 not applied) → render "—".
  const consentCell = (flag: unknown, at: unknown) => {
    if (flag === undefined || flag === null) {
      return <span className="text-muted-foreground">—</span>;
    }
    const yes = flag === true;
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={yes ? "default" : "outline"}>
          {tt(yes ? "customers.consent_yes" : "customers.consent_no")}
        </Badge>
        {yes && at ? (
          <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
            {fmtDateTime(at)}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir={rtl ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle>{tt("customers.title")}</CardTitle>
          <CardDescription>{tt("customers.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Search + filters — native GET form (SSR, no client fetch). */}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={ascending ? "asc" : "desc"} />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={tt("customers.search_ph")}
              className={cn(inputCls, "min-w-[220px] flex-1")}
            />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {tt("customers.filter_from")}
              <input type="date" name="from" defaultValue={from} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {tt("customers.filter_pillar")}
              <select name="pillar" defaultValue={pillar} className={inputCls}>
                <option value="">{tt("customers.all")}</option>
                {PILLARS.map((p) => (
                  <option key={p} value={p}>{tt(`customers.pillar_${p}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {tt("customers.filter_level")}
              <select name="level" defaultValue={level} className={inputCls}>
                <option value="">{tt("customers.all")}</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{tt(`customers.level_${l}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {tt("customers.filter_coaching")}
              <select name="coaching" defaultValue={coaching} className={inputCls}>
                <option value="">{tt("customers.all")}</option>
                <option value="with">{tt("customers.coaching_with")}</option>
                <option value="without">{tt("customers.coaching_without")}</option>
              </select>
            </label>
            <button type="submit" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
              {tt("customers.apply")}
            </button>
            <Link href="/dashboard/users" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {tt("customers.clear")}
            </Link>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tt("customers.col_name")}</TableHead>
                <TableHead>{tt("customers.col_email")}</TableHead>
                <TableHead>{sortHeader("last_login_at", tt("customers.col_last_login"))}</TableHead>
                <TableHead>{tt("customers.col_chapters")}</TableHead>
                <TableHead>{tt("customers.col_games")}</TableHead>
                <TableHead>{sortHeader("activity_level", tt("customers.col_status"))}</TableHead>
                <TableHead>{tt("customers.col_sub")}</TableHead>
                <TableHead>{tt("customers.col_marketing")}</TableHead>
                <TableHead>{tt("customers.col_terms")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((r) => (
                  <TableRow key={r.user_id as string}>
                    <TableCell className="font-medium" dir="auto">
                      <Link href={`/dashboard/users/${r.user_id}`} className="underline underline-offset-4">
                        {(r.full_name as string) || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{(r.email as string) || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.last_login_at)}</TableCell>
                    <TableCell className="tabular-nums">{(r.completed_chapters as number) ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{(r.games_played as number) ?? 0}</TableCell>
                    <TableCell>
                      {levelBadge(
                        r.activity_level as string | null,
                        tt(`customers.level_${(r.activity_level as string) || "none"}`),
                      )}
                    </TableCell>
                    <TableCell>
                      {r.subscription_status ? (
                        <Badge variant={r.subscription_status === "active" ? "default" : "outline"}>
                          {(r.subscription_product as string) || (r.plan as string) || ""} {r.subscription_status as string}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{consentCell(r.marketing_consent, r.marketing_consent_at)}</TableCell>
                    <TableCell>{consentCell(r.terms_accepted, r.terms_accepted_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {admin ? tt("customers.none") : tt("customers.no_service_role")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{tt("customers.page")} {page} / {totalPages} · {count}</span>
            <div className="flex gap-2">
              <Link
                href={hrefWith({ page: String(Math.max(1, page - 1)) })}
                aria-disabled={page <= 1}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
              >
                {tt("customers.prev")}
              </Link>
              <Link
                href={hrefWith({ page: String(Math.min(totalPages, page + 1)) })}
                aria-disabled={page >= totalPages}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-50")}
              >
                {tt("customers.next")}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
