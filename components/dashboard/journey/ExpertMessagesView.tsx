"use client";

/**
 * ExpertMessagesView — client component for /dashboard/journey/expert-messages.
 *
 * Renders the filter bar + the merged expert-message feed. Filters
 * are URL-driven via router.replace so the server component re-runs
 * with new params and we get fresh data without client-side fetching.
 *
 * Each row shows:
 *   - Coach name (or "(לא משויך)" for legacy)
 *   - Couple label (partner names) or "(ערוץ אישי)"
 *   - Surface badge (per-item / channel / couple)
 *   - Topic-tag chips (or "untagged")
 *   - Body preview (clamp 2 lines, click to expand)
 *   - Created-at timestamp
 *   - Drill-in link to the relevant client workspace
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";

import type { AdminExpertMessageRow } from "@/lib/journey/admin-messages";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

interface CoachOption {
  expertId: string;
  name_he:  string;
}

interface CurrentFilters {
  expertId:     string | null;
  coupleId:     string | null;
  tag:          string | null;
  untaggedOnly: boolean;
  fromDate:     string | null;
  toDate:       string | null;
}

// Surface labels are looked up from the i18n table at render time so they
// flip with the locale toggle.

const SURFACE_VARIANT: Record<
  AdminExpertMessageRow["surface"],
  "default" | "secondary" | "outline"
> = {
  per_item: "default",
  channel:  "secondary",
  couple:   "outline",
};

export function ExpertMessagesView({
  messages,
  coaches,
  tags,
  currentFilters,
  locale = "en",
}: {
  messages:        AdminExpertMessageRow[];
  coaches:         CoachOption[];
  tags:            string[];
  currentFilters:  CurrentFilters;
  locale?:         AdminLocale;
}) {
  const SURFACE_LABEL: Record<AdminExpertMessageRow["surface"], string> = {
    per_item: t(locale, "journey.em.surface_per_item"),
    channel:  t(locale, "journey.em.surface_channel"),
    couple:   t(locale, "journey.em.surface_couple"),
  };
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const patchUrl = (
    patches: Record<string, string | null | undefined>,
  ) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patches)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.replace(`?${next.toString()}`);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.replace("?");
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasAnyFilter =
    !!currentFilters.expertId ||
    !!currentFilters.coupleId ||
    !!currentFilters.tag ||
    !!currentFilters.fromDate ||
    !!currentFilters.toDate ||
    currentFilters.untaggedOnly;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <select
          value={currentFilters.expertId ?? ""}
          onChange={(e) => patchUrl({ expert: e.target.value || null })}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t(locale, "journey.em.filter_all_coaches")}</option>
          {coaches.map((c) => (
            <option key={c.expertId} value={c.expertId}>
              {c.name_he}
            </option>
          ))}
        </select>

        <select
          value={
            currentFilters.untaggedOnly
              ? "__untagged__"
              : currentFilters.tag ?? ""
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__untagged__") {
              patchUrl({ untagged: "1", tag: null });
            } else {
              patchUrl({ untagged: null, tag: v || null });
            }
          }}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t(locale, "journey.em.filter_all_tags")}</option>
          <option value="__untagged__">{t(locale, "journey.em.filter_untagged")}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        <label className="text-muted-foreground text-xs">
          {t(locale, "journey.em.filter_from")}
          <input
            type="date"
            value={currentFilters.fromDate ?? ""}
            onChange={(e) => patchUrl({ from: e.target.value || null })}
            className="bg-background ms-1 h-9 rounded-md border px-2 text-sm"
          />
        </label>

        <label className="text-muted-foreground text-xs">
          {t(locale, "journey.em.filter_to")}
          <input
            type="date"
            value={currentFilters.toDate ?? ""}
            onChange={(e) => patchUrl({ to: e.target.value || null })}
            className="bg-background ms-1 h-9 rounded-md border px-2 text-sm"
          />
        </label>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground ms-auto inline-flex h-9 items-center gap-1 text-sm"
          >
            <X className="size-3.5" />
            {t(locale, "journey.em.filter_clear")}
          </button>
        )}
      </div>

      {/* Couple-id filter chip when set (no dropdown — lookups are
          better triggered via the drill-in link from a row). */}
      {currentFilters.coupleId && (
        <div className="bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground">Filtered by couple:</span>
          <code className="font-mono">{currentFilters.coupleId}</code>
          <button
            type="button"
            onClick={() => patchUrl({ couple: null })}
            className="text-muted-foreground hover:text-foreground ms-auto"
            aria-label="Clear couple filter"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Messages list */}
      <div className="bg-card overflow-hidden rounded-lg border">
        {messages.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            {t(locale, "journey.em.no_results")}
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-primary ms-2 underline"
              >
                {t(locale, "journey.em.filter_clear")}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {messages.map((m) => {
              const isExpanded = expanded.has(m.id);
              const showFull = isExpanded || m.body.length <= 200;
              const preview = showFull
                ? m.body
                : `${m.body.slice(0, 200)}…`;
              const canExpand = m.body.length > 200;
              const created = new Date(m.created_at);

              return (
                <li key={m.id} className="p-4">
                  {/* Top row: coach + couple + date + drill-in */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-sm">
                      {m.expert_name_he}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (m.couple_id) {
                          patchUrl({ couple: m.couple_id });
                        }
                      }}
                      className={
                        m.couple_id
                          ? "hover:text-foreground text-muted-foreground hover:underline"
                          : "text-muted-foreground"
                      }
                      disabled={!m.couple_id}
                    >
                      {m.couple_label}
                    </button>
                    <Badge
                      variant={SURFACE_VARIANT[m.surface]}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {SURFACE_LABEL[m.surface]}
                    </Badge>
                    <span className="text-muted-foreground ms-auto tabular-nums">
                      {created.toLocaleDateString("he-IL", {
                        year:  "numeric",
                        month: "2-digit",
                        day:   "2-digit",
                      })}{" "}
                      {created.toLocaleTimeString("he-IL", {
                        hour:   "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Link
                      href={m.drill_href}
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {t(locale, "btn.open")}
                    </Link>
                  </div>

                  {/* Tags */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.topic_tags.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => patchUrl({ untagged: "1", tag: null })}
                        className="text-muted-foreground hover:text-foreground inline-block rounded border border-dashed px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {t(locale, "journey.em.untagged")}
                      </button>
                    ) : (
                      m.topic_tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            patchUrl({ tag: t, untagged: null })
                          }
                          className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono text-[10px]"
                        >
                          {t}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Body */}
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {preview}
                  </div>
                  {canExpand && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(m.id)}
                      className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3" />
                          {t(locale, "journey.em.hide")}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3" />
                          {t(locale, "journey.em.read_more")}
                        </>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
