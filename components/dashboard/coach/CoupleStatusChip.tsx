"use client";

/**
 * CoupleStatusChip
 *
 * Phase 13 — clickable chip showing the workflow state for one couple.
 * Click → opens a popup with the next-action prompt + a "Take me there"
 * button that drills into the right place.
 *
 * Used in /dashboard/my-clients table rows and the dashboard ribbon.
 */

import { useState } from "react";
import Link from "next/link";
import { X, ArrowLeft } from "lucide-react";
import type {
  WorkflowState,
  Urgency,
} from "@/lib/journey/couple-workflow-state";

const URGENCY_CLASS: Record<Urgency, string> = {
  high:   "border-rose-300/50 bg-rose-500/10  text-rose-100",
  medium: "border-amber-300/50 bg-amber-500/10 text-amber-100",
  low:    "border-blue-300/40  bg-blue-500/10  text-blue-100",
  info:   "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
};

export function CoupleStatusChip({
  coupleLabel,
  state,
}: {
  coupleLabel: string;
  state:       WorkflowState;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${URGENCY_CLASS[state.urgency]}`}
        title="הצעד הבא"
      >
        {state.label_he}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="bg-card fixed right-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-y-1/2 translate-x-1/2 rounded-2xl border p-5 shadow-2xl"
            dir="rtl"
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold tracking-tight">
                  {coupleLabel}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  המצב הנוכחי:{" "}
                  <span className="text-foreground">
                    {state.label_he}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="text-muted-foreground hover:text-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="bg-muted/30 mb-4 rounded-md p-3 text-[14px] leading-relaxed">
              <div className="text-muted-foreground mb-1 text-[11px] font-bold uppercase tracking-wider">
                הצעד הבא
              </div>
              <p className="text-foreground/90">{state.next_action_he}</p>
            </div>

            {state.context.lastUserMessage ? (
              <div className="mb-4 rounded-md border border-dashed p-3 text-[12px]">
                <div className="text-muted-foreground mb-1 text-[10px] font-bold uppercase tracking-wider">
                  הודעה אחרונה מהמשתמש
                </div>
                <p className="line-clamp-3 text-foreground/85">
                  &ldquo;{state.context.lastUserMessage}&rdquo;
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={state.next_action_href}
                className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
                {state.cta_label_he}
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm"
              >
                סגור
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
