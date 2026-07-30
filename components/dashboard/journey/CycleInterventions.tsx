"use client";

import { useState, useTransition } from "react";
import { RotateCcw, PlayCircle, AlertTriangle } from "lucide-react";
import {
  openCycleAction,
  resetCompletionAction,
  type CycleActionResult,
} from "@/app/dashboard/journey/cycles/actions";

/**
 * Admin intervention buttons (spec §5). Deliberately noisy about consequences:
 * "force open" spends a paused customer's month while they are away, so the
 * screen says that in words rather than hiding it behind a checkbox label.
 */
export function CycleInterventions({
  userId,
  hasOpenCycle,
}: {
  userId: string;
  hasOpenCycle: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<CycleActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? r.message : r.error });
    });

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">כלי התערבות</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || hasOpenCycle}
          onClick={() => run(() => openCycleAction(userId, false))}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <PlayCircle className="size-4" />
          פתח מחזור הבא
        </button>
        <button
          type="button"
          disabled={pending || hasOpenCycle}
          onClick={() => {
            if (
              !window.confirm(
                "כפייה מתעלמת מבדיקת הזכאות. אם המשתמש בהשהיה — שעון החודש יתחיל עכשיו והתוכן יישרף בזמן שהוא לא כאן. להמשיך?",
              )
            )
              return;
            run(() => openCycleAction(userId, true));
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/50 px-3 py-1.5 text-sm font-medium text-amber-700 disabled:opacity-50"
        >
          <AlertTriangle className="size-4" />
          פתח בכפייה
        </button>
      </div>
      {hasOpenCycle && (
        <p className="mt-2 text-xs text-muted-foreground">
          יש מחזור פתוח. המחזור הבא נפתח כשכל החמישה יסומנו, או בתאריך שלמעלה.
        </p>
      )}
      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}

export function ResetCompletionButton({
  cycleItemId,
  userId,
}: {
  cycleItemId: string;
  userId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await resetCompletionAction(cycleItemId, userId);
            setErr(r.ok ? null : r.error);
          })
        }
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        <RotateCcw className="size-3" />
        בטל סימון
      </button>
      {err && <span className="ms-2 text-xs text-red-600">{err}</span>}
    </>
  );
}
