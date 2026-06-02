/**
 * Expert-facing panel that surfaces the AI-generated assessment hero for
 * each member of an owner (single user or couple). Built 2026-06-02 to
 * support the journey_analysis.summary.ai_hero field.
 *
 * Per Itzik: the expert needs to see exactly what the user saw on their
 * /journey/assessment summary, plus the two open reflections that
 * informed the AI (so the expert can sanity-check), plus model metadata
 * for debugging.
 *
 * Server component - no hooks, no state. The page passes the pre-fetched
 * rows in directly.
 */

import { Sparkles, Brain, FileText } from "lucide-react";
import type { AiHeroBlock } from "@/lib/journey/types";

export interface ClientAiAnalysisRow {
  user_id: string;
  /** Display name (full_name → email → "Unknown"). */
  label: string;
  /** Latest journey_analysis row for this user, or null if no assessment. */
  analysis: {
    id: string;
    computed_at: string;
    summary: unknown;
  } | null;
  /** Two reflection answers that drove the AI's pain identification.
   *  Pulled separately because the analysis row only stores the AI's
   *  output, not the inputs. */
  reflections: {
    q20c_what_hurts: string | null;
    q22a_success_signal: string | null;
  };
}

interface PanelProps {
  rows: ClientAiAnalysisRow[];
}

export function ClientAiAnalysisPanel({ rows }: PanelProps) {
  // Hide panel entirely when there's no AI analysis for any member - keeps
  // the expert dashboard clean for clients who never completed an
  // assessment.
  const hasAny = rows.some((r) => extractAiHero(r.analysis?.summary) || r.analysis);
  if (!hasAny) return null;

  return (
    <section className="rounded-xl border bg-card text-card-foreground p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-rose-600" />
        <h2 className="text-lg font-semibold tracking-tight">
          AI Analysis · ניתוח אבחון
        </h2>
        <span className="text-muted-foreground text-xs">
          (Claude Sonnet 4.6)
        </span>
      </header>

      <div className="space-y-5">
        {rows.map((row) => (
          <PartnerBlock key={row.user_id} row={row} />
        ))}
      </div>
    </section>
  );
}

function PartnerBlock({ row }: { row: ClientAiAnalysisRow }) {
  const aiHero = extractAiHero(row.analysis?.summary);

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-semibold">{row.label}</div>
        {row.analysis ? (
          <span className="text-muted-foreground text-xs">
            computed {formatDate(row.analysis.computed_at)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs italic">
            no assessment yet
          </span>
        )}
      </div>

      {aiHero ? (
        <>
          {/* What the user saw */}
          <div className="mb-3 rounded-md bg-white p-3 dark:bg-zinc-900">
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
              <Brain className="size-3" />
              Hero · מה הזוג ראה
            </div>
            <p
              dir="rtl"
              className="text-sm leading-relaxed font-medium text-foreground"
            >
              {aiHero.hero_he}
            </p>
            {aiHero.recommendations_he.length > 0 ? (
              <ul
                dir="rtl"
                className="mt-2.5 list-inside list-disc space-y-0.5 text-sm text-foreground/80"
              >
                {aiHero.recommendations_he.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Metadata strip */}
          <div className="text-muted-foreground mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span>
              <strong className="text-foreground/70">Signal:</strong>{" "}
              {aiHero.pain_signal}
            </span>
            <span>
              <strong className="text-foreground/70">Expert mentioned:</strong>{" "}
              {aiHero.expert_mentioned ? "yes" : "no"}
            </span>
            <span>
              <strong className="text-foreground/70">Model:</strong>{" "}
              {aiHero.model}
            </span>
            <span>
              <strong className="text-foreground/70">Latency:</strong>{" "}
              {aiHero.latency_ms}ms
            </span>
          </div>
        </>
      ) : row.analysis ? (
        <div className="mb-3 rounded-md border border-dashed bg-white p-3 text-xs italic text-muted-foreground dark:bg-zinc-900">
          AI hero generation failed or was skipped. The user saw the
          deterministic narrative fallback.
        </div>
      ) : null}

      {/* The two reflections the AI relied on - critical for expert
          verification. */}
      {(row.reflections.q20c_what_hurts ||
        row.reflections.q22a_success_signal) ? (
        <div className="rounded-md bg-white p-3 dark:bg-zinc-900">
          <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <FileText className="size-3" />
            Reflections used by AI · רפלקציות שהמשתמש כתב
          </div>
          <div dir="rtl" className="space-y-2 text-sm">
            {row.reflections.q20c_what_hurts ? (
              <ReflectionRow
                label="מה הכי כואב?"
                text={row.reflections.q20c_what_hurts}
              />
            ) : null}
            {row.reflections.q22a_success_signal ? (
              <ReflectionRow
                label="מה חסר שתפתרו ישנה את הזוגיות?"
                text={row.reflections.q22a_success_signal}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReflectionRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground text-[11px] font-semibold">
        {label}
      </div>
      <div className="rounded bg-muted/40 px-2 py-1 text-foreground/90">
        {text}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract the AI hero block from a journey_analysis.summary JSON. */
function extractAiHero(summary: unknown): AiHeroBlock | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const candidate = s.ai_hero;
  if (!candidate || typeof candidate !== "object") return null;
  const ai = candidate as Record<string, unknown>;
  if (typeof ai.hero_he !== "string") return null;
  if (typeof ai.hero_en !== "string") return null;
  return {
    hero_he: ai.hero_he,
    hero_en: typeof ai.hero_en === "string" ? ai.hero_en : "",
    recommendations_he: Array.isArray(ai.recommendations_he)
      ? (ai.recommendations_he as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    recommendations_en: Array.isArray(ai.recommendations_en)
      ? (ai.recommendations_en as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    expert_mentioned: ai.expert_mentioned === true,
    pain_signal:
      ai.pain_signal === "reflection" ||
      ai.pain_signal === "horsemen" ||
      ai.pain_signal === "top_priority"
        ? ai.pain_signal
        : "scores",
    model: typeof ai.model === "string" ? ai.model : "unknown",
    generated_at: typeof ai.generated_at === "string" ? ai.generated_at : "",
    latency_ms: typeof ai.latency_ms === "number" ? ai.latency_ms : 0,
  };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
