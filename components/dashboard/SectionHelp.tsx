"use client";

/**
 * SectionHelp
 *
 * Phase 12 — inline Hebrew help next to admin headings. Click the
 * question-mark icon to reveal a panel that explains:
 *   - What this area is for
 *   - Functionality summary (what each control does)
 *   - When the AI helps + when not
 *
 * Usage:
 *   <h1>הכותרת <SectionHelp title="..." body={...} aiNote="..." /></h1>
 *
 * Pure client — no server dep. Every panel is self-contained.
 */

import { useState } from "react";
import { HelpCircle, X, Sparkles } from "lucide-react";

export interface SectionHelpProps {
  /** Short title shown at top of panel. Falls through to the page heading if omitted. */
  title?: string;
  /** Main explanation — accepts strings or JSX. */
  body: React.ReactNode;
  /** Optional AI note — when present, renders a wine-accented box. */
  aiNote?: React.ReactNode;
}

export function SectionHelp({ title, body, aiNote }: SectionHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted/40 transition"
        aria-label="עזרה"
        title="עזרה"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className="bg-card fixed right-1/2 top-1/2 z-50 w-[min(90vw,500px)] -translate-y-1/2 translate-x-1/2 rounded-2xl border p-5 shadow-2xl"
            dir="rtl"
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight">
                {title ?? "מה זה האזור הזה?"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="text-muted-foreground hover:text-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-3 text-[14px] leading-relaxed text-foreground/90">
              {body}
            </div>

            {aiNote ? (
              <div
                className="mt-4 rounded-md border p-3 text-[13px] leading-relaxed"
                style={{
                  borderColor: "rgba(184,60,77,0.45)",
                  background: "rgba(184,60,77,0.08)",
                }}
              >
                <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[12px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  תפקיד ה-AI כאן
                </div>
                <div className="text-foreground/85">{aiNote}</div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              הבנתי, סגור
            </button>
          </div>
        </>
      ) : null}
    </span>
  );
}
