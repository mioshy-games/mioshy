"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/navigation";
import { Check, Sparkles } from "lucide-react";
import { markCycleItemDone } from "@/app/actions/journey-cycle";
import type { OpenCycle } from "@/lib/journey-content/cycle-user";

/**
 * The five open chapters (spec §3 + §4).
 *
 * Everything is open and tappable from the first moment — no locks, no
 * progressive reveal. That is the entire point of the model: on day one the
 * couple sees a whole world rather than a trickle.
 *
 * Copy below is approved verbatim (Itzik 2026-07-31). Do not reword.
 *
 * Mobile first: a single column stack, cards full width, tap targets full
 * width. From `sm` up it relaxes into two columns; the surrounding desktop
 * layout of /my/journey is untouched.
 */
export function JourneyCycleBoard({ cycle }: { cycle: OpenCycle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = cycle.cards.filter((c) => c.completedAt).length;
  const total = cycle.totalCount;

  const mark = (cycleItemId: string) => {
    setBusyId(cycleItemId);
    setError(null);
    startTransition(async () => {
      const r = await markCycleItemDone(cycleItemId);
      setBusyId(null);
      if (!r.ok) {
        setError("לא הצלחנו לשמור את הסימון. נסו שוב.");
        return;
      }
      if (r.cycleClosed) {
        setCelebrating(true);
        // Let the moment land before the next five replace them.
        setTimeout(() => router.refresh(), 2600);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="mt-6" aria-label="התכנים הפתוחים שלכם">
      {/* ── Counter + progress ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold text-[#FAF6F7] sm:text-lg">
          מחזור {cycle.cycleNumber} · חמישה תכנים פתוחים לכם
        </h2>
        <p className="text-[13px] font-semibold tabular-nums text-[#FAF6F7]/70">
          סימנתם {done} מתוך {total}
        </p>
      </div>

      {/* ── Celebration (§4) ───────────────────────────────────────────── */}
      {celebrating && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-300/25 bg-emerald-400/[0.08] px-4 py-3.5"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" aria-hidden />
          <p className="text-[14px] font-semibold leading-relaxed text-emerald-50">
            סיימתם את המחזור. המחזור הבא נפתח עכשיו, עם חמישה תכנים חדשים.
          </p>
        </div>
      )}

      {/* ── The five cards ─────────────────────────────────────────────── */}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cycle.cards.map((card) => {
          const isDone = Boolean(card.completedAt);
          const isBusy = pending && busyId === card.cycleItemId;
          return (
            <li
              key={card.cycleItemId}
              className={`rounded-2xl border p-4 transition ${
                isDone
                  ? "border-emerald-300/25 bg-emerald-400/[0.06]"
                  : "border-white/[0.08] bg-slate-950/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {/* A substitute is cued gently — a soft dot — and never named.
                    The user simply sees the area the chapter belongs to. */}
                {card.isSubstitute && (
                  <span
                    aria-hidden
                    title="נבחר עבורכם מתחום קרוב"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FAF6F7]/35"
                  />
                )}
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-[#FAF6F7]/55">
                  {card.categoryName}
                </span>
              </div>

              <Link
                href={`/journey/chapter/${card.cycleItemId}`}
                className="mt-1.5 block text-[15px] font-bold leading-snug text-[#FAF6F7] underline-offset-4 hover:underline"
              >
                {card.title}
              </Link>

              <button
                type="button"
                onClick={() => !isDone && mark(card.cycleItemId)}
                disabled={isDone || isBusy}
                aria-pressed={isDone}
                className={`mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold transition ${
                  isDone
                    ? "cursor-default bg-emerald-400/15 text-emerald-100"
                    : "bg-white/[0.07] text-[#FAF6F7] hover:bg-white/[0.12] active:scale-[0.99] disabled:opacity-60"
                }`}
              >
                {isDone ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden />
                    עשינו את זה
                  </>
                ) : isBusy ? (
                  "רגע…"
                ) : (
                  "עשינו את זה"
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-[13px] text-rose-300">{error}</p>}

      {/* ── Forward promise (§4) — always visible ──────────────────────── */}
      <p className="mt-4 text-[13px] leading-relaxed text-[#FAF6F7]/60">
        בעוד חודש ייפתח מחזור חדש, תוכן אחד מכל תחום. וכשתסמנו את כל החמישה, הוא
        ייפתח מיד.
      </p>
    </section>
  );
}
