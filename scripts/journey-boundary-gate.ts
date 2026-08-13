/**
 * The split invariance gate for migration 204.
 *
 * 196's single gate — "nothing before 2026-07-01 may drift" — cannot test a
 * boundary correction. When a boundary MOVES, some answers are supposed to
 * change era; that is the fix landing. A gate that forbids all drift would fail
 * on a correct fix, and a gate that permits all drift would pass on a broken
 * one. So it splits in two:
 *
 *   A. STABILITY — an answer given before ANY edit to its question resolves to
 *      the same axis before and after. Those answers were always in v1 and no
 *      boundary move can legitimately touch them.
 *
 *   B. EXPECTED DRIFT — every answer whose era changed MUST drift, and to the
 *      axis the history predicts. Not "differs" — differs in the specific,
 *      pre-declared direction.
 *
 * Run: pnpm exec tsx scripts/journey-boundary-gate.ts
 */

import { buildVersionedQuestionResolver } from "@/lib/journey/question-versions";
import type { Question, AxisWeight } from "@/lib/journey/types";
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
    out.push(...d); if (d.length < 1000) break;
  }
  return out;
}

/** What each moved answer MUST become. Declared up front, from the history. */
const PREDICTED: Array<{ slug: string; from: string; to: string; wasAxis: string; nowAxis: string | null }> = [
  // q01: the "in first place" era — was scored love_map, must now be unscored.
  { slug: "q01_knowledge_world", from: "2026-07-01T06:31:46Z", to: "2026-07-01T16:14:46Z", wasAxis: "love_map", nowAxis: null },
  // q01: the sexual-presence era — was scored love_map until 07-20, must be intimacy_presence throughout.
  { slug: "q01_knowledge_world", from: "2026-07-01T16:14:46Z", to: "2026-07-20T08:00:19Z", wasAxis: "love_map", nowAxis: "intimacy_presence" },
  // q17: the rituals era — was scored passion_context(-1) until 07-20, must be shared_meaning.
  { slug: "q17_context_logistics", from: "2026-07-01T06:59:06Z", to: "2026-07-20T08:00:58Z", wasAxis: "passion_context", nowAxis: "shared_meaning" },
];

async function main() {
  const qRows = await all<{ slug: string; type: string; axes: AxisWeight[] | null; options: unknown }>("journey_questions", "slug,type,axes,options");
  const nowV = await all<Parameters<typeof buildVersionedQuestionResolver>[1][number]>(
    "journey_question_versions", "slug,version,valid_from,valid_to,he_text,en_text,axes,reverse,options,type");
  const oldV = await all<Parameters<typeof buildVersionedQuestionResolver>[1][number]>(
    "journey_question_versions_backup_204", "slug,version,valid_from,valid_to,he_text,en_text,axes,reverse,options,type");
  const resp = await all<{ question_id: string; created_at: string }>("journey_responses", "question_id,created_at");

  const questions: Question[] = qRows.map((q) => {
    const base = { id: q.slug, category: "free", domain: null, axes: q.axes ?? [], purpose: "", he: "", en: "" };
    if (q.type === "likert5") return { ...base, type: "likert5" } as Question;
    return { ...base, type: q.type, he_prompt: "", en_prompt: "", options: q.options ?? [] } as unknown as Question;
  });
  const before = buildVersionedQuestionResolver(questions, oldV);
  const after = buildVersionedQuestionResolver(questions, nowV);
  const axisOf = (q: Question | undefined) => (q?.axes?.[0]?.axis ?? null);

  // Earliest boundary per question under the NEW scheme.
  const firstBoundary = new Map<string, number>();
  for (const v of nowV) {
    if (v.valid_to === null) continue;
    const t = Date.parse(v.valid_to);
    if (!firstBoundary.has(v.slug) || t < firstBoundary.get(v.slug)!) firstBoundary.set(v.slug, t);
  }

  // ── A. STABILITY ─────────────────────────────────────────────────────────
  let stableChecked = 0; const stableBroken: string[] = [];
  for (const r of resp) {
    const b = firstBoundary.get(r.question_id);
    if (b === undefined || Date.parse(r.created_at) >= b) continue;  // not pre-first-edit
    stableChecked++;
    if (axisOf(before(r.question_id, r.created_at)) !== axisOf(after(r.question_id, r.created_at)))
      stableBroken.push(`${r.question_id}@${r.created_at}`);
  }
  console.log("── A. STABILITY — answers predating any edit to their question ──");
  console.log(`   checked : ${stableChecked}`);
  console.log(`   drifted : ${stableBroken.length}   ${stableBroken.length === 0 ? "✅ PASS" : "❌ FAIL"}`);
  if (stableBroken.length) console.log(`   e.g. ${stableBroken.slice(0, 3).join(", ")}`);

  // ── B. EXPECTED DRIFT ────────────────────────────────────────────────────
  console.log("\n── B. EXPECTED DRIFT — answers whose era changed ──");
  let allOk = true, movedTotal = 0;
  for (const p of PREDICTED) {
    const lo = Date.parse(p.from), hi = Date.parse(p.to);
    const rows = resp.filter((r) => r.question_id === p.slug && Date.parse(r.created_at) >= lo && Date.parse(r.created_at) < hi);
    let bad = 0;
    for (const r of rows) {
      const wasOk = axisOf(before(r.question_id, r.created_at)) === p.wasAxis;
      const nowOk = axisOf(after(r.question_id, r.created_at)) === p.nowAxis;
      if (!wasOk || !nowOk) bad++;
    }
    movedTotal += rows.length;
    if (bad > 0 || rows.length === 0) allOk = false;
    console.log(`   ${p.slug.padEnd(24)} ${String(rows.length).padStart(4)} answers  ${p.wasAxis} → ${p.nowAxis ?? "(unscored)"}   ${bad === 0 && rows.length > 0 ? "✅" : "❌ " + bad + " wrong"}`);
  }
  console.log(`\n   answers moved era in total : ${movedTotal}   ${allOk ? "✅ PASS" : "❌ FAIL"}`);

  // A gate that checked nothing would report zero failures on both halves.
  console.log(`\nGATE: ${stableBroken.length === 0 && allOk && stableChecked > 0 && movedTotal > 0 ? "✅ PASS" : "❌ FAIL"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
