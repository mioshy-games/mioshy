"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { useDwellTracking } from "@/hooks/useDwellTracking";

/**
 * AdultsPlayTracker — analytics-only island for the (server-rendered) adults
 * play surface (admin-analytics-spec §5.4, §6). Renders nothing.
 *
 * Closes the "zero engagement tracking" gap on the adults pillar: fires
 * `adult_game_opened` once on mount and runs per-game dwell tracking. Mounted
 * from app/[locale]/mioshy-sex/[slug]/play/page.tsx so that otherwise
 * server-only page gets instrumentation without a client refactor.
 *
 * Note: `adult_level_viewed` is intentionally NOT emitted — the per-level UI
 * was removed by Itzik (2026-06-09); these games are scenario-based, not
 * level-switching, so there is no level-view interaction to instrument.
 * (Pending product decision — see Phase 1 report.)
 *
 * Metadata only (privacy approach A): game id + slug, never content.
 */
export function AdultsPlayTracker({
  gameId,
  slug,
}: {
  gameId: string;
  slug: string;
}) {
  useDwellTracking("adults", gameId);

  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return; // once per mount (StrictMode-safe)
    firedRef.current = true;
    track("adult_game_opened", { game_id: gameId, slug });
  }, [gameId, slug]);

  return null;
}
