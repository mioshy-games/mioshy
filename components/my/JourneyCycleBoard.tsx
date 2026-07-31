"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/navigation";
import { Check, Sparkles, MessageCircle } from "lucide-react";
import { markCycleItemDone } from "@/app/actions/journey-cycle";
import { CategoryIcon } from "@/components/icons/CategoryIcons";
import type { OpenCycle, NextCyclePeek } from "@/lib/journey-content/cycle-user";

/**
 * The five open chapters (spec §3 + §4), rebuilt after Itzik walked production
 * on 2026-07-31.
 *
 * What changed and why:
 *   · ALL five are listed here, always — including ones already marked. A
 *     marked chapter stays visible, stays tappable, and just carries a quiet
 *     "סימנתם". Before this, chapter #1 was promoted into a separate "today"
 *     hero and marked ones dropped into history, so the user counted four.
 *   · Each category has its own line icon instead of a shared clock, which read
 *     as "waiting" on a chapter that was in fact open.
 *   · Three distinct states — untouched · opened · marked — because a chapter
 *     you have already read should not look like one you have never seen.
 *
 * All copy here is approved verbatim (Itzik 2026-07-31). Do not reword.
 *
 * Mobile first: one column, full-width targets; two columns from `sm`. The
 * desktop layout around it is untouched.
 */

export interface CoachingBlock {
  /** Did they buy the coaching add-on? Decides which variant renders. */
  hasCoaching: boolean;
  chatHref: string;
  upgradeHref: string;
}

export function JourneyCycleBoard({
  cycle,
  nextPeek = [],
  coaching,
}: {
  cycle: OpenCycle;
  nextPeek?: NextCyclePeek[];
  coaching: CoachingBlock;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState(false);

  const done = cycle.cards.filter((c) => c.completedAt).length;

  const mark = (cycleItemId: string) => {
    setBusyId(cycleItemId);
    setError(false);
    startTransition(async () => {
      const r = await markCycleItemDone(cycleItemId);
      setBusyId(null);
      if (!r.ok) {
        setError(true);
        return;
      }
      if (r.cycleClosed) {
        setCelebrating(true);
        setTimeout(() => router.refresh(), 2600);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="mt-6" aria-label="התכנים הפתוחים שלכם">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold text-[#FAF6F7] sm:text-lg">
          מחזור {cycle.cycleNumber} · חמישה תכנים פתוחים לכם
        </h2>
        <p className="text-[13px] font-semibold tabular-nums text-[#FAF6F7]/70">
          סימנתם {done} מתוך {cycle.totalCount}
        </p>
      </div>

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

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cycle.cards.map((card) => {
          const isDone = Boolean(card.completedAt);
          const wasOpened = Boolean(card.openedAt);
          const isBusy = pending && busyId === card.cycleItemId;

          // Three states. Untouched is the brightest — it is the invitation.
          // Opened steps back. Marked goes green and calm but stays a
          // full-strength, tappable card.
          const shell = isDone
            ? "border-emerald-300/30 bg-emerald-400/[0.07]"
            : wasOpened
              ? "border-white/[0.14] bg-white/[0.05]"
              : "border-[#D6409F]/30 bg-white/[0.10] shadow-[0_10px_30px_-18px_rgba(214,64,159,0.65)]";

          const iconTint = isDone
            ? "text-emerald-200"
            : wasOpened
              ? "text-[#FAF6F7]/60"
              : "text-[#F0A6D0]";

          return (
            <li
              key={card.cycleItemId}
              className={`group rounded-2xl border p-4 transition hover:border-[#D6409F]/55 hover:bg-white/[0.14] ${shell}`}
            >
              <Link
                href={`/journey/chapter/${card.cycleItemId}`}
                className="block focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon
                    slug={card.categorySlug}
                    className={`h-[18px] w-[18px] shrink-0 transition ${iconTint}`}
                  />
                  <span className="text-[11.5px] font-bold uppercase tracking-wide text-[#FAF6F7]/60">
                    {card.categoryName}
                  </span>
                  {card.isSubstitute && (
                    <span
                      aria-hidden
                      title="נבחר עבורכם מתחום קרוב"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FAF6F7]/35"
                    />
                  )}
                  {isDone && (
                    <span className="ms-auto inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-200">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      סימנתם
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-[15px] font-bold leading-snug text-[#FAF6F7] underline-offset-4 group-hover:underline">
                  {card.title}
                </h3>
              </Link>

              {!isDone && (
                <button
                  type="button"
                  onClick={() => mark(card.cycleItemId)}
                  disabled={isBusy}
                  className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.09] px-4 py-2.5 text-[14px] font-bold text-[#FAF6F7] transition hover:bg-white/[0.16] active:scale-[0.99] disabled:opacity-60"
                >
                  {isBusy ? "רגע…" : "עשינו את זה"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-[13px] text-rose-300">לא הצלחנו לשמור את הסימון. נסו שוב.</p>
      )}

      <p className="mt-5 text-[13px] leading-relaxed text-[#FAF6F7]/60">
        בעוד חודש ייפתחו לכם חמישה תכנים חדשים, אחד מכל תחום.
      </p>

      {/* Teaser. Not a mock-up: these come from the real selector over the real
          remaining library, so what it promises is what actually opens. Hidden
          entirely when the library is spent — never padded. */}
      {nextPeek.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/30 px-4 py-3.5">
          <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[#FAF6F7]/50">
            מה מחכה לכם במחזור הבא
          </h3>
          <ul className="mt-2.5 space-y-2">
            {nextPeek.map((p, i) => (
              <li key={`${p.title}-${i}`} className="flex items-start gap-2">
                <CategoryIcon
                  slug={p.categorySlug}
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#FAF6F7]/30"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#FAF6F7]/35">
                    {p.categoryName}
                  </div>
                  <div className="text-[13.5px] font-medium leading-snug text-[#FAF6F7]/55">
                    {p.title}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expert block — always present, two variants. */}
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-slate-950/40 px-4 py-4">
        <div className="flex items-start gap-2.5">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F0A6D0]" aria-hidden />
          <p className="text-[14px] font-semibold leading-relaxed text-[#FAF6F7]">
            {coaching.hasCoaching
              ? "המומחים שלנו כאן בשבילכם, בכל שאלה שעולה מהתכנים"
              : "רוצים מומחה אישי שילווה אתכם לאורך הדרך?"}
          </p>
        </div>
        <Link
          href={coaching.hasCoaching ? coaching.chatHref : coaching.upgradeHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(95deg,#6C5CE7_0%,#D6409F_52%,#F79154_100%)] px-4 py-2.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99] sm:w-auto sm:px-6"
        >
          {coaching.hasCoaching ? "לשיחה עם מומחה" : "להוספת ליווי אישי"}
        </Link>
      </div>
    </section>
  );
}
