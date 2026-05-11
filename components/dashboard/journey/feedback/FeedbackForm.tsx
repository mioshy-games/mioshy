"use client";

/**
 * FeedbackForm - create / edit dialog for journey_feedback rows.
 *
 * Kept deliberately minimal:
 *   - target picker (couple OR user-by-id)
 *   - optional category / item / question_id
 *   - severity radio
 *   - short_summary (required)
 *   - extended_text (optional)
 *
 * The form posts to the create/update server actions; on success it
 * calls onClose() and lets Next's revalidatePath redraw the list.
 */

import { useState, useTransition } from "react";
// Client-safe imports only - see comment in FeedbackFilterBar.tsx.
import {
  FEEDBACK_SEVERITIES,
  SEVERITY_LABEL_HE,
  type FeedbackSeverity,
  type JourneyFeedbackHydrated,
} from "@/lib/journey/feedback-shared";
import {
  createFeedback,
  updateFeedback,
} from "@/app/actions/journey-feedback";

interface CoupleOption {
  id: string;
  display_name: string | null;
  pair_code: string;
}
interface CategoryOption {
  id: string;
  // journey_categories uses name_he/name_en.
  name_he: string | null;
  name_en: string | null;
}

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  existing?: JourneyFeedbackHydrated;
  couples: CoupleOption[];
  categories: CategoryOption[];
  onClose: () => void;
  /** Optional preset values used by callers like the couple workspace
   *  to start the form pre-bound to a couple/user. */
  initial?: {
    coupleId?: string;
    userId?: string;
    categoryId?: string;
    itemId?: string;
    questionId?: string;
  };
}

export function FeedbackForm({
  mode,
  existing,
  couples,
  categories,
  onClose,
  initial,
}: Props) {
  const [coupleId, setCoupleId] = useState(
    existing?.couple_id ?? initial?.coupleId ?? "",
  );
  const [userId, setUserId] = useState(
    existing?.user_id ?? initial?.userId ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    existing?.category_id ?? initial?.categoryId ?? "",
  );
  const [questionId, setQuestionId] = useState(
    existing?.question_id ?? initial?.questionId ?? "",
  );
  const [severity, setSeverity] = useState<FeedbackSeverity>(
    (existing?.severity as FeedbackSeverity | undefined) ?? "observation",
  );
  const [shortSummary, setShortSummary] = useState(
    existing?.short_summary ?? "",
  );
  const [extendedText, setExtendedText] = useState(
    existing?.extended_text ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (shortSummary.trim().length === 0) {
      setError("Short summary is required.");
      return;
    }
    if (!coupleId && !userId) {
      setError("Pick a couple or paste a user id.");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const res = await createFeedback({
          coupleId: coupleId || null,
          userId: userId || null,
          categoryId: categoryId || null,
          questionId: questionId || null,
          severity,
          shortSummary,
          extendedText: extendedText || null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else if (existing) {
        const res = await updateFeedback({
          id: existing.id,
          shortSummary,
          extendedText: extendedText || null,
          severity,
          categoryId: categoryId || null,
          questionId: questionId || null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="bg-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">
          {mode === "create" ? "New clinical note" : "Edit clinical note"}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Visible to admins only - never to the subject.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Couple selector */}
          <label className="text-xs font-medium">
            Couple
            <select
              value={coupleId}
              onChange={(e) => setCoupleId(e.target.value)}
              disabled={mode === "edit"}
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">- None -</option>
              {couples.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name ?? `Couple ${c.pair_code}`}
                </option>
              ))}
            </select>
          </label>

          {/* User id (manual paste - admin pulls from /dashboard/users) */}
          <label className="text-xs font-medium">
            User ID (optional)
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={mode === "edit"}
              placeholder="UUID"
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 font-mono text-xs"
            />
          </label>

          {/* Category */}
          <label className="text-xs font-medium">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">- None -</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_he ?? c.name_en ?? c.id}
                </option>
              ))}
            </select>
          </label>

          {/* Question id */}
          <label className="text-xs font-medium">
            Question ID (optional)
            <input
              type="text"
              value={questionId}
              onChange={(e) => setQuestionId(e.target.value)}
              placeholder="q07_*"
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 font-mono text-xs"
            />
          </label>
        </div>

        {/* Severity */}
        <fieldset className="mt-4">
          <legend className="text-xs font-medium">Severity</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEEDBACK_SEVERITIES.map((s) => (
              <label
                key={s}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  severity === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background"
                }`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={s}
                  checked={severity === s}
                  onChange={() => setSeverity(s)}
                  className="sr-only"
                />
                {SEVERITY_LABEL_HE[s]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Short summary */}
        <label className="mt-4 block text-xs font-medium">
          Short summary <span className="text-rose-700">*</span>
          <textarea
            required
            rows={2}
            value={shortSummary}
            onChange={(e) => setShortSummary(e.target.value)}
            maxLength={500}
            placeholder="2-line summary visible in list views"
            className="bg-background mt-1 w-full rounded-md border p-2 text-sm"
          />
          <div className="text-muted-foreground mt-0.5 text-[10px]">
            {shortSummary.length}/500
          </div>
        </label>

        {/* Extended */}
        <label className="mt-2 block text-xs font-medium">
          Extended analysis
          <textarea
            rows={6}
            value={extendedText}
            onChange={(e) => setExtendedText(e.target.value)}
            maxLength={10000}
            placeholder="Full clinical reasoning, shown on expand"
            className="bg-background mt-1 w-full rounded-md border p-2 text-sm"
          />
        </label>

        {error && (
          <p className="text-rose-700 mt-3 text-xs" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="hover:bg-accent h-9 rounded-md border px-4 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Saving…" : mode === "create" ? "Save note" : "Update"}
          </button>
        </div>
      </form>
    </div>
  );
}
