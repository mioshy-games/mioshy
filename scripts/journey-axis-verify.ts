/**
 * Verification report for the axis-versioning fix (migrations 195-198).
 *
 * READ-ONLY. Runs entirely off the captured fixture — touches no database.
 *
 *   1. The invariance gate, with counts: how many journeys answered entirely
 *      before 2026-07-01 were checked, and how many drifted. Drift must be 0.
 *   2. The five result-page categories for a real journey, before and after,
 *      so the fix can be judged on what a person actually sees.
 *
 * Run: pnpm exec tsx scripts/journey-axis-verify.ts
 */

import { readFileSync } from "node:fs";
import { analyze } from "@/lib/journey/analysis";
import { buildVersionedQuestionResolver } from "@/lib/journey/question-versions";
import type { AxisWeight, Question, Response } from "@/lib/journey/types";

const REWRITE_AT: Record<string, string> = {
  q02_admiration_see_good: "2026-07-01T06:32:44Z",
  q03_bids_turn_toward: "2026-07-01T07:08:55Z",
  q11_contempt: "2026-07-01T06:55:04Z",
  q24_physical_closeness: "2026-07-01T06:56:16Z",
  q20_biggest_gap: "2026-07-12T06:31:01Z",
  q01_knowledge_world: "2026-07-20T08:00:19Z",
  q17_context_logistics: "2026-07-20T08:00:58Z",
  q19_rituals: "2026-07-20T08:03:04Z",
};
const V1_AXES: Record<string, AxisWeight[]> = {
  q01_knowledge_world: [{ axis: "love_map", weight: 1 }],
  q02_admiration_see_good: [{ axis: "fondness", weight: 1 }],
  q03_bids_turn_toward: [{ axis: "turn_toward", weight: 1 }],
  q11_contempt: [{ axis: "four_horsemen_contempt", weight: 1 }],
  q17_context_logistics: [{ axis: "passion_context", weight: -1 }],
  q19_rituals: [{ axis: "shared_meaning", weight: 0.5 }],
  q24_physical_closeness: [
    { axis: "love_language_touch", weight: 0.5 },
    { axis: "passion_play", weight: 0.5 },
  ],
};
const V2_AXES: Record<string, AxisWeight[]> = {
  q01_knowledge_world: [{ axis: "intimacy_presence", weight: 1 }],
  q02_admiration_see_good: [{ axis: "shared_meaning", weight: 1 }],
  q03_bids_turn_toward: [{ axis: "turn_toward", weight: 1 }],
  q11_contempt: [{ axis: "fondness", weight: 1 }],
  q17_context_logistics: [{ axis: "shared_meaning", weight: 1 }],
  q19_rituals: [{ axis: "emotional_safety", weight: 1 }],
  q24_physical_closeness: [{ axis: "passion_context", weight: 1 }],
};

const fx = JSON.parse(
  readFileSync("tests/journey/__fixtures__/journey-axis-fixture.json", "utf8"),
) as {
  questions: Array<{ slug: string; type: string; axes: AxisWeight[]; options: unknown }>;
  responses: Array<{ journey_id: string; question_id: string; answer: unknown; created_at: string }>;
};

const currentQuestions: Question[] = fx.questions.map((q) => {
  const base = { id: q.slug, category: "free", domain: null, axes: q.axes, purpose: "", he: "", en: "" };
  if (q.type === "likert5") return { ...base, type: "likert5" } as Question;
  return { ...base, type: q.type, he_prompt: "", en_prompt: "", options: q.options ?? [] } as unknown as Question;
});

const versions = fx.questions.flatMap((q) => {
  const at = REWRITE_AT[q.slug];
  if (!at)
    return [{ slug: q.slug, version: 1, valid_from: "-infinity", valid_to: null, he_text: "", en_text: null, axes: q.axes, reverse: false, options: q.options as never, type: q.type }];
  return [
    { slug: q.slug, version: 1, valid_from: "-infinity", valid_to: at, he_text: "", en_text: null, axes: V1_AXES[q.slug] ?? q.axes, reverse: false, options: q.options as never, type: q.type },
    { slug: q.slug, version: 2, valid_from: at, valid_to: null, he_text: "", en_text: null, axes: V2_AXES[q.slug] ?? q.axes, reverse: false, options: q.options as never, type: q.type },
  ];
});

const byId = new Map(currentQuestions.map((q) => [q.id, q]));
const legacy = (slug: string) => byId.get(slug);
const versioned = buildVersionedQuestionResolver(currentQuestions, versions);

