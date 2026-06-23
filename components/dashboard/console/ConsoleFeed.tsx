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
  const awaiting = items.filter((i) => i.layer === "awaiting");
  const active = items.filter((i) => i.layer === "active");
  const noSub = items.filter((i) => i.layer === "no_sub");

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
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-white/45">
            אין שיחות.
          </p>
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
