"use client";

// ============================================================
// HintIcon — slice "expert onboarding" PR2.
//
// Tiny "?" button that opens a popover with explanatory copy.
// Reads from lib/journey-content/hint-catalog.ts by stable topic
// id. Hebrew is canonical; renders RTL by default. EN body is
// optional and shown in a muted tone below the HE body if present.
//
// No new deps — self-contained popover with click-outside + Esc
// dismiss + small portal-less positioning. Same pattern as the
// JourneyNotificationsBell dropdown.
//
// Use:  <HintIcon topic="item.audience" />
//       (place inline next to the field label)
//
// If the topic id isn't in the catalog, renders nothing in
// production (would be a missing-translation bug — surfaces in dev
// via a console warning).
// ============================================================

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getHint,
  type HintTopic,
} from "@/lib/journey-content/hint-catalog";

interface Props {
  topic: HintTopic;
  /** Override the default icon size (1rem). */
  className?: string;
  /** Aria label override; defaults to "More info" / "מידע נוסף". */
  ariaLabel?: string;
}

export function HintIcon({ topic, className, ariaLabel }: Props) {
  const hint = getHint(topic);
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hint) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[HintIcon] missing catalog entry for topic "${topic}"`);
    }
    return null;
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? "מידע נוסף"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex size-4 cursor-help items-center justify-center rounded-full transition-colors",
          className,
        )}
      >
        <HelpCircle className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          dir="rtl"
          className="bg-popover text-popover-foreground absolute end-0 top-5 z-50 w-72 max-w-[88vw] rounded-lg border p-3 shadow-xl"
          style={{ insetInlineEnd: 0, insetInlineStart: "auto" }}
        >
          <div className="text-sm font-semibold">{hint.titleHe}</div>
          <p className="text-foreground/80 mt-1.5 whitespace-pre-line text-[12px] leading-relaxed">
            {hint.bodyHe}
          </p>
          {hint.bodyEn ? (
            <p className="text-muted-foreground mt-2 whitespace-pre-line border-t pt-2 text-[11px] leading-relaxed" dir="ltr">
              {hint.bodyEn}
            </p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
