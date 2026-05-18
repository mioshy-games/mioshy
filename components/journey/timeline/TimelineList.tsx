"use client";

// ============================================================
// TimelineList - the user-facing vertical timeline for the Journey
// Content System. Groups entries by category, shows a status-aware
// card per item with a lock countdown / complete checkmark / open
// affordance, and links each unlocked entry to the item-detail route.
//
// This component is pure presentation - all mutations happen on the
// item-detail page via server actions. Keeping writes off the list
// page lets us statically revalidate the timeline after any edit.
// ============================================================

import * as React from "react";
import Image from "next/image";
import { Link } from "@/navigation";
import {
  CheckCircle2,
  Clock,
  Lock,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import type { TimelineEntry } from "@/lib/journey-content/types";
import { cn } from "@/lib/utils";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  entries: TimelineEntry[];
  locale: string;
  viewerUserId: string;
  /** Whether the current owner is a paired couple (affects response labels). */
  partnered: boolean;
}

export function TimelineList({ entries, locale, partnered }: Props) {
  const isHe = locale === "he";

  // Group by category, preserving unlock-ordered insertion so earlier
  // categories (first unlock) surface first.
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        items: TimelineEntry[];
      }
    >();
    for (const e of entries) {
      const id = e.category.id;
      const name =
        (isHe ? e.category.name_he : e.category.name_en) ??
        e.category.name_he ??
        "-";
      const group = map.get(id);
      if (group) {
        group.items.push(e);
      } else {
        map.set(id, { categoryId: id, categoryName: name, items: [e] });
      }
    }
    return Array.from(map.values());
  }, [entries, isHe]);

  return (
    <div className="space-y-12">
      {grouped.map((group) => (
        <CategoryGroup
          key={group.categoryId}
          title={group.categoryName}
          items={group.items}
          isHe={isHe}
          partnered={partnered}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Category group - chapter heading + vertical rail of items
// ------------------------------------------------------------

function CategoryGroup({
  title,
  items,
  isHe,
  partnered,
}: {
  title: string;
  items: TimelineEntry[];
  isHe: boolean;
  partnered: boolean;
}) {
  const completed = items.filter((i) => i.status === "completed").length;
  const doneCountTpl = useCmsText("journeyTimeline.list.doneCount").text;
  const doneCount = doneCountTpl
    .replace("{completed}", String(completed))
    .replace("{total}", String(items.length));
  return (
    <section>
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>
        </div>
        <div className="text-xs text-white/55">{doneCount}</div>
      </header>

      <ol className="relative space-y-3">
        {/* Vertical rail - positioned on the start side (RTL-aware) */}
        <div
          aria-hidden
          className={cn(
            "absolute top-2 bottom-2 w-px bg-gradient-to-b from-white/0 via-white/15 to-white/0",
            isHe ? "right-[19px]" : "left-[19px]",
          )}
        />
        {items.map((entry) => (
          <TimelineCard
            key={entry.scheduled.id}
            entry={entry}
            isHe={isHe}
            partnered={partnered}
          />
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------
// Single timeline card
// ------------------------------------------------------------

function TimelineCard({
  entry,
  isHe,
  partnered,
}: {
  entry: TimelineEntry;
  isHe: boolean;
  partnered: boolean;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const status = entry.status;
  const title = isHe ? entry.item.title_he : entry.item.title_en ?? entry.item.title_he;
  const body = isHe ? entry.item.body_he : entry.item.body_en ?? entry.item.body_he;
  const hasImage = !!entry.item.image_url;
  const responsesCount = entry.responses.length;

  // Reply count templates — Hebrew is always plural form, English has
  // singular "1 reply" / plural "N replies".
  const replyOne = useCmsText("journeyTimeline.list.replyOne").text;
  const repliesManyTpl = useCmsText("journeyTimeline.list.repliesMany").text;
  const repliesLabel =
    responsesCount === 1
      ? replyOne
      : repliesManyTpl.replace("{n}", String(responsesCount));

  // Shared outer: wraps entire card so the whole region is the tap target
  // when openable; falls back to a <div> when locked so the cursor shows
  // it clearly can't be opened.
  const Wrap = status === "locked" ? LockedWrap : OpenableWrap;

  return (
    <li className="relative">
      {/* Node dot on the rail - subtly animated when available so the eye
          lands on it; crisp checkmark when done; muted when locked. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-6 flex h-6 w-6 items-center justify-center rounded-full border-2",
          isHe ? "right-[14px]" : "left-[14px]",
          status === "completed" &&
            "border-emerald-300/80 bg-emerald-500/35 text-emerald-50 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
          status === "available" &&
            "border-amber-200/90 bg-amber-400/40 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.65)]",
          status === "locked" && "border-white/15 bg-white/5 text-white/40",
        )}
      >
        {status === "available" ? (
          <span className="absolute inset-0 rounded-full bg-amber-300/30 animate-ping" />
        ) : null}
        {status === "completed" ? (
          <CheckCircle2 className="relative h-3.5 w-3.5" />
        ) : status === "available" ? (
          <Clock className="relative h-3.5 w-3.5" />
        ) : (
          <Lock className="relative h-3 w-3" />
        )}
      </span>

      <Wrap entry={entry}>
        <article
          className={cn(
            "relative rounded-2xl border backdrop-blur transition",
            // Rail is always on the inline-start side (right in RTL, left in LTR),
            // so the card needs an inline-start margin to clear it.
            "ms-12",
            // Completed: green accent but reduced emphasis - ink fades so
            // the eye doesn't re-read every "done" row on every scroll.
            status === "completed" &&
              "border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-white/0 opacity-90 hover:opacity-100 hover:from-emerald-500/[0.12]",
            // Available: strongest affordance - ambient glow ring + amber
            // tint + soft hover lift for the primary action.
            status === "available" &&
              "border-amber-300/65 bg-gradient-to-br from-amber-400/20 via-rose-400/10 to-indigo-500/10 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_20px_60px_-30px_rgba(251,191,36,0.55)] hover:-translate-y-0.5 hover:from-amber-400/25",
            // Locked: visibly dim + subtle desaturation so it reads as
            // "not yet" at a glance.
            status === "locked" &&
              "border-white/10 bg-white/[0.015] opacity-55 saturate-75",
          )}
        >
          {/* Mobile: compact square thumbnail above the text so the row
              is scannable on a phone. Desktop keeps the side thumbnail
              to preserve row density. */}
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-4 sm:p-5">
            {hasImage ? (
              <>
                <div className="relative mx-auto aspect-square w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:hidden">
                  <Image
                    src={entry.item.image_url!}
                    alt=""
                    fill
                    sizes="96px"
                    className={cn(
                      "object-cover",
                      status === "locked" && "opacity-70",
                    )}
                  />
                </div>
                <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:block">
                  <Image
                    src={entry.item.image_url!}
                    alt=""
                    fill
                    sizes="80px"
                    className={cn(
                      "object-cover",
                      status === "locked" && "opacity-70",
                    )}
                  />
                </div>
              </>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold sm:text-lg">
                  <span
                    className={cn(
                      status === "locked" && "text-white/55",
                      status === "completed" && "text-white/75",
                      status === "available" && "text-white",
                    )}
                  >
                    {title}
                  </span>
                </h3>
                <StatusPill
                  status={status}
                  unlockAt={entry.scheduled.unlock_at}
                  isHe={isHe}
                />
              </div>

              {/* Short snippet of body - full content on detail page */}
              <p
                className={cn(
                  "mt-1.5 line-clamp-2 text-sm",
                  status === "locked" && "text-white/40",
                  status === "completed" && "text-white/55",
                  status === "available" && "text-white/75",
                )}
              >
                {body}
              </p>

              {/* Layer 1 (#1) — Why this item attribution.
                  One subtle line, locale-resolved. Hidden when no
                  rule attribution (legacy rows) so cards don't grow
                  taller for unattributed items. */}
              {entry.matchRule ? (
                <p
                  className={cn(
                    "mt-1.5 inline-flex items-start gap-1 text-[11px] leading-snug",
                    "text-[#FAF6F7]/65",
                  )}
                >
                  <Sparkles
                    aria-hidden
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#B83C4D]"
                  />
                  <span className="line-clamp-1">
                    {isHe
                      ? entry.matchRule.rationale_he
                      : entry.matchRule.rationale_en}
                  </span>
                </p>
              ) : null}

              {/* Footer meta: responses count + partner hint + arrow */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/55">
                <div className="flex items-center gap-3">
                  {responsesCount > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {repliesLabel}
                    </span>
                  ) : null}
                  {partnered && status !== "locked" ? (
                    <CmsText
                      cmsKey="journeyTimeline.list.shared"
                      as="span"
                      className="opacity-70"
                    />
                  ) : null}
                </div>
                {status !== "locked" ? (
                  // Thumb-friendly "Open" affordance - min-h 44 on mobile so
                  // the tap target matches the card's clickable area and
                  // users never miss the edge.
                  <span className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-white/90 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-xs sm:font-medium sm:text-white/80">
                    <CmsText cmsKey="journeyTimeline.list.open" />
                    <Arrow className="h-3.5 w-3.5 rotate-180 sm:h-3 sm:w-3" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-white/40">
                    <Lock className="h-3.5 w-3.5" />
                    <CmsText cmsKey="journeyTimeline.list.locked" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </article>
      </Wrap>
    </li>
  );
}

// ------------------------------------------------------------
// Wrap variants: Link for openable, plain div for locked
// ------------------------------------------------------------

function OpenableWrap({
  entry,
  children,
}: {
  entry: TimelineEntry;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/journey/timeline/${entry.scheduled.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60 rounded-2xl"
      prefetch={false}
    >
      {children}
    </Link>
  );
}

function LockedWrap({ children }: { children: React.ReactNode }) {
  return <div aria-disabled>{children}</div>;
}

// ------------------------------------------------------------
// StatusPill - small badge with unlock countdown when locked
// ------------------------------------------------------------

function StatusPill({
  status,
  unlockAt,
  isHe,
}: {
  status: TimelineEntry["status"];
  unlockAt: string;
  isHe: boolean;
}) {
  // Pull every template/label this pill might render up-front — hooks
  // can't sit inside the if/return branches.
  const locked = useCmsText("journeyTimeline.list.locked").text;
  const unlockInOneDay = useCmsText("journeyTimeline.list.unlockInOneDay").text;
  const unlockInDaysTpl = useCmsText("journeyTimeline.list.unlockInDays").text;
  const unlockInWeeksTpl = useCmsText("journeyTimeline.list.unlockInWeeks").text;

  if (status === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-50">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <CmsText cmsKey="journeyTimeline.list.pillDone" />
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/70 bg-amber-400/25 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-50 shadow-[0_0_10px_rgba(251,191,36,0.5)]">
        <Sparkles className="h-3.5 w-3.5" />
        <CmsText cmsKey="journeyTimeline.list.pillOpen" />
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white/55">
      <Lock className="h-3 w-3" />
      {formatLockedPill(unlockAt, isHe, {
        locked,
        unlockInOneDay,
        unlockInDaysTpl,
        unlockInWeeksTpl,
      })}
    </span>
  );
}

function formatLockedPill(
  unlockAt: string,
  isHe: boolean,
  copy: {
    locked: string;
    unlockInOneDay: string;
    unlockInDaysTpl: string;
    unlockInWeeksTpl: string;
  },
): string {
  const ms = new Date(unlockAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return copy.locked;
  const days = Math.ceil(ms / 86_400_000);
  if (days === 1) return copy.unlockInOneDay;
  if (days < 14) return copy.unlockInDaysTpl.replace("{n}", String(days));
  const weeks = Math.ceil(days / 7);
  if (weeks < 6) return copy.unlockInWeeksTpl.replace("{n}", String(weeks));
  // Fallback - show a date once the gap is long enough that weeks feel silly.
  return new Date(unlockAt).toLocaleDateString(isHe ? "he-IL" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
