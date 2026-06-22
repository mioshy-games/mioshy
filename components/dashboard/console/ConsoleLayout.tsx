import type { ReactNode } from "react";
import { ConsolePoller } from "./ConsolePoller";

/**
 * Two-pane shell. Desktop: persistent feed (right, RTL) + active thread.
 * Mobile: shows the active thread when a conversation is selected, otherwise
 * the feed (one pane at a time). Each pane scrolls internally; the outer frame
 * is fixed-height so it reads like a chat console rather than a long document.
 */
export function ConsoleLayout({
  feed,
  active,
  hasSelection,
}: {
  feed: ReactNode;
  active: ReactNode;
  hasSelection: boolean;
}) {
  return (
    <div
      dir="rtl"
      className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0a0c] md:h-[calc(100dvh-5rem)]"
    >
      {/* Feed (left in LTR / right in RTL). */}
      <aside
        className={`w-full shrink-0 border-l border-white/10 md:w-80 lg:w-96 ${
          hasSelection ? "hidden md:block" : "block"
        }`}
      >
        {feed}
      </aside>

      {/* Active thread. */}
      <main
        className={`min-w-0 flex-1 ${hasSelection ? "block" : "hidden md:block"}`}
      >
        {active}
      </main>

      <ConsolePoller intervalMs={20000} />
    </div>
  );
}
