"use client";

/**
 * JourneyDesk — the primary work surface of /my/journey.
 *
 * Layout (desktop, lg+):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │   Content panel (selected pill's content)   │   Rail    │
 *   │                                              │  vertical │
 *   │   - Hero (image / video placeholder)         │  menu     │
 *   │   - Title + body                             │  RTL: רן  │
 *   │   - Sub-items list                           │           │
 *   │   - "Open full view" CTA                     │           │
 *   │   - Reply / response box                     │           │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Layout (mobile, < lg):
 *   ┌─────────────────────────┐
 *   │   Rail (horizontal scroll, sticky-ish)
 *   ├─────────────────────────┤
 *   │   Content panel
 *   └─────────────────────────┘
 *
 * Selection state:
 *   - Default selected = first pill with status "current".
 *     Falls back to first "completed", then to the first pill in the list.
 *   - Future ("pending") pills are NOT clickable in the rail. The user
 *     can see them but the platform won't switch to a locked screen.
 *   - Within a pill: the panel surfaces the most-relevant item by
 *     default; the user can click sibling items to switch.
 *
 * Why this is a single client component (instead of separate ones):
 *   - Selection state needs to be shared between rail (highlighting)
 *     and the panel (rendering). Hoisting the state to the page would
 *     turn the page into a client component, which we want to avoid
 *     because the page also does heavy server-side data loading.
 *   - The internal split (RailColumn / ContentPanel / ItemViewer) keeps
 *     each concern independent and testable.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/navigation";
import {
  CheckCircle2,
  Lock,
  Sparkles,
  ImageIcon,
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import type {
  RailEntry,
  PillItemRef,
  PillItemStatus,
  JourneyProgressSummary,
} from "@/lib/dashboard/journey-rail";
import { aggregateProgress } from "@/lib/dashboard/journey-rail";
import { ResponseBox } from "@/components/my/ResponseBox";
import { track } from "@/lib/analytics";

export function JourneyDesk({
  isHe,
  entries,
}: {
  isHe: boolean;
  entries: RailEntry[];
}) {
  const initialKey = useMemo(() => {
    return (
      entries.find((e) => e.status === "current")?.key ??
      entries.find((e) => e.status === "completed")?.key ??
      entries[0]?.key ??
      null
    );
  }, [entries]);

  const [selectedPillKey, setSelectedPillKey] = useState<string | null>(
    initialKey,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedPill =
    entries.find((e) => e.key === selectedPillKey) ??
    entries[0] ??
    null;

  // When the pill changes, reset the selected item to "first available
  // or first in list".
  useEffect(() => {
    if (!selectedPill || !selectedPill.items || selectedPill.items.length === 0) {
      setSelectedItemId(null);
      return;
    }
    const first =
      selectedPill.items.find((i) => i.status === "available") ??
      selectedPill.items.find((i) => i.status === "completed") ??
      selectedPill.items[0];
    setSelectedItemId(first?.id ?? null);
  }, [selectedPill]);

  // Always compute progress — must come before any early return so
  // hook order stays stable (rules-of-hooks).
  const progress = useMemo(() => aggregateProgress(entries), [entries]);

  if (!selectedPill) return null;

  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const selectedItem =
    selectedPill.items?.find((i) => i.id === selectedItemId) ??
    selectedPill.items?.[0] ??
    null;

  const onSelectPill = (entry: RailEntry) => {
    if (entry.status === "pending") return; // locked: no-op
    setSelectedPillKey(entry.key);
    track("journey_rail_pill_clicked", {
      key: entry.key,
      label: entry.label,
      status: entry.status,
    });
  };

  return (
    <div className="space-y-4">
      {/* Progress strip — quick "how am I doing" header. Empty
          (no real items) → render nothing; the "preparing" content
          panel carries the message in that case. */}
      {progress.totalItems > 0 ? (
        <ProgressStrip isHe={isHe} progress={progress} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Content panel — DOM order matters for mobile (rail first). */}
        <div className="order-2 lg:order-1 lg:col-span-8">
          <ContentPanel
            isHe={isHe}
            pill={selectedPill}
            item={selectedItem}
            onSelectItem={(id) => setSelectedItemId(id)}
            Arrow={Arrow}
          />
        </div>
        {/* Rail — order-1 on mobile (top), col 1-4 on lg (right side in RTL). */}
        <aside className="order-1 lg:order-2 lg:col-span-4">
          <RailColumn
            isHe={isHe}
            entries={entries}
            selectedKey={selectedPill.key}
            onSelect={onSelectPill}
          />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Progress strip — sits above the desk
// ─────────────────────────────────────────────────────────────────────

function ProgressStrip({
  isHe,
  progress,
}: {
  isHe: boolean;
  progress: JourneyProgressSummary;
}) {
  const pct =
    progress.totalItems === 0
      ? 0
      : Math.round((progress.completedItems / progress.totalItems) * 100);

  return (
    <section
      aria-label={isHe ? "סיכום התקדמות" : "Progress summary"}
      className="rounded-2xl border border-white/[0.07] bg-slate-950/60 p-4 backdrop-blur-md sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "ההתקדמות שלכם" : "Your progress"}
        </h2>
        <span className="text-[11px] text-white/45">
          {isHe
            ? `${progress.completedItems} מתוך ${progress.totalItems} הושלמו`
            : `${progress.completedItems} of ${progress.totalItems} completed`}
        </span>
      </div>
      {/* Progress bar — calm, low-contrast */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full bg-emerald-400/80 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Stat chips */}
      <ul className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <ProgressChip
          label={isHe ? "פעילים" : "Open"}
          value={progress.availableItems}
          tone="white"
        />
        <ProgressChip
          label={isHe ? "ממתינים לתגובה שלכם" : "Awaiting your response"}
          value={progress.awaitingResponseItems}
          tone="amber"
          dim={progress.awaitingResponseItems === 0}
        />
        <ProgressChip
          label={isHe ? "תגובות חדשות מהמומחה" : "New replies"}
          value={progress.unreadReplies}
          tone="violet"
          dim={progress.unreadReplies === 0}
        />
        {progress.stuckItems > 0 ? (
          <ProgressChip
            label={isHe ? "תקועים מעל שבוע" : "Stuck > 1 week"}
            value={progress.stuckItems}
            tone="rose"
          />
        ) : null}
      </ul>
    </section>
  );
}

function ProgressChip({
  label,
  value,
  tone,
  dim,
}: {
  label: string;
  value: number;
  tone: "white" | "amber" | "violet" | "rose";
  dim?: boolean;
}) {
  const palette =
    tone === "amber"
      ? "border-amber-400/25 bg-amber-500/[0.06] text-amber-100"
      : tone === "violet"
        ? "border-violet-400/25 bg-violet-500/[0.06] text-violet-100"
        : tone === "rose"
          ? "border-rose-400/25 bg-rose-500/[0.06] text-rose-100"
          : "border-white/15 bg-white/[0.04] text-white/85";
  return (
    <li
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        palette,
        dim ? "opacity-50" : "",
      ].join(" ")}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-current/80">{label}</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rail (vertical on lg+, horizontal scroll on mobile)
// ─────────────────────────────────────────────────────────────────────

function RailColumn({
  isHe,
  entries,
  selectedKey,
  onSelect,
}: {
  isHe: boolean;
  entries: RailEntry[];
  selectedKey: string;
  onSelect: (entry: RailEntry) => void;
}) {
  return (
    <nav
      aria-label={isHe ? "מסלול הליווי" : "Coaching path"}
      className={[
        "rounded-2xl border border-white/[0.07] bg-slate-950/70 p-3 backdrop-blur-md sm:p-4",
        // Sticky on lg+ so the menu stays visible as content scrolls.
        "lg:sticky lg:top-6",
      ].join(" ")}
    >
      <header className="mb-3 px-1">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "מסלול הליווי שלכם" : "Your coaching path"}
        </h2>
        <p className="mt-0.5 text-[11px] text-white/45">
          {isHe
            ? "לחצו על שלב כדי לפתוח את התוכן בצד"
            : "Tap a step to open its content"}
        </p>
      </header>

      <ol
        className={[
          // Mobile: horizontal scroll. Desktop: vertical column.
          "flex gap-2 overflow-x-auto pb-1",
          "snap-x snap-mandatory",
          "lg:flex-col lg:gap-1.5 lg:overflow-visible lg:snap-none lg:pb-0",
          "[scrollbar-width:none] [-ms-overflow-style:none]",
          "[&::-webkit-scrollbar]:hidden",
        ].join(" ")}
      >
        {entries.map((entry, idx) => (
          <li key={entry.key} className="snap-start lg:snap-align-none">
            <RailButton
              entry={entry}
              index={idx}
              total={entries.length}
              isSelected={entry.key === selectedKey}
              onClick={() => onSelect(entry)}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function RailButton({
  entry,
  index,
  total,
  isSelected,
  onClick,
}: {
  entry: RailEntry;
  index: number;
  total: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isLocked = entry.status === "pending";
  const Icon =
    entry.status === "completed"
      ? CheckCircle2
      : entry.status === "current"
        ? Sparkles
        : Lock;

  // Aggregate badges from items inside this pill — show a single dot
  // when there's an unread reply or an item awaiting the user's
  // response. Surfaced in the corner so it doesn't fight the icon.
  const unreadCount =
    entry.items?.filter((i) => i.hasUnreadReply).length ?? 0;
  const awaitingCount =
    entry.items?.filter(
      (i) => i.status === "available" && !i.userResponseText,
    ).length ?? 0;

  // Surface palette mirrors the dashboard tokens used elsewhere.
  const surface =
    entry.status === "completed"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : entry.status === "current"
        ? "border-white/40 bg-white/[0.10] text-white"
        : "border-white/[0.06] bg-white/[0.02] text-white/45";

  const selectedRing = isSelected
    ? "ring-1 ring-white/40 shadow-sm shadow-white/10"
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      aria-current={isSelected ? "step" : undefined}
      aria-label={`${index + 1} / ${total} — ${entry.label}`}
      className={[
        "group flex w-full min-w-[160px] items-start gap-2 rounded-xl border px-3 py-2.5 text-start transition lg:min-w-0",
        surface,
        selectedRing,
        isLocked
          ? "cursor-not-allowed"
          : "cursor-pointer hover:border-white/40 hover:bg-white/[0.08]",
      ].join(" ")}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] uppercase tracking-wider text-current/70">
          {entry.hint}
        </span>
        <span className="truncate text-sm font-semibold leading-tight">
          {entry.label}
        </span>
      </span>
      {/* Notification stack: unread clinician reply (violet) + the
          number of items still waiting for the user's response
          (amber). Subtle — small dots, not loud chips. */}
      <span className="ms-1 flex shrink-0 flex-col items-end gap-1">
        {unreadCount > 0 ? (
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-400/90 px-1 text-[9px] font-semibold leading-none text-slate-950"
            aria-label={`${unreadCount} new replies`}
            title={`${unreadCount} new replies`}
          >
            {unreadCount}
          </span>
        ) : null}
        {awaitingCount > 0 && unreadCount === 0 ? (
          <span
            className="inline-block size-1.5 rounded-full bg-amber-300/80"
            aria-label={`${awaitingCount} awaiting response`}
            title={`${awaitingCount} awaiting your response`}
          />
        ) : null}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Content panel
// ─────────────────────────────────────────────────────────────────────

function ContentPanel({
  isHe,
  pill,
  item,
  onSelectItem,
  Arrow,
}: {
  isHe: boolean;
  pill: RailEntry;
  item: PillItemRef | null;
  onSelectItem: (id: string) => void;
  Arrow: typeof ArrowLeft;
}) {
  // No items at all → show a calm "preparing" panel. This is the
  // default state for entitled users before the clinician schedules
  // any content for the category (DB-backed empty rail).
  if (!pill.items || pill.items.length === 0 || !item) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-slate-950/70 p-6 backdrop-blur-md sm:p-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Sparkles className="size-5 text-white/70" aria-hidden />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{pill.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            {isHe
              ? "המומחים שלנו עובדים על תוכן השלב הזה. הוא ייפתח כאן ברגע שיהיה מוכן."
              : "Our experts are preparing this step's content. It will open here when it's ready."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/70 backdrop-blur-md">
      {/* Hero — image, video, or a calm gradient placeholder */}
      <ItemHero item={item} isHe={isHe} />

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {/* Pill breadcrumb above the title — tells the user which
            step in the rail they're inside. */}
        <p className="text-[11px] uppercase tracking-wider text-white/45">
          {pill.label}
        </p>
        <h3 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
          {item.title}
        </h3>

        <ItemStatusLine item={item} isHe={isHe} />

        {item.body ? (
          <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-white/80">
            {item.body}
          </div>
        ) : (
          <p className="mt-4 text-sm italic text-white/45">
            {isHe
              ? "התוכן המלא ייפתח כאן ברגע שהשלב יהיה זמין."
              : "Full content will appear here once the step is available."}
          </p>
        )}

        {/* Open full view CTA — drills into /journey/timeline/[id]
            (or /journey/assessment for the synthetic entry). */}
        {item.status !== "locked" ? (
          <div className="mt-5">
            <Link
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
            >
              <span>
                {item.status === "assessment"
                  ? isHe ? "לפתוח את האבחון" : "Open the assessment"
                  : item.status === "completed"
                    ? isHe ? "לחזור לפריט" : "Re-open item"
                    : isHe ? "להתחיל את הפריט" : "Open item"}
              </span>
              <Arrow className="h-3.5 w-3.5 rotate-180" aria-hidden />
            </Link>
          </div>
        ) : null}

        {/* Sibling items in this pill — only when the pill has
            multiple items, otherwise the chip row is just noise. */}
        {pill.items.length > 1 ? (
          <SiblingItemsRow
            items={pill.items}
            selectedId={item.id}
            onSelect={onSelectItem}
            isHe={isHe}
          />
        ) : null}

        {/* Conversation thread — what the user wrote, what the
            clinician replied. The whole point of "real interaction":
            instead of a one-shot textarea, the user sees the dialogue
            inline. Only for real items, never the synthetic
            assessment entry. */}
        {item.status !== "assessment" ? (
          <ConversationThread item={item} isHe={isHe} />
        ) : null}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Conversation thread (Phase 5)
//
// The "real interaction" surface inside the desk panel. Three lanes:
//   1. The user's existing response (if any) — shown in a pale
//      bubble. Acknowledges "we got your message".
//   2. The clinician's reply (if any) — shown in a slightly more
//      prominent bubble with the "המומחה" label.
//   3. The ResponseBox — for available items, lets the user reply or
//      add a follow-up note. For completed items it's still there so
//      they can keep adding notes after the fact.
//
// Locked items render no thread — there's nothing to converse about
// yet.
// ─────────────────────────────────────────────────────────────────────

function ConversationThread({
  item,
  isHe,
}: {
  item: PillItemRef;
  isHe: boolean;
}) {
  if (item.status === "locked") return null;

  const hasUserResponse = !!item.userResponseText;
  const hasClinicianReply = !!item.clinicianReplyText;

  return (
    <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-5">
      {hasUserResponse || hasClinicianReply ? (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/55">
            {isHe ? "השיחה עד עכשיו" : "The conversation so far"}
          </p>

          {hasUserResponse ? (
            <article className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/85">
                  <MessageSquare className="size-3 text-white/55" aria-hidden />
                  {isHe ? "התשובה שלכם" : "Your response"}
                  {item.userResponsePrivate ? (
                    <span className="rounded-full border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/55">
                      {isHe ? "פרטי" : "Private"}
                    </span>
                  ) : null}
                </span>
                {item.userResponseAt ? (
                  <time
                    className="text-[10px] text-white/45"
                    dateTime={item.userResponseAt}
                    title={new Date(item.userResponseAt).toLocaleString()}
                  >
                    {formatRelativePast(item.userResponseAt, isHe)}
                  </time>
                ) : null}
              </header>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/85">
                {item.userResponseText}
              </p>
            </article>
          ) : null}

          {hasClinicianReply ? (
            <article className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3.5">
              <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-100">
                  <Sparkles className="size-3 text-violet-200" aria-hidden />
                  {isHe ? "תשובת המומחה" : "Clinician's reply"}
                  {item.clinicianStatus === "concerning" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-rose-100">
                      <AlertCircle className="size-2.5" aria-hidden />
                      {isHe ? "חשוב" : "Important"}
                    </span>
                  ) : null}
                  {item.hasUnreadReply ? (
                    <span className="rounded-full border border-violet-300/40 bg-violet-400/[0.15] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-50">
                      {isHe ? "חדש" : "New"}
                    </span>
                  ) : null}
                </span>
                {item.clinicianRepliedAt ? (
                  <time
                    className="text-[10px] text-violet-100/65"
                    dateTime={item.clinicianRepliedAt}
                    title={new Date(item.clinicianRepliedAt).toLocaleString()}
                  >
                    {formatRelativePast(item.clinicianRepliedAt, isHe)}
                  </time>
                ) : null}
              </header>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
                {item.clinicianReplyText}
              </p>
            </article>
          ) : null}
        </div>
      ) : null}

      {/* The reply form — available + completed items both keep it
          on. Locked items short-circuit at the top of this function. */}
      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-white/55">
          {hasUserResponse
            ? isHe ? "להוסיף לתשובה" : "Add to your response"
            : isHe ? "התגובה שלכם" : "Your response"}
        </p>
        <ResponseBox isHe={isHe} scheduledItemId={item.id} />
      </div>
    </div>
  );
}

function ItemHero({
  item,
  isHe,
}: {
  item: PillItemRef;
  isHe: boolean;
}) {
  // Real video URL → embed; image URL → render. Otherwise → calm
  // gradient placeholder with the item title and a soft icon.
  if (item.videoUrl) {
    return (
      <div className="relative aspect-video w-full bg-slate-900">
        <video
          src={item.videoUrl}
          controls
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={item.title}
        />
      </div>
    );
  }
  if (item.imageUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  // Placeholder — gradient with a corner icon. Calm, not loud.
  return (
    <div className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-800/60">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-2 text-white/55">
        {item.videoUrl === null && item.imageUrl === null ? (
          <ImageIcon className="size-7" aria-hidden />
        ) : (
          <PlayCircle className="size-7" aria-hidden />
        )}
        <span className="text-[11px] uppercase tracking-wider">
          {isHe ? "תצוגה מקדימה" : "Preview"}
        </span>
      </div>
    </div>
  );
}

function ItemStatusLine({
  item,
  isHe,
}: {
  item: PillItemRef;
  isHe: boolean;
}) {
  if (item.status === "completed" && item.completedAt) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[11px] text-emerald-100">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        {isHe ? "הושלם" : "Completed"} · {formatDate(item.completedAt, isHe)}
      </p>
    );
  }
  if (item.status === "available") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-white/85">
        <Sparkles className="h-3 w-3" aria-hidden />
        {isHe ? "פתוח לעבודה" : "Open"}
      </p>
    );
  }
  if (item.status === "locked" && item.unlockAt) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/55">
        <Clock className="h-3 w-3" aria-hidden />
        {isHe ? "ייפתח" : "Opens"} · {formatRelative(item.unlockAt, isHe)}
      </p>
    );
  }
  return null;
}

function SiblingItemsRow({
  items,
  selectedId,
  onSelect,
  isHe,
}: {
  items: PillItemRef[];
  selectedId: string;
  onSelect: (id: string) => void;
  isHe: boolean;
}) {
  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-white/55">
        {isHe ? "פריטים בשלב הזה" : "Items in this step"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => {
          const selected = it.id === selectedId;
          const palette =
            it.status === "completed"
              ? "border-emerald-400/30 text-emerald-100"
              : it.status === "available"
                ? "border-white/30 text-white"
                : "border-white/[0.08] text-white/45";
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect(it.id)}
                disabled={it.status === "locked"}
                className={[
                  "max-w-[18rem] truncate rounded-full border px-3 py-1 text-[12px] transition",
                  palette,
                  selected
                    ? "bg-white/[0.08] ring-1 ring-white/30"
                    : "bg-white/[0.02] hover:bg-white/[0.05]",
                  it.status === "locked"
                    ? "cursor-not-allowed"
                    : "cursor-pointer",
                ].join(" ")}
                title={it.title}
              >
                {it.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string, isHe: boolean): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleDateString(isHe ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatRelative(iso: string, isHe: boolean): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffDays = Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return isHe ? "בקרוב" : "soon";
  if (diffDays === 1) return isHe ? "מחר" : "tomorrow";
  if (diffDays <= 7) return isHe ? `בעוד ${diffDays} ימים` : `in ${diffDays} days`;
  return formatDate(iso, isHe);
}

function formatRelativePast(iso: string, isHe: boolean): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return isHe ? "עכשיו" : "now";
  if (m < 60) return isHe ? `לפני ${m} ד׳` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return isHe ? `לפני ${h} שעות` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return isHe ? `לפני ${d} ימים` : `${d}d ago`;
  return formatDate(iso, isHe);
}

// re-export for type-check coverage if anyone wants it
export type { PillItemStatus };