const journeys = new Map<string, Response[]>();
for (const r of fx.responses) {
  const list = journeys.get(r.journey_id) ?? [];
  list.push({ question_id: r.question_id, answer: r.answer as Response["answer"], locale: "he", created_at: r.created_at });
  journeys.set(r.journey_id, list);
}

const CUTOFF = Date.parse("2026-07-01T00:00:00Z");
// Priority labels are only used for narrative copy, not for the scores this
// report is about. A stub keeps the script free of a DB round-trip.
const KEYS = ["communication", "intimacy", "emotional_connection", "friendship", "family"] as const;
const stub = Object.fromEntries(KEYS.map((k) => [k, k])) as Record<string, string>;
const LABELS = {
  labelsHe: stub, labelsEn: stub, descsHe: stub, descsEn: stub,
  canonicalOrder: [...KEYS],
} as never;

// ── 1. invariance ───────────────────────────────────────────────────────────
let checked = 0, drifted = 0, straddling = 0, after = 0;
const preRewriteQuestions = currentQuestions.map((q) =>
  V1_AXES[q.id] ? ({ ...q, axes: V1_AXES[q.id] } as Question) : q,
);
const preById = new Map(preRewriteQuestions.map((q) => [q.id, q]));
for (const [, responses] of journeys) {
  const allBefore = responses.every((r) => Date.parse(r.created_at!) < CUTOFF);
  const allAfter = responses.every((r) => Date.parse(r.created_at!) >= CUTOFF);
  if (!allBefore) { if (allAfter) after++; else straddling++; continue; }
  const before = analyze(responses, LABELS, (s: string) => preById.get(s)).axis_scores;
  const now = analyze(responses, LABELS, versioned).axis_scores;
  checked++;
  if (JSON.stringify(before) !== JSON.stringify(now)) drifted++;
}
console.log("── INVARIANCE GATE ──────────────────────────────────────────");
console.log(`journeys answered entirely BEFORE 2026-07-01 : ${checked}`);
console.log(`  of those, scores that DRIFTED             : ${drifted}   ${drifted === 0 ? "✅ PASS" : "❌ FAIL"}`);
console.log(`journeys answered entirely after the cutoff  : ${after}`);
console.log(`journeys straddling the cutoff               : ${straddling}`);

// ── 2. five categories for a real journey ───────────────────────────────────
// Pick a journey answered ENTIRELY AFTER the first rewrite — that is the cohort
// whose results were actually wrong, so it is the one worth showing. A
// pre-rewrite journey is unchanged by design and would demonstrate nothing.
const target = [...journeys.entries()]
  .filter(([, rs]) =>
    rs.length >= 12 &&
    rs.some((r) => r.question_id in V2_AXES) &&
    rs.every((r) => Date.parse(r.created_at!) >= CUTOFF))
  .sort((a, b) => b[1].length - a[1].length)[0];

if (target) {
  const [jid, responses] = target;
  const before = analyze(responses, LABELS, legacy);
  const now = analyze(responses, LABELS, versioned);
  const cats = ["intimacy", "communication", "family", "emotional_connection", "friendship"] as const;
  const NAME: Record<string, string> = {
    intimacy: "מיניות ואינטימיות",
    communication: "תקשורת זוגית",
    family: "משפחה, הורות ולחצים חיצוניים",
    emotional_connection: "אהבה וחיבור רגשי",
    friendship: "חברות ושותפות יומיומית",
  };
  const b = before.summary.category_scores!, a = now.summary.category_scores!;
  console.log(`\n── FIVE CATEGORIES — real journey (${responses.length} answers) ──`);
  console.log(`journey ${jid.slice(0, 8)}…  answered ${responses[0].created_at?.slice(0, 10)} → ${responses[responses.length - 1].created_at?.slice(0, 10)}`);
  console.log("\n| category | before | after |");
  console.log("|---|---:|---:|");
  for (const c of cats) console.log(`| ${NAME[c]} | ${b[c]} | ${a[c]} |`);
  console.log(`\ninsufficient coverage BEFORE : ${JSON.stringify(b.insufficient_keys ?? [])}`);
  console.log(`insufficient coverage AFTER  : ${JSON.stringify(a.insufficient_keys ?? [])}`);
  console.log(`lowest category  before=${b.lowest_key}  after=${a.lowest_key}`);
  console.log(`\naxis scores before: ${JSON.stringify(before.axis_scores)}`);
  console.log(`axis scores after : ${JSON.stringify(now.axis_scores)}`);
}
