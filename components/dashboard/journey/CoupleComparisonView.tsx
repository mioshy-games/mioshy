"use client";

/**
 * CoupleComparisonView
 *
 * The clinical "question matrix" view - for every question the
 * couple answered, show Partner A's answer and Partner B's answer
 * side-by-side, with a divergence indicator that lets a coach
 * scan dozens of questions in seconds and spot the gaps.
 *
 * Pure-presentational. Built on top of buildComparisonMatrix() in
 * lib/journey/comparison.ts. The server (page) loads both partners'
 * journey_responses, the lib computes the matrix, this component
 * renders it.
 *
 * UX choices worth calling out:
 *   - Sortable: canonical question order vs. divergence-first. The
 *     latter is the "where do I focus?" view a coach reaches for
 *     under time pressure.
 *   - Filter pill row: one per divergence level. Lets the coach
 *     hide "match" rows when scanning for problems.
 *   - One-sided rows are tagged with a neutral badge - they're
 *     informative (someone skipped) but never sorted to the top.
 *   - Annotate button per row: opens FeedbackForm pre-bound with
 *     the couple, partner-A user, AND question_id. This is the
 *     mechanism the coach uses to write a clinical note attached
 *     to a specific question.
 */

import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowDown, MessageSquarePlus } from "lucide-react";
import type {
  ComparisonRow,
  DivergenceLevel,
} from "@/lib/journey/comparison";
import { summarizeMatrix } from "@/lib/journey/comparison";
import { FeedbackForm } from "./feedback/FeedbackForm";

interface CoupleOption {
  id: string;
  display_name: string | null;
  pair_code: string;
}
interface CategoryOption {
  id: string;
  name_he: string | null;
  name_en: string | null;
}

const LEVEL_LABEL: Record<DivergenceLevel, string> = {
  match: "תואם",
  minor: "פער קל",
  moderate: "פער",
  major: "פער משמעותי",
};

const LEVEL_TONE: Record<DivergenceLevel, string> = {
  match: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  minor: "bg-slate-50 text-slate-700 ring-slate-200",
  moderate: "bg-amber-50 text-amber-800 ring-amber-200",
  major: "bg-rose-50 text-rose-800 ring-rose-200",
};

interface Props {
  rows: ComparisonRow[];
  partnerALabel: string;
  partnerBLabel: string;
  coupleId: string;
  partnerAUserId: string;
  /** Used by the per-row "Annotate" button to pre-bind the feedback form. */
  couples: CoupleOption[];
  categories: CategoryOption[];
}

export function CoupleComparisonView({
  rows,
  partnerALabel,
  partnerBLabel,
  coupleId,
  partnerAUserId,
  couples,
  categories,
}: Props) {
  const [sortBy, setSortBy] = useState<"order" | "divergence">("order");
  const [hideMatches, setHideMatches] = useState(false);
  const [annotating, setAnnotating] = useState<{
    questionId: string;
    questionPrompt: string;
  } | null>(null);

  const summary = useMemo(() => summarizeMatrix(rows), [rows]);

  const visibleRows = useMemo(() => {
    let out = rows;
    if (hideMatches) out = out.filter((r) => r.divergence_level !== "match");
    if (sortBy === "divergence") {
      out = [...out].sort((a, b) => b.divergence - a.divergence);
    }
    return out;
  }, [rows, hideMatches, sortBy]);

  if (rows.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-lg border p-12 text-center text-sm">
        No questions answered by either partner yet.
      </div>
    );
  }

  return (
    <>
      {/* ── Summary strip ──────────────────────────────── */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
        <span className="text-muted-foreground">
          {summary.total} שאלות
        </span>
        {(["match", "minor", "moderate", "major"] as DivergenceLevel[]).map(
          (lvl) => (
            <span
              key={lvl}
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ${LEVEL_TONE[lvl]}`}
            >
              {LEVEL_LABEL[lvl]} · {summary[lvl]}
            </span>
          ),
        )}
        {summary.one_sided > 0 && (
          <span className="text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 ring-1 ring-slate-200 bg-slate-50">
            צד אחד · {summary.one_sided}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-muted-foreground inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hideMatches}
              onChange={(e) => setHideMatches(e.target.checked)}
            />
            הסתר שאלות תואמות
          </label>
          <button
            type="button"
            onClick={() =>
              setSortBy((s) => (s === "order" ? "divergence" : "order"))
            }
            className="hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            {sortBy === "order" ? <ArrowDownUp className="size-3" /> : <ArrowDown className="size-3" />}
            {sortBy === "order" ? "סדר האבחון" : "פער → תואם"}
          </button>
        </div>
      </div>

      {/* ── Matrix table ───────────────────────────────── */}
      <div className="bg-card rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="w-[35%] px-3 py-2 text-right font-medium">
                שאלה
              </th>
              <th className="w-[27%] px-3 py-2 text-right font-medium">
                {partnerALabel}
              </th>
              <th className="w-[27%] px-3 py-2 text-right font-medium">
                {partnerBLabel}
              </th>
              <th className="w-[11%] px-3 py-2 text-right font-medium">
                פער
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr
                key={r.question_id}
                className={`border-t ${
                  r.divergence_level === "major"
                    ? "bg-rose-50/40"
                    : r.divergence_level === "moderate"
                    ? "bg-amber-50/30"
                    : ""
                }`}
              >
                <td className="px-3 py-2 align-top">
                  <div className="font-medium">{r.question_he}</div>
                  <button
                    type="button"
                    onClick={() =>
                      setAnnotating({
                        questionId: r.question_id,
                        questionPrompt: r.question_he,
                      })
                    }
                    className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-[11px]"
                  >
                    <MessageSquarePlus className="size-3" />
                    Annotate
                  </button>
                </td>
                <td className="text-muted-foreground px-3 py-2 align-top">
                  {r.answer_a_display ?? <em className="opacity-50">-</em>}
                </td>
                <td className="text-muted-foreground px-3 py-2 align-top">
                  {r.answer_b_display ?? <em className="opacity-50">-</em>}
                </td>
                <td className="px-3 py-2 align-top">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                      LEVEL_TONE[r.divergence_level]
                    }`}
                  >
                    {r.one_sided ? "צד אחד" : LEVEL_LABEL[r.divergence_level]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {annotating && (
        <FeedbackForm
          mode="create"
          couples={couples}
          categories={categories}
          initial={{
            coupleId,
            userId: partnerAUserId,
            questionId: annotating.questionId,
          }}
          onClose={() => setAnnotating(null)}
        />
      )}
    </>
  );
}
