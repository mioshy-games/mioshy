"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CMS_PAGES, type CmsPage, type CmsTextRow } from "@/lib/cms/types";
import { CmsTextRow as CmsTextRowEditor } from "./CmsTextRow";

const PAGE_LABELS: Record<CmsPage, string> = {
  homepage: "Homepage",
  journey: "Journey",
  games: "Games",
  "mioshy-sex": "Mioshy Sex",
  my: "My / Account",
  about: "About",
  shared: "Shared",
  // 2026-05-29 — post-login AppShell strings (migrations 098 + 100).
  // 69 + 13 = 82 keys live under page='app-shell'.
  "app-shell": "App Shell (post-login)",
};

// Sprint 4 #3 Phase 2 (A–D) shipped — every public route is now
// migrated to <CmsText>/useCmsText/getCmsTranslations, so every tab
// has rows worth editing. The `shared` bucket houses cross-route
// keys (nav, footer, legal, auth, paywall, pricing) and is also
// active. `about` (Sprint 6) wraps the founder story. If a new tab
// ever needs to be gated in the future, drop it from this set.
const ENABLED_PAGES = new Set<CmsPage>([
  "homepage",
  "journey",
  "games",
  "mioshy-sex",
  "my",
  "about",
  "shared",
  "app-shell",
]);

/**
 * CmsContentEditor — top-level admin UI for editing CMS texts.
 *
 * Rendering pipeline:
 *   1. Server (app/admin/content/page.tsx) loaded EVERY row from
 *      cms_texts in a single query and handed them to this component.
 *   2. Here we filter to the active page tab, then group by `section`.
 *   3. Each section renders as a <details> accordion. First section
 *      open by default so the page lands with content visible.
 *   4. Each key gets a CmsTextRow (HE + EN textareas + Save button).
 *
 * State is local — there's no client-side cache or store. Each Save
 * goes straight to the server action, which UPDATEs the DB and calls
 * revalidateTag('cms-texts'). The public site picks up the change on
 * its next render.
 */
