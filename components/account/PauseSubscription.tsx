"use client";

/**
 * PauseSubscription
 * ─────────────────────────────────────────────────────────
 * Layer-3 user-facing pause flow. Sits in /account.
 *
 * Two modes based on hasActivePause:
 *   • Idle  — "Need a break? Pause for 2/4/8 weeks." button reveals
 *             a small picker with reason chips + confirm.
 *   • Paused — "You're paused until X — return anytime." button
 *              resumes immediately.
 *
 * Important framing: pause is the FIRST option offered when the
 * user looks for cancel. Cancellation is downstream of pause.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  pauseSubscription,
  resumeSubscription,
} from "@/app/actions/subscription-pause";

interface Props {
  isHe:         boolean;
  hasActivePause: boolean;
  pausedUntil:  string | null;
}

const DURATIONS: Array<2 | 4 | 8> = [2, 4, 8];

const REASONS = [
  { id: "too_busy", he: "עמוסים", en: "Swamped" },
  { id: "life_event", he: "קרה משהו בחיים", en: "Life happened" },
  { id: "tried_not_for_us", he: "ניסינו — לא לנו", en: "Tried it — not for us" },
  { id: "other", he: "משהו אחר", en: "Other" },
] as const;

export function PauseSubscription({ isHe, hasActivePause, pausedUntil }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weeks, setWeeks] = useState<2 | 4 | 8>(4);
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("too_busy");
  const [reasonText, setReasonText] = useState("");

  const onPause = () => {
    startTransition(async () => {
      const res = await pauseSubscription({ weeks, reason, reasonText: reasonText || null });
      if (!res.ok) {
        toast.error(isHe ? `השהיה נכשלה: ${res.error}` : `Pause failed: ${res.error}`);
        return;
      }
      toast.success(
        isHe
          ? "המנוי בהשהיה. כשתחזרו, הכל יחכה."
          : "Paused. When you come back, it's all here.",
      );
      setPickerOpen(false);
      router.refresh();
    });
  };

  const onResume = () => {
    startTransition(async () => {
      const res = await resumeSubscription();
      if (!res.ok) {
        toast.error(isHe ? `חזרה נכשלה: ${res.error}` : `Resume failed: ${res.error}`);
        return;
      }
      toast.success(isHe ? "שמחים שחזרתם." : "Glad to have you back.");
      router.refresh();
    });
  };

  if (hasActivePause && pausedUntil) {
    const formatted = new Date(pausedUntil).toLocaleDateString(
      isHe ? "he-IL" : "en-US",
      { year: "numeric", month: "short", day: "numeric" },
    );
    return (
      <section
        className="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-500/5 p-5"
        aria-live="polite"
      >
        <header className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-100">
          <CalendarClock className="size-4" />
          {isHe ? "בהשהיה" : "Paused"}
        </header>
        <p className="text-[15px] leading-relaxed text-white/85">
          {isHe
            ? `המנוי בהשהיה עד ${formatted}. הכל יחכה לכם.`
            : `Paused until ${formatted}. Everything will be here.`}
        </p>
        <div>
          <Button
            type="button"
            onClick={onResume}
            disabled={pending}
            className="gap-2"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            {isHe ? "חזרנו" : "We're back"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <header>
        <h3 className="font-heading text-[18px] font-bold text-white">
          {isHe ? "צריכים פסק זמן?" : "Need to step away?"}
        </h3>
        <p className="mt-1 text-[14px] leading-snug text-white/65">
          {isHe
            ? "במקום לבטל — להשהות. הכל ימשיך מאיפה שעצרתם."
            : "Instead of cancelling — pause. Everything picks up where you left off."}
        </p>
      </header>

      {pickerOpen ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/60">
              {isHe ? "לכמה" : "How long"}
            </p>
            <div className="flex gap-2">
              {DURATIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    weeks === w
                      ? "border-[#B83C4D]/60 bg-[#B83C4D]/15 text-white"
                      : "border-white/15 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
                  }`}
                >
                  {isHe ? `${w} שבועות` : `${w} weeks`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-white/60">
              {isHe ? "מה קורה" : "What's up"}
            </p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                    reason === r.id
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
                  }`}
                >
                  {isHe ? r.he : r.en}
                </button>
              ))}
            </div>
          </div>

          {reason === "other" ? (
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              dir={isHe ? "rtl" : "ltr"}
              rows={3}
              maxLength={500}
              placeholder={isHe ? "אם בא לכם — כתבו" : "If you want — tell us"}
              className="bg-white/[0.04] border-white/15 text-white placeholder:text-white/35"
            />
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPickerOpen(false)}
              disabled={pending}
            >
              {isHe ? "ביטול" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={onPause}
              disabled={pending}
              className="gap-2"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PauseCircle className="size-4" />
              )}
              {isHe ? `להשהות ל-${weeks} שבועות` : `Pause ${weeks} weeks`}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="gap-2"
        >
          <PauseCircle className="size-4" />
          {isHe ? "להשהות" : "Pause"}
        </Button>
      )}
    </section>
  );
}
