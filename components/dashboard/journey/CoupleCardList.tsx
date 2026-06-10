"use client";

/**
 * components/dashboard/journey/CoupleCardList.tsx
 *
 * Mobile-first accordion list for the Journey "Couples" screen. Each row
 * collapses to the two critical fields — name + state — which stay visible
 * with no scroll. Tapping the row reveals progress, last activity, and the
 * one-tap actions. Tap targets are >=44px.
 *
 * The smart search bar accepts either a literal name or a Hebrew question.
 * "Ask AI" calls the aiSearchCouples server action, which returns a small
 * filter spec we apply here against the already-loaded rows. Any failure
 * falls back silently to a plain text match, so search never breaks.
 *
 * This component renders ONLY on mobile (the parent wraps it in md:hidden).
 * Desktop keeps its existing table-style list untouched.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  ChevronDown,
  Users,
  UserRound,
  Mail,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  aiSearchCouples,
  type CoupleFilterSpec,
  type CoupleState,
} from "@/app/dashboard/journey/clients/ai-search";

export interface CoupleListItem {
  ownerKey: string;
  kind: "user" | "couple";
  label: string;
  sublabel: string | null;
  active: number;
  cancelled: number;
  total_items: number;
  completed_items: number;
  last_activity: string | null;
}

function deriveState(s: CoupleListItem): CoupleState {
  if (s.active === 0 && s.cancelled > 0) return "paused";
  if (s.active === 0) return "no_content";
  if (s.total_items > 0 && s.completed_items >= s.total_items) return "complete";
  if (s.completed_items > 0) return "progressing";
  return "active";
}

const STATE_LABEL: Record<CoupleState, string> = {
  active: "פעיל",
  progressing: "בתהליך",
  complete: "הושלם",
  paused: "מושהה",
  no_content: "אין תוכן",
};

const STATE_CLASS: Record<CoupleState, string> = {
  active: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  progressing: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  complete: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  paused: "bg-muted text-muted-foreground",
  no_content: "bg-muted text-muted-foreground",
};

function pctOf(s: CoupleListItem): number {
  return s.total_items > 0
    ? Math.round((s.completed_items / s.total_items) * 100)
    : 0;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function fmtActivity(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d <= 0) return "היום";
  if (d === 1) return "אתמול";
  if (d < 30) return `לפני ${d} ימים`;
  return new Date(iso as string).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function applySpec(items: CoupleListItem[], spec: CoupleFilterSpec) {
  return items.filter((s) => {
    if (spec.kind && s.kind !== spec.kind) return false;
    if (spec.states && !spec.states.includes(deriveState(s))) return false;
    const pct = pctOf(s);
    if (spec.minCompletedPct !== undefined && pct < spec.minCompletedPct)
      return false;
    if (spec.maxCompletedPct !== undefined && pct > spec.maxCompletedPct)
      return false;
    const d = daysSince(s.last_activity);
    if (spec.activityWithinDays !== undefined) {
      if (d === null || d > spec.activityWithinDays) return false;
    }
    if (spec.staleForDays !== undefined) {
      if (d !== null && d < spec.staleForDays) return false;
    }
    if (spec.textIncludes) {
      const q = spec.textIncludes.toLowerCase();
      const hay = `${s.label} ${s.sublabel ?? ""} ${s.ownerKey}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function textFilter(items: CoupleListItem[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((s) =>
    `${s.label} ${s.sublabel ?? ""} ${s.ownerKey}`
      .toLowerCase()
      .includes(needle),
  );
}

export function CoupleCardList({ items }: { items: CoupleListItem[] }) {
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState<CoupleFilterSpec | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    if (spec) return applySpec(items, spec);
    return textFilter(items, query);
  }, [items, query, spec]);

  function runText() {
    setSpec(null);
  }

  function runAi() {
    const q = query.trim();
    if (q.length < 2) return;
    startTransition(async () => {
      const result = await aiSearchCouples(q);
      if (result && Object.keys(result).length > 0) {
        setSpec(result);
      } else {
        setSpec(null);
        toast.message("חיפוש רגיל", {
          description: "לא הצלחתי לפרש את השאלה, מציג התאמות טקסט.",
        });
      }
    });
  }

  function clearAi() {
    setSpec(null);
  }

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Smart search — one visible field, with the search + AI icons INSIDE
          it. Typing then Enter does a literal text match; tapping the AI
          button sends the text to aiSearchCouples for a Hebrew question. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runText();
        }}
        className="border-input bg-background focus-within:ring-ring flex h-12 items-center gap-2 rounded-xl border ps-3 pe-1.5 focus-within:ring-2"
      >
        <Search className="text-muted-foreground pointer-events-none size-5 shrink-0" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (spec) setSpec(null);
          }}
          placeholder="חפש או שאל שאלה..."
          aria-label="חפש או שאל שאלה"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
        />
        <button
          type="button"
          onClick={runAi}
          disabled={pending || query.trim().length < 2}
          aria-label="שאל AI"
          title="שאל שאלה ב-AI"
          className="bg-primary text-primary-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </button>
      </form>

      {/* Active AI filter chip */}
      {spec ? (
        <button
          type="button"
          onClick={clearAi}
          className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        >
          <Sparkles className="size-3.5" />
          סינון AI פעיל · {visible.length} תוצאות
          <X className="size-3.5" />
        </button>
      ) : null}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border p-8 text-center text-sm">
          לא נמצאו תוצאות.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((s) => {
            const st = deriveState(s);
            const pct = pctOf(s);
            const isOpen = open.has(s.ownerKey);
            const Icon = s.kind === "couple" ? Users : UserRound;
            // Name is the load-bearing field: never let a row render
            // without one. Fall back to pair-code, then a typed placeholder.
            const name =
              s.label?.trim() ||
              s.sublabel?.trim() ||
              (s.kind === "couple" ? "זוג ללא שם" : "ללא שם");
            return (
              <li
                key={s.ownerKey}
                className="border-border bg-card rounded-xl border"
              >
                <button
                  type="button"
                  onClick={() => toggle(s.ownerKey)}
                  aria-expanded={isOpen}
                  className="flex min-h-[60px] w-full items-center gap-3 p-3 text-start"
                >
                  <span className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full border">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold leading-tight">
                      {name}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATE_CLASS[st],
                      )}
                    >
                      {STATE_LABEL[st]}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground size-5 shrink-0 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen ? (
                  <div className="border-border space-y-3 border-t p-3">
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">התקדמות</dt>
                        <dd className="font-medium">
                          {s.completed_items}/{s.total_items} · {pct}%
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">פעילות אחרונה</dt>
                        <dd className="font-medium">
                          {fmtActivity(s.last_activity)}
                        </dd>
                      </div>
                      {s.sublabel ? (
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">קוד צימוד</dt>
                          <dd className="font-mono text-xs">{s.sublabel}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/journey/clients/${s.ownerKey}`}
                        className="bg-primary text-primary-foreground flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium"
                      >
                        <Eye className="size-4" />
                        כרטיס הזוג
                      </Link>
                      <Link
                        href={`/dashboard/journey/clients/${s.ownerKey}#email`}
                        className="border-border flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium"
                      >
                        <Mail className="size-4" />
                        אימייל
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