export function CmsContentEditor({ rows }: { rows: CmsTextRow[] }) {
  const [page, setPage] = useState<CmsPage>("homepage");

  /**
   * jumpTo — search result click handler. Switches the page tab, then
   * defers a DOM-imperative pass to expand the matching <details>
   * accordion and scroll the row into view with a brief highlight
   * pulse. We go DOM-side here instead of threading a `focusedKey`
   * prop down through Tabs → SectionGroup → CmsTextRow:
   *   1. The tab switch + section open need to land BEFORE the scroll,
   *      and React doesn't expose "after this state has rendered AND
   *      child useEffects have run" as a primitive. A double-rAF
   *      reliably places us after the layout commit.
   *   2. The `data-cms-section` + `data-cms-key` attributes used to
   *      look the nodes up are stable across re-renders, so they
   *      survive the tab switch (which unmounts the prior page's
   *      sections — we re-find the new tree's nodes after rAF).
   *   3. Keeping the open state of <details> uncontrolled lets the
   *      admin freely collapse / expand sections without the search
   *      flow having to re-assert its own opinion of which are open.
   */
  function jumpTo(row: CmsTextRow) {
    setPage(row.page as CmsPage);
    // Two rAFs: first lets React flush the setPage re-render, second
    // lets the new tab's sections lay out. After both, the
    // `[data-cms-section]` and `[data-cms-key]` nodes exist.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const detailsEl = document.querySelector<HTMLDetailsElement>(
          `[data-cms-section="${cssEscape(row.section)}"]`,
        );
        if (detailsEl && !detailsEl.open) {
          detailsEl.open = true;
        }
        const rowEl = document.querySelector<HTMLElement>(
          `[data-cms-key="${cssEscape(row.key)}"]`,
        );
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
          // Pulse a soft blue ring for 2s so the admin's eye lands on
          // the right row even after the smooth-scroll settles. Pure
          // utility classes — no extra CSS to ship.
          rowEl.classList.add(
            "ring-2",
            "ring-blue-400",
            "ring-offset-2",
            "shadow-lg",
          );
          window.setTimeout(() => {
            rowEl.classList.remove(
              "ring-2",
              "ring-blue-400",
              "ring-offset-2",
              "shadow-lg",
            );
          }, 2000);
        }
      });
    });
  }

  // Per-tab key counts — shown inline on every tab pill so admins can
  // see at a glance how much content lives under each bucket without
  // having to click through. Memoised on `rows` alone (page change
  // doesn't shift the totals). Falls back to 0 for pages with no
  // rows yet (e.g. a freshly-added bucket pre-seed).
  const keysByPage = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.page, (map.get(row.page) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  // Per-page filtering + section grouping. Memoised on `rows` + `page`
  // so the only re-computation cost is when the admin switches tabs.
  const sections = useMemo(() => {
    const pageRows = rows.filter((r) => r.page === page);
    const grouped = new Map<string, CmsTextRow[]>();
    for (const row of pageRows) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    // Sort sections by name for stable presentation. Inside each
    // section, sort by key (so e.g. `homeV2.hero.tag` sits before
    // `homeV2.hero.headline` alphabetically — admin can scan).
    return Array.from(grouped.entries())
      .map(([name, list]) => ({
        name,
        rows: list.sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, page]);

  const totalKeys = rows.filter((r) => r.page === page).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link to admin dashboard. Uses next/link so client-side
          nav (no full page reload) and the dashboard's locale/auth
          state is preserved across the bounce. */}
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        חזרה ללוח אדמין
      </Link>

      {/* Header */}
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold">
          Mioshy CMS — Content Editor
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit user-facing copy on the live site. Every save publishes
          immediately — the public site reflects the change on the
          next request (cache invalidates automatically).
        </p>
      </header>

      {/* Global search — sticky so it follows the admin down through
          long sections. Matches against key path, HE text, and EN text;
          click any result to switch tabs, expand the right section,
          and scroll-with-pulse to the row. */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 bg-slate-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70">
        <SearchBar rows={rows} onJump={jumpTo} />
      </div>

      {/* Page tabs */}
      <Tabs
        value={page}
        onValueChange={(v) => setPage(v as CmsPage)}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-6">
          {CMS_PAGES.map((p) => {
            const enabled = ENABLED_PAGES.has(p);
            const count = keysByPage.get(p) ?? 0;
            return (
              <TabsTrigger
                key={p}
                value={p}
                disabled={!enabled}
                title={
                  enabled
                    ? `${count} keys`
                    : "Coming soon — components for this page haven't been migrated to the CMS yet."
                }
              >
                {PAGE_LABELS[p]}
                {enabled ? (
                  <span className="ms-1 font-mono text-[10px] opacity-60 tabular-nums">
                    ({count})
                  </span>
                ) : (
                  <span className="ms-1 text-[10px] opacity-60">soon</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Per-page summary */}
      <div className="mb-6 flex items-center gap-3 text-sm text-slate-600">
        <Badge variant="secondary">{totalKeys} keys</Badge>
        <span>·</span>
        <span>{sections.length} sections</span>
      </div>

      {/* Sections accordion */}
      <div className="space-y-3">
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No CMS rows for {PAGE_LABELS[page]} yet.
          </div>
        ) : (
          sections.map((section, i) => (
            <SectionGroup
              key={section.name}
              name={section.name}
              rows={section.rows}
              defaultOpen={i === 0}
            />
          ))
        )}
      </div>
    </main>
  );
}

/**
 * SectionGroup — collapsible card for one section under the current
 * page tab. Uses native <details>/<summary> for the accordion behaviour
 * — no client state, no JS framework needed for the toggle. shadcn's
 * Card primitives style the container.
 */
function SectionGroup({
  name,
  rows,
  defaultOpen,
}: {
  name: string;
  rows: CmsTextRow[];
  defaultOpen: boolean;
}) {
  return (
    <details
      // `data-cms-section` is the anchor jumpTo() uses to expand the
      // right accordion when an admin clicks a search result that
      // lives inside this section.
      data-cms-section={name}
      className="group rounded-xl border border-slate-200 bg-white shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500 transition group-open:rotate-90">
            ▸
          </span>
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {rows.length}
          </Badge>
        </div>
      </summary>
      <Separator />
      <div className="space-y-4 p-5">
        {rows.map((row) => (
          <CmsTextRowEditor key={row.id} row={row} />
        ))}
      </div>
    </details>
  );
}

// ── Global search ───────────────────────────────────────────────────
//
// Admin pain point (2026-05-14, Itzik): /games has ~30 sections and
// keys scatter across them — once content's been migrated, "find me
// gamesHub.h1" devolves into eyeballing every accordion. This bar
// puts a single Ctrl+F-style entry point at the top of the editor
// that matches across key path + HE text + EN text on every page at
// once. Clicking a result fires jumpTo() in the parent — which
// switches tabs, expands the right section, and scroll-pulses the row.
//
// MVP scope (per the spec):
//   ✓ global (all pages)
//   ✓ 3 fields: key + he_text + en_text
//   ✓ debounced 300ms
//   ✓ results display key + page + section + text previews
//   ✓ click → jumps to edit
//   ✓ Hebrew case-insensitive (Unicode normalises both sides to NFC;
//     Hebrew has no case mapping so the lowercase pass is a no-op on
//     HE chars and folds Latin EN to lowercase as usual)
//
// Out of MVP (deliberate): advanced filters, search history, saved
// searches, boolean operators, fuzzy/regex modes.

const MAX_RESULTS = 50;

function SearchBar({
  rows,
  onJump,
}: {
  rows: CmsTextRow[];
  onJump: (row: CmsTextRow) => void;
}) {
  // What the admin sees in the input (immediate) vs. what the filter
  // pass uses (debounced). Splitting the two keeps typing responsive
  // even when the row set scales — 830 rows × 3 fields per keystroke
  // would noticeably stutter otherwise.
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Whether the results panel is rendered. Mirrors `query` length but
  // also closes when the admin presses Escape or clicks a result so
  // they get back to the editor without further interaction.
  const [open, setOpen] = useState(false);

  // 300ms debounce — long enough to skip per-keystroke recomputes, short
  // enough that "type, look up" feels instant. Cleared on input change
  // so the timer resets while the admin is still typing.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(input);
      setOpen(input.trim().length > 0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [input]);

  // Filter pass. Substring match across the 3 fields; we NFC-normalise
  // both sides so HE composed/decomposed forms (rare but possible after
  // copy-paste from older sources) collapse to the same match. Walks
  // every row to compute the uncapped total, but the rendered slice is
  // bounded by MAX_RESULTS so the dropdown stays scannable.
  const { results, totalMatches } = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return { results: [] as CmsTextRow[], totalMatches: 0 };
    const needle = trimmed.normalize("NFC").toLowerCase();
    const matches: CmsTextRow[] = [];
    for (const row of rows) {
      const key = row.key.toLowerCase();
      const he = (row.he_text ?? "").normalize("NFC").toLowerCase();
      const en = (row.en_text ?? "").normalize("NFC").toLowerCase();
      if (
        key.includes(needle) ||
        he.includes(needle) ||
        en.includes(needle)
      ) {
        matches.push(row);
      }
    }
    // Sort with key-hits first (most specific), then by key alphabetical
    // inside each bucket so the same query produces a stable ordering.
    matches.sort((a, b) => {
      const aKey = a.key.toLowerCase().includes(needle) ? 0 : 1;
      const bKey = b.key.toLowerCase().includes(needle) ? 0 : 1;
      if (aKey !== bKey) return aKey - bKey;
      return a.key.localeCompare(b.key);
    });
    return {
      results: matches.slice(0, MAX_RESULTS),
      totalMatches: matches.length,
    };
  }, [query, rows]);

  // Esc to close + clear; / to focus (vim-style power-user shortcut).
  // Bound at the document level so the admin doesn't need to click
  // the input first.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        setInput("");
        setQuery("");
        inputRef.current?.blur();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleClear() {
    setInput("");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleResultClick(row: CmsTextRow) {
    onJump(row);
    // Close the dropdown immediately so the row the admin jumped to
    // isn't visually obscured by the panel.
    setOpen(false);
    setInput("");
    setQuery("");
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            if (query.trim().length > 0) setOpen(true);
          }}
          placeholder='Search all CMS texts — key, Hebrew, or English. Press "/" anywhere to focus.'
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 ps-10 pe-10 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {input ? (
          <button
            type="button"
            onClick={handleClear}
            title="Clear (Esc)"
            className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          // Absolute-positioned dropdown so it overlays the tabs +
          // accordions below instead of pushing them down on every
          // keystroke. max-height + overflow keeps long result sets
          // contained without growing the page.
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            <span>
              {totalMatches === 0
                ? "No matches"
                : totalMatches === 1
                  ? "1 match"
                  : `${totalMatches} matches${
                      totalMatches > MAX_RESULTS
                        ? ` (showing first ${MAX_RESULTS} — refine your query)`
                        : ""
                    }`}
            </span>
            <span className="text-slate-400">Esc to close · click to jump</span>
          </div>
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No CMS row matches{" "}
              <code className="font-mono text-xs text-slate-700">
                {query.trim()}
              </code>
              .
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((row) => (
                <SearchResultRow
                  key={row.id}
                  row={row}
                  query={query.trim()}
                  onClick={() => handleResultClick(row)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One row inside the search results dropdown. Three lines:
 *   1. key path + page + section badges
 *   2. HE preview (RTL, blue chip)
 *   3. EN preview (LTR, slate chip)
 *
 * The previews are clipped to a single line each so even hits on long
 * paragraph values don't blow out the dropdown's vertical budget.
 */
function SearchResultRow({
  row,
  query,
  onClick,
}: {
  row: CmsTextRow;
  query: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="block w-full px-4 py-3 text-start transition hover:bg-blue-50"
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs font-semibold text-slate-800">
            {highlight(row.key, query)}
          </code>
          <Badge variant="secondary" className="text-[10px]">
            {row.page}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.section}
          </Badge>
        </div>
        {row.he_text ? (
          <p
            dir="rtl"
            lang="he"
            className="mt-1.5 line-clamp-1 text-xs text-slate-700"
          >
            <span className="me-1.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-700">
              HE
            </span>
            {highlight(row.he_text, query)}
          </p>
        ) : null}
        {row.en_text ? (
          <p
            dir="ltr"
            lang="en"
            className="mt-1 line-clamp-1 text-xs text-slate-700"
          >
            <span className="me-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
              EN
            </span>
            {highlight(row.en_text, query)}
          </p>
        ) : null}
      </button>
    </li>
  );
}

/**
 * Wraps the substring of `text` that matches `query` in a <mark>
 * element so admins can see *why* a result hit. Falls back to the
 * plain string when the match doesn't exist in this particular field
 * (e.g. a hit on `key` but the HE text doesn't include the needle).
 */
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const haystack = text.normalize("NFC");
  const needle = query.normalize("NFC").toLowerCase();
  const idx = haystack.toLowerCase().indexOf(needle);
  if (idx === -1) return text;
  return (
    <>
      {haystack.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5 text-slate-900">
        {haystack.slice(idx, idx + needle.length)}
      </mark>
      {haystack.slice(idx + needle.length)}
    </>
  );
}

/**
 * cssEscape — defensive wrapper around the optional native helper.
 * Section names like `homeV2.hero` and CMS keys like
 * `gamesHub.byTheNumbers.heading` contain dots; the dot in particular
 * MUST be escaped before it lands in a CSS attribute selector or
 * `document.querySelector` parses it as a class operator and finds
 * nothing. CSS.escape is available in every browser we care about,
 * but we still feature-detect (some test/JSDOM environments lack it)
 * and fall back to a tight manual pass that covers the punctuation
 * we actually emit in CMS keys / section names.
 */
function cssEscape(value: string): string {
  if (
    typeof window !== "undefined" &&
    typeof window.CSS?.escape === "function"
  ) {
    return window.CSS.escape(value);
  }
  return value.replace(/["'\\#.:\s\[\]()]/g, "\\$&");
}
