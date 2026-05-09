/**
 * /dashboard/journey/expert-messages
 *
 * Layer-3 admin tracker (FU6 step 1) — single page where an admin
 * can monitor every expert message sent across the platform.
 *
 * Sources merged into one feed:
 *   - journey_messages (per-item threads + per-user general channel)
 *   - journey_couple_channel_messages (couple-shared channel)
 *
 * Filters: coach, couple, date range, topic tag (incl. "untagged").
 * Top stats: this week / this month + per-coach top-5.
 *
 * The page is a server component that loads stats + initial messages
 * with no filters, then hands the heavy interactivity to the client
 * component <ExpertMessagesView/>. Re-filtering today does a soft
 * navigation via search params; pagination ships in a follow-up.
 */

import Link from "next/link";
import { ArrowLeft, Filter as FilterIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  listAdminExpertMessages,
  getAdminExpertMessageStats,
  type AdminMessageFilters,
} from "@/lib/journey/admin-messages";
import { ExpertMessagesView } from "@/components/dashboard/journey/ExpertMessagesView";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { SectionHelp } from "@/components/dashboard/SectionHelp";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: {
    expert?:    string;
    couple?:    string;
    tag?:       string;
    untagged?:  string;
    from?:      string;
    to?:        string;
  };
}

export default async function ExpertMessagesPage({
  searchParams,
}: PageProps) {
  await requireAdmin();
  const locale = getAdminLocale();

  const filters: AdminMessageFilters = {
    expertId:     searchParams?.expert ?? null,
    coupleId:     searchParams?.couple ?? null,
    tag:          searchParams?.tag ?? null,
    untaggedOnly: searchParams?.untagged === "1",
    fromDate:     searchParams?.from ?? null,
    toDate:       searchParams?.to ?? null,
    limit:        200,
  };

  const [stats, messages] = await Promise.all([
    getAdminExpertMessageStats(),
    listAdminExpertMessages(filters),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          {t(locale, "btn.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <FilterIcon className="size-5" />
          <h1 className="text-3xl font-bold tracking-tight">
            {t(locale, "journey.em.title")}
          </h1>
          <SectionHelp
            title="הודעות מומחים — מעקב חוצה־מאמנים"
            body={
              <>
                <p>
                  פיד של <strong>כל הודעה ששלח מאמן</strong> במערכת — בכל
                  שלושת ערוצי התקשורת (פר־פריט / ערוץ אישי / ערוץ זוגי).
                </p>
                <p>
                  <strong>למה זה שימושי:</strong> אדמין רואה ב-1 מקום מה
                  שמאמנים שולחים. אם מאמן יורד באיכות / מטפל יותר מדי /
                  פחות מדי — רואים פה. אם נושא מסוים בטרנד (למשל
                  &quot;קונפליקט&quot; עולה ב-30%) — רואים פה.
                </p>
                <p>
                  <strong>פילטרים:</strong> לפי מאמן / זוג / טווח תאריכים /
                  תגית נושא / לא־מתויגות בלבד.
                </p>
                <p>
                  <strong>תגיות:</strong> מגיעות אוטומטית מהספרייה האישית
                  של המאמן (כשמשתמש בתגובה שמורה). הודעות לא מתויגות הן
                  &quot;תגובות אורגניות&quot; (נכתבו מאפס).
                </p>
              </>
            }
            aiNote={
              <p>
                ה-AI <em>לא</em> מסווג הודעות מאמן (הוא מסווג רק הודעות
                משתמש). כל המעקב כאן מבוסס על תגיות ידניות מהספרייה. אם
                תרצו לדעת איזה הודעות משתמש דחופות — לכו ל-
                <Link href="/dashboard/journey/metrics" className="text-primary hover:underline">
                  מטריקות
                </Link>
                .
              </p>
            }
          />
        </div>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          {t(locale, "journey.em.subtitle")}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t(locale, "journey.em.kpi_alltime")}
          value={stats.totalAllTime}
          hint={t(locale, "journey.em.kpi_alltime_hint")}
        />
        <StatCard
          label={t(locale, "journey.em.kpi_7d")}
          value={stats.totalThisWeek}
          hint={t(locale, "journey.em.kpi_7d_hint")}
        />
        <StatCard
          label={t(locale, "journey.em.kpi_30d")}
          value={stats.totalThisMonth}
          hint={t(locale, "journey.em.kpi_30d_hint")}
        />
      </div>

      {/* Top coaches + top tags side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-border bg-card rounded-lg border">
          <header className="border-b border-border p-3">
            <h2 className="font-semibold text-sm">{t(locale, "journey.em.top_coaches")}</h2>
          </header>
          <ul className="divide-border divide-y">
            {stats.topCoachesMonth.length === 0 ? (
              <li className="text-muted-foreground p-3 text-xs">
                {t(locale, "journey.em.no_topcoaches")}
              </li>
            ) : (
              stats.topCoachesMonth.map((c) => (
                <li
                  key={c.expertId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <span className="font-medium">{c.name_he}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="border-border bg-card rounded-lg border">
          <header className="border-b border-border p-3">
            <h2 className="font-semibold text-sm">{t(locale, "journey.em.top_tags")}</h2>
          </header>
          <ul className="divide-border divide-y">
            {stats.topTags.length === 0 ? (
              <li className="text-muted-foreground p-3 text-xs">
                {t(locale, "journey.em.no_toptags")}
              </li>
            ) : (
              stats.topTags.map((t) => (
                <li
                  key={t.tag}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <span className="font-mono text-xs">{t.tag}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* Filters + messages list (client component) */}
      <ExpertMessagesView
        messages={messages}
        coaches={stats.allCoaches}
        tags={stats.allTags}
        currentFilters={{
          expertId:     filters.expertId ?? null,
          coupleId:     filters.coupleId ?? null,
          tag:          filters.tag ?? null,
          untaggedOnly: filters.untaggedOnly ?? false,
          fromDate:     filters.fromDate ?? null,
          toDate:       filters.toDate ?? null,
        }}
        locale={locale}
      />

      <p className="text-muted-foreground text-xs">
        Showing up to <strong>{messages.length}</strong> messages
        {filters.expertId || filters.coupleId || filters.tag || filters.untaggedOnly || filters.fromDate || filters.toDate
          ? " (filtered)"
          : ""}
        . V1 ships with a 200-row cap; pagination lands in V2.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </div>
  );
}
