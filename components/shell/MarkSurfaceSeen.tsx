"use client";

/**
 * MarkSurfaceSeen — invisible client component that fires a
 * mark-as-seen server action once on mount.
 *
 * Drop it anywhere inside a (shell) page that should clear its nav
 * badge on view:
 *
 *   /my/expert   → <MarkSurfaceSeen surface="expert" />
 *   /my/lessons  → <MarkSurfaceSeen surface="lessons" />
 *
 * It uses a ref to guard against React 18 strict-mode double-invoke
 * during dev (two mounts → two writes is harmless but wastes a query).
 * The fire-and-forget pattern is intentional: we don't await on the
 * page render, the user sees the page immediately, and the badge
 * clears on next navigation via `revalidatePath` inside the action.
 *
 * No fallback UI — when JavaScript is disabled the badge simply stays
 * for the recency window (30 days for expert, 24 hours for lessons).
 * That's the correct degradation: nothing breaks.
 */

import { useEffect, useRef } from "react";

import {
  markExpertSurfaceSeen,
  markLessonsSurfaceSeen,
} from "@/app/actions/shell-mark-seen";

type Surface = "expert" | "lessons";

interface Props {
  surface: Surface;
}

export function MarkSurfaceSeen({ surface }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return; // strict-mode dev double-mount guard
    firedRef.current = true;

    // Fire-and-forget. Errors are intentionally swallowed — the user
    // doesn't care, and the next session will retry implicitly.
    const fn =
      surface === "expert"
        ? markExpertSurfaceSeen
        : markLessonsSurfaceSeen;
    fn().catch(() => {
      /* silent */
    });
  }, [surface]);

  return null;
}
