"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Context for expand-all / collapse-all from a parent container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mount a <SectionGroupContext.Provider value={...}> around a group of
 * SettingsSection components to drive "Expand All" / "Collapse All" from
 * outside. Increment forceOpenVersion to open everything, or
 * forceCloseVersion to close everything. Sections return to individual
 * control immediately after responding to the signal.
 */
export const SectionGroupContext = createContext<{
  forceOpenVersion: number;
  forceCloseVersion: number;
}>({ forceOpenVersion: 0, forceCloseVersion: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  title: string;
  /** Optional colored dot next to the title */
  dotClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function SettingsSection({
  title,
  dotClassName,
  defaultOpen = true,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const { forceOpenVersion, forceCloseVersion } = useContext(SectionGroupContext);

  // Track the last version we already reacted to so we don't re-fire
  // on a re-render that didn't change the version.
  const lastOpenVersion = useRef(forceOpenVersion);
  const lastCloseVersion = useRef(forceCloseVersion);

  useEffect(() => {
    if (forceOpenVersion > 0 && forceOpenVersion !== lastOpenVersion.current) {
      lastOpenVersion.current = forceOpenVersion;
      setOpen(true);
    }
  }, [forceOpenVersion]);

  useEffect(() => {
    if (forceCloseVersion > 0 && forceCloseVersion !== lastCloseVersion.current) {
      lastCloseVersion.current = forceCloseVersion;
      setOpen(false);
    }
  }, [forceCloseVersion]);

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-muted/20",
        className,
      )}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-2 min-w-0">
          {dotClassName ? (
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotClassName)} />
          ) : null}
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      {open ? (
        <div id={contentId} className="px-4 pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
