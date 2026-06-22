"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * MVP stand-in for realtime: periodically re-fetches the server-rendered
 * console (feed + active thread) via router.refresh(). Persistent unread
 * (last_read_at) and true Supabase realtime subscriptions are deferred to
 * phase 2 — see the console plan. Pauses while the tab is hidden so we don't
 * poll in the background.
 */
export function ConsolePoller({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
