import type { ConsoleFeedItem } from "@/lib/journey/console-feed";
import { ConsoleFeedRow } from "./ConsoleFeedRow";

export function ConsoleFeed({
  items,
  selectedCouple,
  selectedUser,
}: {
  items: ConsoleFeedItem[];
  selectedCouple: string | null;
  selectedUser: string | null;
}) {
  return (
    <div dir="rtl" className="flex h-full flex-col">
      <header className="shrink-0 border-b border-white/10 px-3 py-3">
        <h1 className="text-sm font-semibold text-white">שיחות</h1>
        <p className="mt-0.5 text-[11px] text-white/45">
          {items.length} שיחות · ממוין לפי דחיפות
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-white/45">
            אין שיחות פעילות.
          </p>
        ) : (
          items.map((item) => (
            <ConsoleFeedRow
              key={item.key}
              item={item}
              selected={
                item.kind === "couple"
                  ? item.coupleId === selectedCouple
                  : item.userId === selectedUser
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
