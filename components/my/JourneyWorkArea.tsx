"use client";

/**
 * JourneyWorkArea — three lightweight tabs at the bottom of /my that
 * show what the user has done, what's open right now, and what's
 * coming up. Day 3 of the redesign (docs/my-page-redesign-spec.md §0).
 *
 * MVP scope:
 *   - Pure client-side filter on data the page already fetched.
 *   - No new fetches, no DB schema changes.
 *   - Only the Journey pillar contributes data here. Games and
 *     Adults are intentionally excluded — they are "light, point-in-
 *     time" services and don't have a process the user can review.
 *   - When there's no data yet, each tab shows a calm caption — never
 *     an error state.
 *
 * Future phases will:
 *   - Add reactions ('ResponseBox') inline on each row.
 *   - Add admin/clinician surface that mirrors this view.
 *   - Wire the rail and the work area together so clicking a rail
 *     pill jumps to the right tab.
 */

import { useState } from "react";
import { Link } from "@/navigation";
import { CheckCircle2, Clock, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

export interface WorkAreaItem {
  /** Stable id — the journey_scheduled_items.id. */
  id: string;
  /** Item title for the user (already localized server-side). */
  title: string;
  /** Category label, optional but recommended. */
  category: string | null;
  /** "completed" / "available" / "locked" — derived on the server. */
  status: "completed" | "available" | "locked";
  /** Where to go on click. Locked items may pass null to disable. */
  href: string | null;
  /** Optional ISO timestamp. For completed → completion date. For
   * locked → unlock date. We render relative ("בעוד 3 ימים", etc.). */
  whenIso: string | null;
}

type TabKey = "active" | "done" | "upcoming";

export function JourneyWorkArea({
  isHe,
  items,
}: {
  isHe: boolean;
  items: WorkAreaItem[];
}) {
  const [tab, setTab] = useState<TabKey>("active");

  const done = items.filter((i) => i.status === "completed");
  const active = items.filter((i) => i.status === "available");
  const upcoming = items.filter((i) => i.status === "locked");

  const counts: Record<TabKey, number> = {
    active: active.length,
    done: done.length,
    upcoming: upcoming.length,
  };

  const visible =
    tab === "active" ? active : tab === "done" ? done : upcoming;

  return (
    <section
      className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-4 backdrop-blur-md sm:p-5"
      aria-label={isHe ? "אזור העבודה" : "Work area"}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "האזור האישי שלכם" : "Your work area"}
        </h2>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="mt-3 flex flex-wrap gap-2"
      >
        <TabButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          label={isHe ? "פעיל עכשיו" : "Active now"}
          count={counts.active}
        />
        <TabButton
          active={tab === "done"}
          onClick={() => setTab("done")}
          label={isHe ? "נעשה" : "Done"}
          count={counts.done}
        />
        <TabButton
          active={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          label={isHe ? "בדרך" : "Coming up"}
          count={counts.upcoming}
        />
      </div>

      {/* List */}
      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyHint tab={tab} isHe={isHe} />
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((item) => (
              <li key={item.id}>
                <RowItem item={item} isHe={isHe} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        "text-xs font-semibold transition",
        active
          ? "border-white/20 bg-white/[0.08] text-white"
          : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white/85",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5",
          "text-[10px] font-bold",
          active ? "bg-white/15 text-white" : "bg-white/5 text-white/55",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────

function RowItem({ item, isHe }: { item: WorkAreaItem; isHe: boolean }) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const Icon =
    item.status === "completed"
      ? CheckCircle2
      : item.status === "available"
        ? Sparkles
        : Clock;

  const accent =
    item.status === "completed"
      ? "text-emerald-300"
      : item.status === "available"
        ? "text-white"
        : "text-white/40";

  const whenLabel = formatWhen(item.whenIso, item.status, isHe);

  // Locked items render as a static row (no link).
  if (item.status === "locked" || !item.href) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5"
        aria-disabled="true"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Icon className={["h-4 w-4 shrink-0", accent].join(" ")} aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{item.title}</p>
            {item.category ? (
              <p className="truncate text-[11px] text-white/40">{item.category}</p>
            ) : null}
          </div>
        </div>
        {whenLabel ? (
          <span className="shrink-0 text-[11px] text-white/45">{whenLabel}</span>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={["h-4 w-4 shrink-0", accent].join(" ")} aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.title}</p>
          {item.category ? (
            <p className="truncate text-[11px] text-white/45">{item.category}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {whenLabel ? (
          <span className="text-[11px] text-white/45">{whenLabel}</span>
        ) : null}
        <Arrow className="h-3.5 w-3.5 text-white/55 transition group-hover:text-white" />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────

function EmptyHint({ tab, isHe }: { tab: TabKey; isHe: boolean }) {
  const text =
    tab === "active"
      ? isHe
        ? "כרגע אין כלום פתוח לצפייה. נעדכן אתכם כשהמומחים יעלו תוכן חדש."
        : "Nothing active right now. We'll update you when new content opens."
      : tab === "done"
        ? isHe
          ? "עוד לא השלמתם פריטים. הם יופיעו כאן ברגע שתסיימו אותם."
          : "No items completed yet. They'll appear here once you finish them."
        : isHe
          ? "אין תוכן בהמתנה. כשהצוות יוסיף את הפריטים הבאים, הם יופיעו כאן."
          : "Nothing queued. Upcoming items will show up here.";
  return (
    <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] p-4 text-center text-sm text-white/55">
      {text}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Time formatting — relative, never specific calendar dates per spec §4.
// ─────────────────────────────────────────────────────────────────────

function formatWhen(
  iso: string | null,
  status: WorkAreaItem["status"],
  isHe: boolean,
): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const now = Date.now();
  const diffMs = ts - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (status === "completed") {
    const ago = Math.max(0, -diffDays);
    if (ago === 0) return isHe ? "היום" : "Today";
    if (ago === 1) return isHe ? "אתמול" : "Yesterday";
    if (ago < 7) return isHe ? `לפני ${ago} ימים` : `${ago} days ago`;
    if (ago < 30) {
      const w = Math.floor(ago / 7);
      return isHe ? `לפני ${w} שבועות` : `${w} weeks ago`;
    }
    return isHe ? "לפני יותר מחודש" : "A while ago";
  }

  // available + locked → time until / generic hint
  if (status === "locked") {
    if (diffDays <= 0) return isHe ? "ייפתח בקרוב" : "Coming soon";
    if (diffDays === 1) return isHe ? "ייפתח מחר" : "Opens tomorrow";
    if (diffDays <= 7) return isHe ? `בעוד ${diffDays} ימים` : `In ${diffDays} days`;
    return isHe ? "ייפתח בהמשך" : "Coming up";
  }

  return null;
}
