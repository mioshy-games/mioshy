"use client";

/**
 * RailPillTracker — invisible wrapper that fires an analytics event
 * when the user clicks a clickable rail pill. Phase 4 (E).
 *
 * Pure pass-through; renders children inside a span with onClick.
 * Doesn't interfere with the underlying Link's navigation.
 */

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function RailPillTracker({
  children,
  entryKey,
  entryLabel,
  entryStatus,
}: {
  children: ReactNode;
  entryKey: string;
  entryLabel: string;
  entryStatus: string;
}) {
  return (
    <span
      onClick={() =>
        track("journey_rail_pill_clicked", {
          key: entryKey,
          label: entryLabel,
          status: entryStatus,
        })
      }
    >
      {children}
    </span>
  );
}
