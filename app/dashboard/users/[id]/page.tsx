/**
 * /dashboard/users/[id]
 *
 * Full user detail: profile / subscription / journey progress / answers /
 * analysis / tasks / notes / message history. Interactive pieces live in
 * UserDetailClient.
 */

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserDetailClient } from "@/components/dashboard/UserDetailClient";
// 2026-05-28 — admin one-click "force day-1" for stuck paying users.
// Sits next to the Analysis card so the operator has all the context
// (scores, narrative) plus the recovery affordance in one place.
import { ForceMaterializeDay1Button } from "@/components/dashboard/ForceMaterializeDay1Button";
import { axisLabel } from "@/lib/journey/analysis";
import type { Axis } from "@/lib/journey/types";
import {
  loadUserAssessmentAnswers,
  type AssessmentPhase,
} from "@/lib/dashboard/assessment-answers";
// Phase 3 (admin-analytics-spec §7.2) — per-user behavior 360°.
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAdminLocale, isRtl } from "@/lib/admin/locale";
import { loadUserBehavior } from "@/lib/dashboard/user-behavior";
import { UserBehaviorTabs } from "@/components/dashboard/UserBehaviorTabs";

// B.5 — short/full grouping labels for the admin. Hebrew first (the expert
// reads the user's Hebrew answers) with the en tag alongside.
function phaseLabel(p: AssessmentPhase): string {
  if (p === "short") return "אבחון קצר · Short";
  if (p === "full") return "אבחון מלא · Full";
  return "נוסף · Other";
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const userId = params.id;

  const [
    { data: overview },
    { data: journey },
    { data: analysis },
    { data: tasks },
    { data: notes },
    { data: messages },
    { data: templates },
  ] = await Promise.all([
    supabase.from("admin_users_overview").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("journeys")
      .select("id, status, current_step, language, started_at, last_activity_at, completed_at")
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("journey_analysis")
      .select("*")
      .eq("user_id", userId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("journey_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_notes")
      .select("id, body, is_pinned, created_at, author_id")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("sent_messages")
      .select("id, channel, subject, to_address, sent_by, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("message_templates").select("id, key, channel, subject_en, body_en").eq("is_active", true).order("key"),
  ]);

  // B.5 — gather ALL of this user's journey-assessment answers (short + full),
  // grouped by phase and labeled with question text + readable answer values.
  const answers = await loadUserAssessmentAnswers(supabase, userId);

  // Phase 3 — per-user behavior. The Phase-2 views + analytics_events +
  // auth_login_events are RLS-locked to service_role, so we read them with the
  // service-role client (requireAdmin already gated this route). Null only if
  // the service-role env is missing — then the section is simply omitted.
  const adminDb = createServiceRoleClient();
  const behavior = adminDb ? await loadUserBehavior(adminDb, userId) : null;
  const adminLocale = getAdminLocale();

  // Deep-link target for "open chat in console": couples open the couple
  // conversation, solo users open their own thread. One small membership read.
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userId)
    .maybeSingle();
  const consoleHref = membership?.couple_id
    ? `/dashboard/console?couple=${membership.couple_id}`
    : `/dashboard/console?user=${userId}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{overview?.email ?? userId}</CardTitle>
              <CardDescription>
                Journey: {journey?.status ?? "-"} ({journey?.current_step ?? 0}) · Subscription:{" "}
                <Badge variant={overview?.subscription_status === "active" ? "default" : "outline"}>
                  {overview?.plan ?? ""} {overview?.subscription_status ?? "none"}
                </Badge>
              </CardDescription>
            </div>
            <Link
              href={consoleHref}
              className="bg-primary text-primary-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:brightness-110"
            >
              <MessageCircle className="size-4" />
              פתח צ׳אט בקונסולה
            </Link>
          </div>
        </CardHeader>
      </Card>

      {behavior ? (
        <UserBehaviorTabs
          userId={userId}
          locale={adminLocale}
          isRtl={isRtl(adminLocale)}
          data={behavior}
        />
      ) : null}

      {analysis ? (
        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
            <CardDescription>
              Friendship {analysis.friendship_score}/100 · Conflict {analysis.conflict_health}/100 ·
              Passion risk {analysis.passion_risk}/100
              {analysis.four_horsemen_flag ? <Badge variant="destructive" className="ml-2">horsemen</Badge> : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">{analysis.summary?.narrative_en}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {analysis.primary_love_language ? (
                <Badge variant="secondary">Primary: {axisLabel(analysis.primary_love_language as Axis, "en")}</Badge>
              ) : null}
              {analysis.top_gap ? (
                <Badge variant="secondary">Top gap: {axisLabel(analysis.top_gap as Axis, "en")}</Badge>
              ) : null}
            </div>
            {analysis.summary?.recommendations?.length ? (
              <ul className="list-disc pl-5 text-sm">
                {analysis.summary.recommendations.map((r: { id: string; en: string }) => (
                  <li key={r.id}>{r.en}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 2026-05-28 — Journey recovery row. Force-materializes a
          fresh day-1 cadence item for this user. Use when a paying
          user has priorities but their dashboard / timeline shows
          empty. The action is idempotent (cadence engine dedup) and
          surfaces the engine's exact failure reason inline. */}
      <Card>
        <CardHeader>
          <CardTitle>Journey recovery</CardTitle>
          <CardDescription>
            Force-fire a day-1 cadence materialize. Safe to click
            repeatedly — the engine dedups against
            journey_user_delivered_items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForceMaterializeDay1Button userId={userId} />
        </CardContent>
      </Card>

      {/* B.5 — Assessment answers, gathered under the user. All of the short
          (pre-purchase) and full (long) journey-assessment answers in one
          place, split by phase, each shown as question + readable answer. */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment answers ({answers.total})</CardTitle>
          <CardDescription>
            All of this user&apos;s diagnostic answers — short and full — in one
            place.
            {answers.journeyCount > 1
              ? ` · ${answers.journeyCount} journeys (latest answer per question shown)`
              : ""}
            {answers.source === "json"
              ? " · question text from bundled fallback"
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {answers.groups.map((g) => (
            <div key={g.phase} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{phaseLabel(g.phase)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {g.items.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {g.items.map((it) => (
                  <li key={it.questionId} className="rounded border px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      {it.questionId}
                    </div>
                    <div className="font-medium" dir="auto">
                      {it.prompt}
                    </div>
                    <div dir="auto" className="whitespace-pre-wrap text-foreground/90">
                      {it.answerText}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!answers.total ? (
            <p className="text-sm text-muted-foreground">No answers yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <UserDetailClient
        userId={userId}
        email={overview?.email ?? ""}
        initialNotes={notes ?? []}
        initialTasks={tasks ?? []}
        initialMessages={messages ?? []}
        templates={templates ?? []}
      />
    </div>
  );
}
