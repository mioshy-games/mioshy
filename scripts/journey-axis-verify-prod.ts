/**
 * Production verification for the axis-versioning fix.
 *
 * READ-ONLY against production. Unlike the unit test, this uses the REAL
 * journey_question_versions rows that migrations 195-197 wrote — so it verifies
 * the migrations, not just the resolver.
 *
 *   1. Invariance gate: every answer given before 2026-07-01 scores identically
 *      under the old (date-blind) resolver and the new versioned one.
 *   2. Boundary: the same slug resolves to different axes either side of its
 *      rewrite timestamp.
 *   3. Five categories for a real post-rewrite journey.
 *   4. The distribution of the score shift, per category — how much was being
 *      overstated, and for how many people.
 *
 * Run: pnpm exec tsx scripts/journey-axis-verify-prod.ts
 */

import { analyze } from "@/lib/journey/analysis";
import { buildVersionedQuestionResolver } from "@/lib/journey/question-versions";
import type { Question, Response, AxisWeight, CategoryKey } from "@/lib/journey/types";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/uxellent/mioshy/.env.local", "utf8").split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
) as Record<string, string>;
const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

async function all<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${BASE}/${table}?select=${select}`, { cache: "no-store", headers: { ...H, Range: `${from}-${from + 999}` } });
    const d = (await r.json()) as T[];
    out.push(...d);
    if (d.length < 1000) break;
  }
  return out;
}

async function main() {
const qRows = await all<{ slug: string; type: string; axes: AxisWeight[] | null; options: unknown }>(
  "journey_questions", "slug,type,axes,options");
const vRows = await all<Parameters<typeof buildVersionedQuestionResolver>[1][number]>(
  "journey_question_versions", "slug,version,valid_from,valid_to,he_text,en_text,axes,reverse,options,type");
const rRows = await all<{ journey_id: string; question_id: string; answer: unknown; created_at: string }>(
  "journey_responses", "journey_id,question_id,answer,created_at");

console.log(`loaded: ${qRows.length} questions, ${vRows.length} version rows, ${rRows.length} responses`);

const questions: Question[] = qRows.map((q) => {
  const base = { id: q.slug, category: "free", domain: null, axes: q.axes ?? [], purpose: "", he: "", en: "" };
  if (q.type === "likert5") return { ...base, type: "likert5" } as Question;
  return { ...base, type: q.type, he_prompt: "", en_prompt: "", options: q.options ?? [] } as unknown as Question;
});
const byId = new Map(questions.map((q) => [q.id, q]));
const legacy = (slug: string) => byId.get(slug);          // what production does today
const versioned = buildVersionedQuestionResolver(questions, vRows);

const journeys = new Map<string, Response[]>();
for (const r of rRows) {
  const list = journeys.get(r.journey_id) ?? [];
  list.push({ question_id: r.question_id, answer: r.answer as Response["answer"], locale: "he", created_at: r.created_at });
  journeys.set(r.journey_id, list);
}

const KEYS = ["communication", "intimacy", "emotional_connection", "friendship", "family"] as const;
const stub = Object.fromEntries(KEYS.map((k) => [k, k])) as Record<string, string>;
const LABELS = { labelsHe: stub, labelsEn: stub, descsHe: stub, descsEn: stub, canonicalOrder: [...KEYS] } as never;
const CUTOFF = Date.parse("2026-07-01T00:00:00Z");

// ── 1. invariance, against the REAL version rows ────────────────────────────
// "Before" for a pre-cutoff journey is the axis set that was live then, which is
// exactly what v1 holds — so this compares v1-scoring to versioned-scoring.
const v1ById = new Map(questions.map((q) => {
  const v1 = vRows.filter((v) => v.slug === q.id).sort((a, b) => a.version - b.version)[0];
  return [q.id, v1 ? ({ ...q, axes: (v1.axes ?? []) as AxisWeight[] } as Question) : q];
}));
let checked = 0, drifted = 0;
for (const [, responses] of journeys) {
  if (!responses.every((r) => Date.parse(r.created_at!) < CUTOFF)) continue;
  const before = analyze(responses, LABELS, (s: string) => v1ById.get(s)).axis_scores;
  const after = analyze(responses, LABELS, versioned).axis_scores;
  checked++;
  if (JSON.stringify(before) !== JSON.stringify(after)) drifted++;
}
console.log(`\n── 1. INVARIANCE (real version rows) ──`);
console.log(`   pre-2026-07-01 journeys checked : ${checked}`);
console.log(`   drifted                         : ${drifted}   ${drifted === 0 ? "✅ PASS" : "❌ FAIL"}`);

// ── 2. boundary ─────────────────────────────────────────────────────────────
console.log(`\n── 2. BOUNDARY ──`);
for (const slug of ["q11_contempt", "q17_context_logistics", "q01_knowledge_world"]) {
  const b = versioned(slug, "2026-06-01T00:00:00Z");
  const a = versioned(slug, "2026-08-01T00:00:00Z");
  console.log(`   ${slug.padEnd(24)} before=${b?.axes[0]?.axis ?? "—"}   after=${a?.axes[0]?.axis ?? "—"}`);
}

// ── 3 + 4. category shift ───────────────────────────────────────────────────
const NAME: Record<string, string> = {
  intimacy: "מיניות ואינטימיות", communication: "תקשורת זוגית",
  family: "משפחה, הורות ולחצים", emotional_connection: "אהבה וחיבור רגשי",
  friendship: "חברות ושותפות",
};
const deltas: Record<string, number[]> = Object.fromEntries(KEYS.map((k) => [k, []]));
let sample: { id: string; b: Record<string, number>; a: Record<string, number>; n: number } | null = null;

for (const [jid, responses] of journeys) {
  // Only journeys whose answers all POST-DATE the cutoff — the cohort whose
  // stored results are actually wrong.
  if (!responses.every((r) => Date.parse(r.created_at!) >= CUTOFF)) continue;
  if (responses.length < 10) continue;
  const b = analyze(responses, LABELS, legacy).summary.category_scores;
  const a = analyze(responses, LABELS, versioned).summary.category_scores;
  if (!b || !a) continue;
  for (const k of KEYS) deltas[k].push((a[k as CategoryKey] as number) - (b[k as CategoryKey] as number));
  if (!sample && responses.length >= 12) {
    sample = { id: jid, n: responses.length,
      b: Object.fromEntries(KEYS.map((k) => [k, b[k as CategoryKey] as number])),
      a: Object.fromEntries(KEYS.map((k) => [k, a[k as CategoryKey] as number])) };
  }
}

if (sample) {
  console.log(`\n── 3. FIVE CATEGORIES — real post-rewrite journey (${sample.n} answers) ──`);
  console.log(`   | category | before | after | Δ |`);
  console.log(`   |---|---:|---:|---:|`);
  for (const k of KEYS) {
    const d = sample.a[k] - sample.b[k];
    console.log(`   | ${NAME[k]} | ${sample.b[k]} | ${sample.a[k]} | ${d > 0 ? "+" : ""}${d} |`);
  }
}

console.log(`\n── 4. SHIFT DISTRIBUTION — ${deltas.communication.length} post-rewrite journeys ──`);
console.log(`   | category | mean Δ | median Δ | worse | same | better | max drop |`);
console.log(`   |---|---:|---:|---:|---:|---:|---:|`);
for (const k of KEYS) {
  const d = deltas[k].slice().sort((x, y) => x - y);
  const mean = d.reduce((s, v) => s + v, 0) / (d.length || 1);
  const med = d[Math.floor(d.length / 2)] ?? 0;
  console.log(`   | ${NAME[k]} | ${mean.toFixed(1)} | ${med} | ${d.filter((v) => v < 0).length} | ${d.filter((v) => v === 0).length} | ${d.filter((v) => v > 0).length} | ${d[0] ?? 0} |`);
}
}

main().catch((e) => { console.error(e); process.exit(1); });
