"use client";

/**
 * UserBehaviorTabs — the per-user "360°" behavior panel on
 * /dashboard/users/[id] (admin-analytics-spec §7.2, Phase 3).
 *
 * Pure presentational: all data is fetched server-side (service-role, behind
 * requireAdmin) and passed in as props. Metadata only — no intimate content
 * (privacy approach A, §10.1). The "Reply" button links to the existing
 * therapeutic threads (my-clients / expert-messages) where content lives.
 */

import { Link } from "@/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import type { UserBehavior } from "@/lib/dashboard/user-behavior";

export function UserBehaviorTabs({
  userId,
  locale,
  isRtl,
  data,
}: {
  userId: string;
  locale: AdminLocale;
  isRtl: boolean;
  data: UserBehavior;
}) {
  const tt = (k: string) => t(locale, k);
  const dateLocale = locale === "he" ? "he-IL" : "en-US";
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" })
      : "—";
  const mins = (ms: number | null) =>
    ms && ms > 0 ? `${(ms / 60000).toFixed(1)} ${tt("behavior.minutes")}` : "—";

  // Reply deep-link: per-couple work window if paired, else the expert-messages
  // tracker filtered to this user (mirrors PendingMessagesCard.deepLinkFor).
  const replyHref = data.coupleId
    ? `/dashboard/my-clients/${data.coupleId}#general`
    : `/dashboard/journey/expert-messages?user=${userId}`;

  const maxHour = Math.max(1, ...data.hourHistogram);

  return (
    <Card dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle>{tt("behavior.section")}</CardTitle>
        <CardDescription>{tt("behavior.section_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logins" className="flex-col gap-4">
          <TabsList>
            <TabsTrigger value="logins">{tt("behavior.tab_logins")}</TabsTrigger>
            <TabsTrigger value="services">{tt("behavior.tab_services")}</TabsTrigger>
            <TabsTrigger value="games">{tt("behavior.tab_games")}</TabsTrigger>
            <TabsTrigger value="adults">{tt("behavior.tab_adults")}</TabsTrigger>
            <TabsTrigger value="abandon">{tt("behavior.tab_abandon")}</TabsTrigger>
          </TabsList>

          {/* ── Logins ───────────────────────────────────────────────────── */}
          <TabsContent value="logins" className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{tt("behavior.logins_count")}: {data.loginSummary.count}</Badge>
              <Badge variant="outline">{tt("behavior.first_login")}: {fmt(data.loginSummary.first)}</Badge>
              <Badge variant="outline">{tt("behavior.last_login")}: {fmt(data.loginSummary.last)}</Badge>
              {data.loginSummary.lastCountry ? (
                <Badge variant="outline">{tt("behavior.last_country")}: {data.loginSummary.lastCountry}</Badge>
              ) : null}
            </div>

            {/* Hours heatmap — 24 cells, intensity = login count in that hour */}
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{tt("behavior.hours_heatmap")}</div>
              <div className="flex flex-wrap gap-1" dir="ltr">
                {data.hourHistogram.map((count, h) => (
                  <div
                    key={h}
                    title={`${String(h).padStart(2, "0")}:00 — ${count}`}
                    className="flex h-7 w-7 items-center justify-center rounded text-[10px] tabular-nums"
                    style={{
                      backgroundColor: count
                        ? `rgba(99,102,241,${0.18 + 0.82 * (count / maxHour)})`
                        : "rgba(255,255,255,0.04)",
                      color: count ? "#fff" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>

            {data.logins.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("behavior.when")}</TableHead>
                    <TableHead>{tt("behavior.device")}</TableHead>
                    <TableHead>{tt("behavior.last_country")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logins.slice(0, 30).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{fmt(l.at)}</TableCell>
                      <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground" dir="ltr" title={l.ua ?? ""}>
                        {l.ua ?? "—"}
                      </TableCell>
                      <TableCell>{l.country ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty text={tt("behavior.no_logins")} />
            )}
          </TabsContent>

          {/* ── Services (dwell) ─────────────────────────────────────────── */}
          <TabsContent value="services" className="flex flex-col gap-4">
            <div className="text-xs text-muted-foreground">{tt("behavior.dwell_by_pillar")}</div>
            {data.dwell.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("behavior.pillar")}</TableHead>
                    <TableHead>{tt("behavior.total_time")}</TableHead>
                    <TableHead>{tt("behavior.events")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dwell.map((d) => (
                    <TableRow key={d.pillar}>
                      <TableCell><Badge variant="secondary">{d.pillar}</Badge></TableCell>
                      <TableCell>{mins(d.totalMs)}</TableCell>
                      <TableCell>{d.events}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty text={tt("behavior.no_dwell")} />
            )}

            <div className="text-xs text-muted-foreground">{tt("behavior.timeline")}</div>
            {data.timeline.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("behavior.when")}</TableHead>
                    <TableHead>{tt("behavior.event")}</TableHead>
                    <TableHead>{tt("behavior.pillar")}</TableHead>
                    <TableHead>{tt("behavior.ref")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.timeline.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{fmt(e.at)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.event}</TableCell>
                      <TableCell>{e.pillar ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground" dir="ltr">{e.ref ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty text={tt("behavior.no_timeline")} />
            )}
          </TabsContent>

          {/* ── Games ────────────────────────────────────────────────────── */}
          <TabsContent value="games" className="flex flex-col gap-4">
            {data.games.snakes.sessions || data.games.wheel.sessions ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniCard title={tt("behavior.snakes")}>
                  <Stat label={tt("behavior.sessions")} value={data.games.snakes.sessions} />
                  <Stat label={tt("behavior.completed")} value={data.games.snakes.completed} />
                  <Stat label={tt("behavior.abandoned")} value={data.games.snakes.abandoned} />
                  <Stat label={tt("behavior.avg_duration")} value={mins(data.games.snakes.avgDurationMs)} />
                </MiniCard>
                <MiniCard title={tt("behavior.wheel")} note={tt("behavior.engagement")}>
                  <Stat label={tt("behavior.sessions")} value={data.games.wheel.sessions} />
                  <Stat label={tt("behavior.spins")} value={data.games.wheel.totalSpins} />
                  <Stat label={tt("behavior.avg_duration")} value={mins(data.games.wheel.avgDurationMs)} />
                </MiniCard>
              </div>
            ) : (
              <Empty text={tt("behavior.no_games")} />
            )}
          </TabsContent>

          {/* ── Adults ───────────────────────────────────────────────────── */}
          <TabsContent value="adults" className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{tt("behavior.adults_dwell")}: {mins(data.adultsDwellMs)}</Badge>
            </div>
            {data.adults.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("behavior.game")}</TableHead>
                    <TableHead>{tt("behavior.opens")}</TableHead>
                    <TableHead>{tt("behavior.last_seen")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.adults.map((a) => (
                    <TableRow key={a.key}>
                      <TableCell className="font-mono text-xs" dir="ltr">{a.key}</TableCell>
                      <TableCell>{a.opens}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(a.lastAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty text={tt("behavior.no_adults")} />
            )}
          </TabsContent>

          {/* ── Abandonment ──────────────────────────────────────────────── */}
          <TabsContent value="abandon" className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={data.abandonment.checkoutSessions ? "destructive" : "outline"}>
                {tt("behavior.stuck_checkout")}: {data.abandonment.checkoutSessions}
              </Badge>
              <Badge variant={data.abandonment.snakesAbandoned ? "destructive" : "outline"}>
                {tt("behavior.stuck_snakes")}: {data.abandonment.snakesAbandoned}
              </Badge>
              <Link href={replyHref} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                {tt("behavior.reply")}
              </Link>
            </div>

            <div className="text-xs text-muted-foreground">{tt("behavior.stuck_chapters")}</div>
            {data.abandonment.chapters.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("behavior.chapter")}</TableHead>
                    <TableHead>{tt("behavior.opened_at")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.abandonment.chapters.map((c) => (
                    <TableRow key={c.scheduledItemId}>
                      <TableCell className="font-mono text-xs" dir="ltr">{c.scheduledItemId}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(c.openedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty text={tt("behavior.no_abandon")} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function MiniCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold">{title}</span>
        {note ? <span className="text-[11px] text-muted-foreground">· {note}</span> : null}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
