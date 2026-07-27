import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { computePollPercent } from "@/lib/poll/percent";
import { PollAdmin, type AdminQuestion } from "@/components/admin/poll/PollAdmin";

export const dynamic = "force-dynamic";

export default async function PollAdminPage() {
  if (!(await getAdminSession())) notFound();

  const admin = await createAdminClient();
  const [{ data: qs }, { data: aggs }] = await Promise.all([
    admin
      .from("poll_questions")
      .select("id, text, option_a, option_b, order_index, domain, is_active")
      .order("order_index", { ascending: true }),
    admin.from("poll_vote_aggregates").select("question_id, count_a, count_b"),
  ]);

  const aggMap = new Map((aggs ?? []).map((a) => [a.question_id as string, a as { count_a: number; count_b: number }]));

  const questions: AdminQuestion[] = (qs ?? []).map((q) => {
    const a = aggMap.get(q.id as string) ?? { count_a: 0, count_b: 0 };
    const pct = computePollPercent({ countA: a.count_a, countB: a.count_b });
    return {
      id: q.id,
      text: q.text,
      optionA: q.option_a,
      optionB: q.option_b,
      orderIndex: q.order_index,
      domain: q.domain,
      isActive: q.is_active,
      countA: a.count_a,
      countB: a.count_b,
      pctA: pct.pctA,
      pctB: pct.pctB,
      totalVotes: pct.totalVotes,
    };
  });

  return <PollAdmin questions={questions} />;
}
