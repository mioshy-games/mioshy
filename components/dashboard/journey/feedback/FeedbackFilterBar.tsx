"use client";

/**
 * Filter bar for /dashboard/journey/feedback.
 *
 * Pure URL-driven — every change of a filter pushes a new URL via
 * router.replace. The page is a server component that reads from
 * the URL, so the round-trip is trivial. No client state to keep
 * in sync.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
// Import from feedback-shared (NOT feedback.ts) — feedback.ts pulls in
// next/headers via the server Supabase client, which would break this
// client component's build with a "components that need next/headers"
// error. feedback-shared has zero server deps.
import {
  FEEDBACK_SEVERITIES,
  SEVERITY_LABEL_HE,
  type FeedbackSeverity,
} from "@/lib/journey/feedback-shared";

interface CoupleOption {
  id: string;
  display_name: string | null;
  pair_code: string;
}
interface CategoryOption {
  id: string;
  // journey_categories uses name_he/name_en (NOT title — that's items).
  name_he: string | null;
  name_en: string | null;
}

export function FeedbackFilterBar({
  couples,
  categories,
  currentFilter,
  currentView,
  totalCount,
}: {
  couples: CoupleOption[];
  categories: CategoryOption[];
  currentFilter: {
    coupleId?: string;
    userId?: string;
    categoryId?: string;
    itemId?: string;
    severity?: FeedbackSeverity;
    q?: string;
  };
  currentView: "list" | "timeline";
  totalCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [qInput, setQInput] = useState(currentFilter.q ?? "");

  /** Build a new URL with the given param patches and navigate. */
  const patchUrl = (patches: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patches)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    // Reset page when changing any filter.
    if (Object.keys(patches).some((k) => k !== "view" && k !== "page")) {
      next.delete("page");
    }
    startTransition(() => {
      router.replace(`?${next.toString()}`);
    });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    patchUrl({ q: qInput.trim() || null });
  };

  const clearAll = () => {
    setQInput("");
    startTransition(() => {
      router.replace("?");
    });
  };

  const hasAnyFilter =
    !!currentFilter.coupleId ||
    !!currentFilter.userId ||
    !!currentFilter.categoryId ||
    !!currentFilter.itemId ||
    !!currentFilter.severity ||
    !!currentFilter.q;

  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Couple filter */}
        <select
          value={currentFilter.coupleId ?? ""}
          onChange={(e) => patchUrl({ coupleId: e.target.value || null })}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All couples</option>
          {couples.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name ?? `Couple ${c.pair_code}`}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={currentFilter.categoryId ?? ""}
          onChange={(e) => patchUrl({ categoryId: e.target.value || null })}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_he ?? c.name_en ?? c.id}
            </option>
          ))}
        </select>

        {/* Severity filter */}
        <select
          value={currentFilter.severity ?? ""}
          onChange={(e) => patchUrl({ severity: e.target.value || null })}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All severities</option>
          {FEEDBACK_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL_HE[s]}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div className="bg-muted ml-auto inline-flex rounded-md p-0.5 text-xs">
          <button
            type="button"
            onClick={() => patchUrl({ view: null })}
            className={`rounded px-3 py-1 ${
              currentView === "list" ? "bg-background shadow" : ""
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => patchUrl({ view: "timeline" })}
            className={`rounded px-3 py-1 ${
              currentView === "timeline" ? "bg-background shadow" : ""
            }`}
          >
            Timeline
          </button>
        </div>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1 text-sm"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search inside short summary or extended text…"
            className="bg-background h-9 w-full rounded-md border pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm"
        >
          Search
        </button>
      </form>

      <div className="text-muted-foreground text-xs">
        {totalCount.toLocaleString()} {totalCount === 1 ? "note" : "notes"}
        {hasAnyFilter ? " match the current filter." : " in total."}
      </div>
    </div>
  );
}
