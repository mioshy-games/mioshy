"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { markCycleItemDone } from "@/app/actions/journey-cycle";

/**
 * "עשינו את זה" at the bottom of a chapter. Same action and same celebration
 * copy as the board on /my/journey — one behaviour, two entry points.
 */
export function ChapterDoneButton({
  cycleItemId,
  alreadyDone,
  isHe,
}: {
  cycleItemId: string;
  alreadyDone: boolean;
  isHe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyDone);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState(false);

  if (done && !celebrating) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400/15 px-4 py-2.5 text-[14px] font-bold text-emerald-100">
        <Check className="h-4 w-4" aria-hidden />
        {isHe ? "עשינו את זה" : "We did this"}
      </p>
    );
  }

  return (
    <>
      {celebrating && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-300/25 bg-emerald-400/[0.08] px-4 py-3.5"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" aria-hidden />
          <p className="text-[14px] font-semibold leading-relaxed text-emerald-50">
            סיימתם את המחזור. המחזור הבא נפתח עכשיו, עם חמישה תכנים חדשים.
          </p>
        </div>
      )}

      {!celebrating && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(false);
              const r = await markCycleItemDone(cycleItemId);
              if (!r.ok) {
                setError(true);
                return;
              }
              setDone(true);
              if (r.cycleClosed) {
                setCelebrating(true);
                setTimeout(() => router.push(isHe ? "/he/my/lessons" : "/en/my/lessons"), 2600);
                return;
              }
              router.refresh();
            })
          }
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] px-4 py-3 text-[15px] font-bold text-[#FAF6F7] transition hover:bg-white/[0.12] active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {pending ? (isHe ? "רגע…" : "One moment…") : isHe ? "עשינו את זה" : "We did this"}
        </button>
      )}

      {error && (
        <p className="mt-2 text-[13px] text-rose-300">
          {isHe ? "לא הצלחנו לשמור את הסימון. נסו שוב." : "Could not save. Please try again."}
        </p>
      )}
    </>
  );
}
