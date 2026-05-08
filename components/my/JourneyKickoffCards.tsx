/**
 * JourneyKickoffCards
 * ──────────────────────────────────────────────────────────────
 * Two side-by-side recap cards rendered near the top of /my/journey
 * for newly-purchased subscribers (#66 Itzik 2026-05-07):
 *
 *   1. Assessment recap — "Your top focus is X" + the size of the
 *      personalized program that came out of the assessment.
 *   2. Start here — surfaces the first available item (day-1 unlock
 *      override) so the user has one obvious next click.
 *
 * Both cards are skipped silently when the relevant data isn't yet
 * available (no top priority resolved, no available items). The page
 * then keeps the existing rail/desk as the primary surface.
 *
 * Design language: same wine-on-dark vocabulary as /pricing and
 * /billing/success — keeps the post-purchase journey consistent.
 */

import { Link } from "@/navigation";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  PlayCircle,
} from "lucide-react";

export type JourneyKickoffStartItem = {
  /** journey_scheduled_items.id — used to build /journey/timeline/[id] */
  scheduledId: string;
  /** Already locale-resolved */
  title: string;
  /** Already locale-resolved category name */
  categoryName: string | null;
  /** Already locale-resolved short body / hook */
  snippet: string | null;
};

interface Props {
  isHe: boolean;
  /** The user's #1 priority label (already locale-resolved) — null = unranked */
  focusLabel: string | null;
  /** Locale-resolved one-line description for the focus area */
  focusDesc: string | null;
  /** Total items in the user's program (timeline length) */
  totalItems: number;
  /** Items unlocked + not yet completed */
  openItemCount: number;
  /** Items already completed */
  completedItemCount: number;
  /** First available item to start with (day-1 unlock override target). null if none. */
  startItem: JourneyKickoffStartItem | null;
}

export function JourneyKickoffCards({
  isHe,
  focusLabel,
  focusDesc,
  totalItems,
  openItemCount,
  completedItemCount,
  startItem,
}: Props) {
  // Render nothing if neither card has anything meaningful to say —
  // the surrounding desk/rail already covers the "what's next" job.
  if (!focusLabel && !startItem) return null;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      {focusLabel ? (
        <AssessmentRecapCard
          isHe={isHe}
          focusLabel={focusLabel}
          focusDesc={focusDesc}
          totalItems={totalItems}
          openItemCount={openItemCount}
          completedItemCount={completedItemCount}
        />
      ) : null}
      {startItem ? (
        <StartHereCard isHe={isHe} item={startItem} Arrow={Arrow} />
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function AssessmentRecapCard({
  isHe,
  focusLabel,
  focusDesc,
  totalItems,
  openItemCount,
  completedItemCount,
}: {
  isHe: boolean;
  focusLabel: string;
  focusDesc: string | null;
  totalItems: number;
  openItemCount: number;
  completedItemCount: number;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        borderColor: "rgba(184,60,77,0.30)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.14) 0%, rgba(108,46,64,0.06) 60%, rgba(255,255,255,0.02) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "#B83C4D" }}
      />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          <Sparkles className="h-3 w-3" />
          {isHe ? "תוצאות האבחון" : "Assessment results"}
        </span>

        <h3 className="mt-3 text-[13px] font-semibold uppercase tracking-wider text-white/55">
          {isHe ? "המוקד הראשון שלכם" : "Your first focus"}
        </h3>
        <p className="mt-1 font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[26px]">
          {focusLabel}
        </p>
        {focusDesc ? (
          <p className="mt-1.5 text-[14px] leading-[1.55] text-white/70">
            {focusDesc}
          </p>
        ) : null}

        {/* Mini stats — bullet line so it stays compact */}
        {totalItems > 0 ? (
          <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-white/70">
            <li className="inline-flex items-center gap-1.5">
              <PlayCircle className="h-3.5 w-3.5 text-emerald-300" />
              {isHe
                ? `${openItemCount} זמינים עכשיו`
                : `${openItemCount} open now`}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-white/60" />
              {isHe
                ? `${completedItemCount} הושלמו`
                : `${completedItemCount} completed`}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-white/45" />
              {isHe
                ? `${totalItems} בתוכנית`
                : `${totalItems} in your plan`}
            </li>
          </ul>
        ) : null}

      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────

function StartHereCard({
  isHe,
  item,
  Arrow,
}: {
  isHe: boolean;
  item: JourneyKickoffStartItem;
  Arrow: typeof ArrowLeft;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.10) 0%, rgba(8,4,12,0.6) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-16 -bottom-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "#B83C4D" }}
      />

      <div className="relative flex h-full flex-col">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
          <Sparkles className="h-3 w-3" />
          {isHe ? "התחילו כאן" : "Start here"}
        </span>

        {item.categoryName ? (
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-wider text-white/55">
            {item.categoryName}
          </p>
        ) : null}
        <h3 className="mt-1 font-heading text-[22px] font-extrabold leading-snug text-white sm:text-[24px]">
          {item.title}
        </h3>
        {item.snippet ? (
          <p className="mt-2 line-clamp-3 text-[14px] leading-[1.55] text-white/70">
            {item.snippet}
          </p>
        ) : null}

        <Link
          href={`/journey/timeline/${item.scheduledId}`}
          className="group mt-5 inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-bold text-white transition hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            boxShadow: "0 12px 28px -10px rgba(184,60,77,0.55)",
          }}
        >
          {isHe ? "פתחו את הצעד הראשון" : "Open your first step"}
          <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" />
        </Link>
      </div>
    </article>
  );
}
