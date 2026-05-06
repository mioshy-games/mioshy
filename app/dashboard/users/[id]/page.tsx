/**
 * /dashboard/users/[id]
 *
 * Full user detail: profile / subscription / journey progress / answers /
 * analysis / tasks / notes / message history. Interactive pieces live in
 * UserDetailClient.
 */

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
import { QUESTIONS } from "@/lib/journey/questions";
import { axisLabel } from "@/lib/journey/analysis";
import type { Axis } from "@/lib/journey/types";

function answerToText(qId: string, answer: unknown, locale: "he" | "en" = "en"): string {
  const q = QUESTIONS.find((x) => x.id === qId);
  if (!q) return JSON.stringify(answer);
  const a = answer as { kind?: string; value?: number; option?: string; options?: string[]; text?: string; order?: string[] };
  if (a.kind === "likert") return `${a.value}/5`;
  // Narrow to choice-shaped questions before reading .options. The Question
  // union now includes QuestionRanking (no .options) - that variant is
  // handled by the kind === "ranking" branch below.
  const hasOptions = q.type === "forced_choice" || q.type === "single_choice" || q.type === "multi_choice";
  if (a.kind === "single" && hasOptions) {
    const opt = q.options.find((o: { id: string; he: string; en: string }) => o.id === a.option);
    return opt ? (locale === "he" ? opt.he : opt.en) : a.option ?? "-";
  }
  if (a.kind === "multi" && q.type === "multi_choice") {
    return (a.options ?? [])
      .map((id) => {
        const opt = q.options.find((o: { id: string; he: string; en: string }) => o.id === id);
        return opt ? (locale === "he" ? opt.he : opt.en) : id;
      })
      .join(", ");
  }
  if (a.kind === "text") return a.text ?? "";
  return JSON.stringify(answer);
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

  let responses: Array<{ question_id: string; answer: unknown; locale: string; created_at: string }> = [];
  if (journey?.id) {
    const { data } = await supabase
      .from("journey_responses")
      .select("question_id, answer, locale, created_at")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: true });
    responses = data ?? [];
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{overview?.email ?? userId}</CardTitle>
          <CardDescription>
            Journey: {journey?.status ?? "-"} ({journey?.current_step ?? 0}) · Subscription:{" "}
            <Badge variant={overview?.subscription_status === "active" ? "default" : "outline"}>
              {overview?.plan ?? ""} {overview?.subscription_status ?? "none"}
            </Badge>
          </CardDescription>
        </CardHeader>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Answers ({responses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {responses.map((r) => {
              const q = QUESTIONS.find((x) => x.id === r.question_id);
              return (
                <li key={r.question_id} className="rounded border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{q?.id}</div>
                  <div className="font-medium">{q && ("en" in q ? q.en : q.en_prompt)}</div>
                  <div>{answerToText(r.question_id, r.answer, "en")}</div>
                </li>
              );
            })}
            {!responses.length ? <li className="text-muted-foreground">No answers yet.</li> : null}
          </ul>
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
