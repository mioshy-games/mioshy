"use client";

/**
 * ResponseBox — a calm, single-purpose form a user fills in to share
 * how an item landed for them. Phase 2B of the redesign.
 *
 * UX choices (per spec §21 + tone guidelines §1.5):
 *   - Single textarea + submit button. No modal, no rich text.
 *   - Optimistic visual: on submit, we clear the textarea and show
 *     a quiet "תגובה נשלחה" line above the form for 5 seconds.
 *   - "פרטי" checkbox lets the user mark the response as private —
 *     visible only to themselves and the clinician.
 *   - Errors surface inline; we never throw a toast over the page.
 *   - Follows the existing professional voice — no emoji, no
 *     exclamation marks, no "" type encouragement.
 */

import { useState, useTransition } from "react";
import {
  submitJourneyResponse,
  type SubmitResponseResult,
} from "@/lib/journey-content/responses";
import { track } from "@/lib/analytics";

const MAX_LEN = 4000;

export function ResponseBox({
  isHe,
  scheduledItemId,
  /** Optional callback the parent can use to refresh the items
   *  view when a new response is saved. */
  onSubmitted,
}: {
  isHe: boolean;
  scheduledItemId: string;
  onSubmitted?: (responseId: string) => void;
}) {
  const [text, setText] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "saved"; visibleUntil: number }
    | { kind: "error"; message: string }
    | null
  >(null);

  const remaining = MAX_LEN - text.length;
  const tooShort = text.trim().length === 0;
  const tooLong = text.length > MAX_LEN;
  const disabled = pending || tooShort || tooLong;

  const handleSubmit = () => {
    if (disabled) return;
    startTransition(async () => {
      const result: SubmitResponseResult = await submitJourneyResponse({
        scheduledItemId,
        responseText: text,
        isPrivate,
      });
      if (result.ok) {
        track("journey_response_submitted", {
          scheduled_item_id: scheduledItemId,
          length: text.length,
          is_private: isPrivate,
        });
        setText("");
        setFeedback({ kind: "saved", visibleUntil: Date.now() + 5000 });
        onSubmitted?.(result.responseId);
        // Auto-clear the "saved" line after 5s
        setTimeout(() => {
          setFeedback((f) => (f?.kind === "saved" ? null : f));
        }, 5000);
      } else {
        const message =
          result.reason === "unauthenticated"
            ? isHe
              ? "אין לכם הרשאה. נסו להתחבר מחדש."
              : "Not signed in. Please log in again."
            : result.reason === "invalid_input"
              ? isHe
                ? "הטקסט קצר או ארוך מדי."
                : "Text is too short or too long."
              : isHe
                ? "אירעה תקלה. נסו שוב בעוד רגע."
                : "Something went wrong. Try again in a moment.";
        setFeedback({ kind: "error", message });
      }
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <label
        htmlFor={`response-${scheduledItemId}`}
        className="block text-sm font-semibold text-white/85"
      >
        {isHe ? "מה עולה לכם מהתוכן הזה?" : "What comes up for you from this?"}
      </label>
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">
        {isHe
          ? "המומחה שלכם יקרא את התגובה ויחזור אליכם בתוכן ההמשך. אין כאן תשובה נכונה — רק מה שאתם מרגישים."
          : "Your clinician reads every response and uses it to shape what comes next. There's no right answer — just what you feel."}
      </p>

      <textarea
        id={`response-${scheduledItemId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={MAX_LEN}
        placeholder={isHe ? "כתבו כאן..." : "Write here..."}
        className={[
          "mt-3 w-full resize-y rounded-lg border bg-slate-950/40 p-3",
          "text-sm text-white placeholder:text-white/30",
          "focus:outline-none focus:ring-2 focus:ring-white/20",
          tooLong ? "border-rose-500/40" : "border-white/10",
        ].join(" ")}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-[12px] text-white/65">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-slate-950/40 accent-emerald-400"
          />
          {isHe
            ? "פרטי — רק אני והמלווה רואים"
            : "Private — only the clinician and I can see"}
        </label>
        <span
          className={[
            "text-[11px] tabular-nums",
            tooLong ? "text-rose-300" : "text-white/40",
          ].join(" ")}
        >
          {remaining.toLocaleString()} {isHe ? "תווים נותרו" : "left"}
        </span>
      </div>

      {feedback ? (
        <p
          className={[
            "mt-2 text-[12px]",
            feedback.kind === "saved" ? "text-emerald-300" : "text-rose-300",
          ].join(" ")}
          role="status"
        >
          {feedback.kind === "saved"
            ? isHe
              ? "התגובה נשמרה."
              : "Saved."
            : feedback.message}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className={[
            "inline-flex items-center justify-center rounded-full px-4 py-1.5",
            "text-sm font-semibold transition",
            disabled
              ? "cursor-not-allowed bg-white/10 text-white/40"
              : "bg-white text-slate-950 hover:bg-white/90",
          ].join(" ")}
        >
          {pending
            ? isHe ? "שולחים..." : "Sending..."
            : isHe ? "לשלוח" : "Send"}
        </button>
      </div>
    </div>
  );
}
