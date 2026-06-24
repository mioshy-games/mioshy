"use client";

import { useMemo, useState } from "react";
import type { ConsoleFeedItem } from "@/lib/journey/console-feed";
import { ConsoleFeedRow } from "./ConsoleFeedRow";

/**
 * Left pane: the persistent conversation list, in three bands so a
 * conversation is never lost after a reply:
 *   • awaiting — needs a reply now (top)
 *   • active   — subscribers already answered (kept)
 *   • no_sub   — non-subscriber users, always kept, in a collapsible band
 *
 * A new message on a no_sub user moves it to "awaiting" (top) automatically,
 * because buildConsoleFeed recomputes the band from needsReplyCount.
 *
 * A search box filters by name / phone / email (item.searchText, computed
 * server-side). While searching we drop the bands and render one flat list so a
 * match in the collapsed no-sub band still surfaces — this is how a coach finds
 * someone like שולי who has already been replied to.
 */
export function ConsoleFeed({
  items,
  selectedCouple,
  selectedUser,
}: {
  items: ConsoleFeedItem[];
  selectedCouple: string | null;
  selectedUser: string | null;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return items;
    // Match each whitespace-separated token (so "שולי 052" works); digits in the
    // query also match the phone with separators stripped.
    const tokens = q.split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, "");
    return items.filter((i) => {
      const hay = i.searchText;
      const hayDigits = hay.replace(/\D/g, "");
      const tokensOk = tokens.every((t) => hay.includes(t));
      const phoneOk = digits.length >= 3 && hayDigits.includes(digits);
      return tokensOk || phoneOk;
    });
  }, [items, q]);

  const awaiting = filtered.filter((i) => i.layer === "awaiting");
  const active = filtered.filter((i) => i.layer === "active");
  const noSub = filtered.filter((i) => i.layer === "no_sub");

  const isSelected = (item: ConsoleFeedItem) =>
    item.kind === "couple"
      ? item.coupleId === selectedCouple
      : item.userId === selectedUser;

  const row = (item: ConsoleFeedItem) => (
    <ConsoleFeedRow key={item.key} item={item} selected={isSelected(item)} />
  );

  return (
    <div dir="rtl" className="flex h-full flex-col">
      <header className="shrink-0 border-b border-white/10 px-3 py-3">
        <h1 className="text-sm font-semibold text-white">שיחות</h1>
        <p className="mt-0.5 text-[11px] text-white/45">
          {awaiting.length} ממתינות · {active.length} פעילות · {noSub.length} ללא מנוי
        </p>
        <div className="relative mt-2">
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם / טלפון / מייל"
            aria-label="חיפוש שיחות"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="נקה חיפוש"
              className="absolute inset-y-0 left-2 my-auto text-white/40 hover:text-white/70"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-white/45">
            {q ? "אין תוצאות לחיפוש." : "אין שיחות."}
          </p>
        ) : q ? (
          // Searching → flat list, so matches in any band always show.
          <section>
            <BandHeader label="תוצאות חיפוש" count={filtered.length} />
            {filtered.map(row)}
          </section>
        ) : (
          <>
            {awaiting.length > 0 ? (
              <section>
                <BandHeader label="ממתינים לתגובה" count={awaiting.length} />
                {awaiting.map(row)}
              </section>
            ) : null}

            {active.length > 0 ? (
              <section>
                <BandHeader label="מנויים פעילים" count={active.length} />
                {active.map(row)}
              </section>
            ) : null}

            {noSub.length > 0 ? (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/60">
                  <span>משתמשים ללא מנוי · {noSub.length}</span>
                  <span className="transition group-open:rotate-90">‹</span>
                </summary>
                {noSub.map(row)}
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function BandHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 bg-[#0d0a0c]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/40 backdrop-blur">
      {label} · {count}
    </div>
  );
}
