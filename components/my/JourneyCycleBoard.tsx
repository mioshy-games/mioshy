"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/navigation";
import { Check, Sparkles, MessageCircle, HeartHandshake, ArrowLeft } from "lucide-react";
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
  /**
   * ISO timestamp of the newest message the expert wrote in this user's
   * channel, or null when the expert has never written.
   *
   * Itzik 2026-08-01: the inline channel was removed from /my/journey, and
   * removing it without this would bury a waiting reply — the user would have
   * to navigate to /my/expert on a hunch. journey_messages has no read_at
   * column, so "unread" is resolved client-side against localStorage, the same
   * technique ClinicianReplyBanner already uses.
   */
  latestExpertMessageAt?: string | null;
}

/** Mirrors ClinicianReplyBanner's LS_KEY convention. */
const EXPERT_SEEN_KEY = "mioshy:journey:lastSeenExpertMessageAt";

export function JourneyCycleBoard({
  cycle,
  nextPeek = [],
  coaching,
  partnerSpaceHref = null,
}: {
  cycle: OpenCycle;
  nextPeek?: NextCyclePeek[];
  coaching: CoachingBlock;
  /**
   * Link to the couple's shared surface. NULL for solo users — the caller
   * passes it only when the viewer is actually paired, so an unpaired user can
   * never see a door to a room that does not exist for them.
   */
  partnerSpaceHref?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState(false);
  const [expertUnread, setExpertUnread] = useState(false);

  const done = cycle.cards.filter((c) => c.completedAt).length;

  const latestExpertAt = coaching.latestExpertMessageAt ?? null;
  useEffect(() => {
    if (!latestExpertAt) {
      setExpertUnread(false);
      return;
    }
    try {
      const seen = localStorage.getItem(EXPERT_SEEN_KEY);
      const seenMs = seen ? Date.parse(seen) : 0;
      const msgMs = Date.parse(latestExpertAt);
      setExpertUnread(Number.isFinite(msgMs) && msgMs > seenMs);
    } catch {
      // localStorage unavailable (private mode) — better to surface the reply
      // than to hide it.
      setExpertUnread(true);
    }
  }, [latestExpertAt]);

  const markExpertSeen = () => {
    try {
      localStorage.setItem(EXPERT_SEEN_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setExpertUnread(false);
  };

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
                /* Itzik 2026-08-01: this used to be bg-white/[0.09] — a grey
                   wash that read as a disabled field, not an action. It now
                   carries the brand pink with a lift shadow and a check glyph.
                   Deliberately NOT the full gradient of the expert CTA below:
                   five gradient buttons in a grid would out-shout both the
                   chapter titles (the card's own tap target) and the single
                   primary action on the page. */
                <button
                  type="button"
                  onClick={() => mark(card.cycleItemId)}
                  disabled={isBusy}
                  className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D6409F]/45 bg-[#D6409F]/[0.14] px-4 py-2.5 text-[14px] font-bold text-[#FAF6F7] shadow-[0_8px_22px_-14px_rgba(214,64,159,0.9)] transition hover:border-[#D6409F]/75 hover:bg-[#D6409F]/[0.26] hover:shadow-[0_10px_26px_-14px_rgba(214,64,159,1)] active:scale-[0.99] disabled:opacity-60"
                >
                  {!isBusy && <Check className="h-4 w-4 shrink-0" aria-hidden />}
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

      {/* Partner's shared space. Renders only for a paired viewer — the caller
          decides, so a solo user never sees it. Carried over from the old
          dashboard section that was retired on 2026-08-01; the destination page
          (/my/journey/together) is unchanged. Copy approved by Itzik. */}
      {partnerSpaceHref && (
        <Link
          href={partnerSpaceHref}
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#B83C4D]/30 bg-[#B83C4D]/[0.06] px-4 py-3.5 transition hover:border-[#B83C4D]/50 hover:bg-[#B83C4D]/[0.11]"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-[#F0A6D0]" aria-hidden />
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-[#FAF6F7]">
                המרחב המשותף שלכם
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-[#FAF6F7]/70">
                מה שעשיתם יחד, השיחה ביניכם וההודעות מהמומחה
              </p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 shrink-0 text-[#FAF6F7]/55" aria-hidden />
        </Link>
      )}

      {/* Expert block — always present, two variants. */}
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-slate-950/40 px-4 py-4">
        <div className="flex items-start gap-2.5">
          <span className="relative mt-0.5 shrink-0">
            <MessageCircle className="h-4 w-4 text-[#F0A6D0]" aria-hidden />
            {expertUnread && (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-slate-950"
              />
            )}
          </span>
          <p className="text-[14px] font-semibold leading-relaxed text-[#FAF6F7]">
            {coaching.hasCoaching
              ? "המומחים שלנו כאן בשבילכם, בכל שאלה שעולה מהתכנים"
              : "רוצים מומחה אישי שילווה אתכם לאורך הדרך?"}
          </p>
        </div>

        {/* The whole point of removing the inline channel: a waiting reply must
            still announce itself here, or it is buried behind a navigation the
            user has no reason to make. */}
        {expertUnread && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[13.5px] font-bold text-emerald-200">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            יש לכם תשובה מהמומחה
          </p>
        )}

        <Link
          href={coaching.hasCoaching ? coaching.chatHref : coaching.upgradeHref}
          onClick={markExpertSeen}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(95deg,#6C5CE7_0%,#D6409F_52%,#F79154_100%)] px-4 py-2.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99] sm:w-auto sm:px-6"
        >
          {coaching.hasCoaching ? "לשיחה עם מומחה" : "להוספת ליווי אישי"}
        </Link>
      </div>
    </section>
  );
}
