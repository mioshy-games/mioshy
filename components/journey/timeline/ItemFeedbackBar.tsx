"use client";

/**
 * ItemFeedbackBar
 * ─────────────────────────────────────────────────────────────
 * Layer-1 close-the-loop component: 4 buttons + optional note,
 * shown after a user marks an item complete.
 *
 * Feedback is what makes "the system listened" experiential —
 * the user submits, the bar acknowledges, and (downstream) the
 * matching engine learns from this signal.
 *
 * Behaviour:
 *   • Initial render shows the 4 buttons.
 *   • Negative ratings reveal an optional note textarea.
 *   • After submit, the bar collapses to a single "thanks" line
 *     that names the user's choice.
 *   • If the user has already submitted, we hydrate from initial
 *     props and show the post-submit state directly.
 *
 * Sprint 4 #3 Phase 2A migration — 14 keys under
 * journeyTimeline.feedback.*.
 */

import { useState } from "react";
import { Sparkles, Smile, Frown, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitItemFeedback } from "@/app/actions/journey-item-feedback";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

type Rating = "helpful" | "neutral" | "not_for_us" | "made_things_worse";

interface Props {
  isHe: boolean;
  scheduledItemId: string;
  /** Existing rating on first render — null if user hasn't rated yet. */
  initialRating: Rating | null;
}

/** Maps the rating code to the CMS key suffix under
 *  journeyTimeline.feedback.rating* — used for the button label and
 *  the post-submit confirmation. Tone keeps its visual mapping
 *  separately below. */
const RATING_KEY: Record<Rating, string> = {
  helpful: "ratingHelpful",
  neutral: "ratingNeutral",
  not_for_us: "ratingNotForUs",
  made_things_worse: "ratingMadeWorse",
};

const RATING_TONE: Record<Rating, "good" | "neutral" | "warn" | "bad"> = {
  helpful: "good",
  neutral: "neutral",
  not_for_us: "warn",
  made_things_worse: "bad",
};

const TONE_RING: Record<"good" | "neutral" | "warn" | "bad", string> = {
  good:    "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  neutral: "border-white/15 bg-white/5 text-white/85",
  warn:    "border-amber-300/40 bg-amber-500/10 text-amber-100",
  bad:     "border-rose-300/40 bg-rose-500/10 text-rose-100",
};

const ICONS: Record<Rating, React.ComponentType<{ className?: string }>> = {
  helpful:           Sparkles,
  neutral:           Smile,
  not_for_us:        Frown,
  made_things_worse: AlertTriangle,
};

export function ItemFeedbackBar({ isHe, scheduledItemId, initialRating }: Props) {
  const [rating, setRating] = useState<Rating | null>(initialRating);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialRating !== null);

  // String-prop consumers — toasts, aria-label, textarea placeholder,
  // and the rating-label resolutions used by the post-submit template.
  const saveFailedMsg = useCmsText("journeyTimeline.feedback.saveFailed").text;
  const saveSuccessMsg = useCmsText("journeyTimeline.feedback.saveSuccess").text;
  const postSubmitTpl = useCmsText("journeyTimeline.feedback.postSubmitNote").text;
  const ariaLabel = useCmsText("journeyTimeline.feedback.ariaLabel").text;
  const notePlaceholder = useCmsText("journeyTimeline.feedback.notePlaceholder").text;

  // All four rating labels — needed as raw strings for the post-submit
  // template substitution. Listing them inline keeps the hook order
  // stable across renders.
  const labelHelpful = useCmsText("journeyTimeline.feedback.ratingHelpful").text;
  const labelNeutral = useCmsText("journeyTimeline.feedback.ratingNeutral").text;
  const labelNotForUs = useCmsText("journeyTimeline.feedback.ratingNotForUs").text;
  const labelMadeWorse = useCmsText("journeyTimeline.feedback.ratingMadeWorse").text;
  const ratingLabelByCode: Record<Rating, string> = {
    helpful: labelHelpful,
    neutral: labelNeutral,
    not_for_us: labelNotForUs,
    made_things_worse: labelMadeWorse,
  };

  const submit = async (chosen: Rating) => {
    setSubmitting(true);
    const res = await submitItemFeedback({
      scheduledItemId,
      rating: chosen,
      optionalText: note.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(saveFailedMsg);
      return;
    }
    setRating(chosen);
    setSubmitted(true);
    setShowNote(false);
    toast.success(saveSuccessMsg);
  };

  const handleClick = (chosen: Rating) => {
    // Negative ratings: open the note textarea but DON'T submit yet —
    // give the user a chance to add context before locking it in.
    if (chosen === "not_for_us" || chosen === "made_things_worse") {
      setRating(chosen);
      setShowNote(true);
      return;
    }
    void submit(chosen);
  };

  // ── Post-submit state ───────────────────────────────────────────
  if (submitted && rating) {
    const postSubmitLine = postSubmitTpl.replace("{label}", ratingLabelByCode[rating]);
    return (
      <section
        className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4"
        aria-live="polite"
      >
        <p className="text-[14px] leading-snug text-white/80">{postSubmitLine}</p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setShowNote(false);
            setNote("");
          }}
          className="mt-1 text-[12px] text-white/45 underline-offset-4 hover:text-white/75 hover:underline"
        >
          <CmsText cmsKey="journeyTimeline.feedback.change" />
        </button>
      </section>
    );
  }

  // ── Initial state: 4 buttons ─────────────────────────────────────
  return (
    <section
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4"
      aria-label={ariaLabel}
    >
      <CmsText
        cmsKey="journeyTimeline.feedback.heading"
        as="h3"
        className="text-[13px] font-bold uppercase tracking-wider text-white/65"
      />
      <CmsText
        cmsKey="journeyTimeline.feedback.helperText"
        as="p"
        className="mt-1 text-[12px] text-white/45"
      />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(RATING_KEY) as Rating[]).map((r) => {
          const Icon = ICONS[r];
          const isPicked = rating === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => handleClick(r)}
              disabled={submitting}
              className={`group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-3 text-[14px] font-semibold transition disabled:opacity-50 ${
                isPicked ? TONE_RING[RATING_TONE[r]] : "border-white/10 bg-white/[0.02] text-white/75 hover:border-white/20 hover:bg-white/[0.06]"
              }`}
              aria-pressed={isPicked}
            >
              <Icon className="h-4 w-4" />
              <CmsText cmsKey={`journeyTimeline.feedback.${RATING_KEY[r]}`} />
            </button>
          );
        })}
      </div>

      {/* Optional note — appears for negative ratings before commit */}
      {showNote && rating ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            dir={isHe ? "rtl" : "ltr"}
            rows={3}
            maxLength={2000}
            placeholder={notePlaceholder}
            className="bg-white/[0.04] border-white/15 text-white placeholder:text-white/35"
            disabled={submitting}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNote(false);
                setRating(null);
                setNote("");
              }}
              disabled={submitting}
            >
              <CmsText cmsKey="journeyTimeline.feedback.cancel" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit(rating)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" />
                  <CmsText cmsKey="journeyTimeline.feedback.sending" />
                </>
              ) : (
                <CmsText cmsKey="journeyTimeline.feedback.send" />
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
