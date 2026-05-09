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
 */

import { useState } from "react";
import { Sparkles, Smile, Frown, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitItemFeedback } from "@/app/actions/journey-item-feedback";

type Rating = "helpful" | "neutral" | "not_for_us" | "made_things_worse";

interface Props {
  isHe: boolean;
  scheduledItemId: string;
  /** Existing rating on first render — null if user hasn't rated yet. */
  initialRating: Rating | null;
}

const RATING_META: Record<
  Rating,
  { he: string; en: string; tone: "good" | "neutral" | "warn" | "bad" }
> = {
  helpful:           { he: "עזר",      en: "Helped",            tone: "good"    },
  neutral:           { he: "בסדר",     en: "Okay",              tone: "neutral" },
  not_for_us:        { he: "לא לנו",   en: "Not for us",        tone: "warn"    },
  made_things_worse: { he: "פגע",      en: "Made it worse",     tone: "bad"    },
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

  const submit = async (chosen: Rating) => {
    setSubmitting(true);
    const res = await submitItemFeedback({
      scheduledItemId,
      rating: chosen,
      optionalText: note.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(
        isHe ? "השמירה נכשלה — נסו שוב" : "Save failed — try again",
      );
      return;
    }
    setRating(chosen);
    setSubmitted(true);
    setShowNote(false);
    toast.success(
      isHe
        ? "נשמר. ההמשך מתאים את עצמו למה שאמרתם."
        : "Saved. What comes next adjusts to what you said.",
    );
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
    const meta = RATING_META[rating];
    return (
      <section
        className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4"
        aria-live="polite"
      >
        <p className="text-[14px] leading-snug text-white/80">
          {isHe
            ? `סימנתם "${meta.he}". המסלול הבא מתחשב בזה.`
            : `You marked it "${meta.en}". What's next takes that in.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setShowNote(false);
            setNote("");
          }}
          className="mt-1 text-[12px] text-white/45 underline-offset-4 hover:text-white/75 hover:underline"
        >
          {isHe ? "שינוי" : "Change"}
        </button>
      </section>
    );
  }

  // ── Initial state: 4 buttons ─────────────────────────────────────
  return (
    <section
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4"
      aria-label={isHe ? "משוב על הפריט" : "Feedback on this item"}
    >
      <h3 className="text-[13px] font-bold uppercase tracking-wider text-white/65">
        {isHe ? "איך זה היה?" : "How was that?"}
      </h3>
      <p className="mt-1 text-[12px] text-white/45">
        {isHe
          ? "המשוב משנה את מה שתקבלו אחר כך."
          : "Your feedback changes what comes next."}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(RATING_META) as Rating[]).map((r) => {
          const meta = RATING_META[r];
          const Icon = ICONS[r];
          const isPicked = rating === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => handleClick(r)}
              disabled={submitting}
              className={`group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-3 text-[14px] font-semibold transition disabled:opacity-50 ${
                isPicked ? TONE_RING[meta.tone] : "border-white/10 bg-white/[0.02] text-white/75 hover:border-white/20 hover:bg-white/[0.06]"
              }`}
              aria-pressed={isPicked}
            >
              <Icon className="h-4 w-4" />
              {isHe ? meta.he : meta.en}
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
            placeholder={
              isHe
                ? "אופציונלי. מה לא עבד? המומחה/ת יקרא/תקרא."
                : "Optional. What didn't work? Your coach will read it."
            }
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
              {isHe ? "ביטול" : "Cancel"}
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
                  {isHe ? "שולח…" : "Sending…"}
                </>
              ) : isHe ? (
                "שליחה"
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
