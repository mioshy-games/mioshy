"use client";

/**
 * ViewAsBanner
 * ─────────────────────────────────────────────────────────
 * Persistent top banner shown on /my/journey (and other user
 * surfaces) when a coach is currently impersonating a user.
 *
 * Renders at the very top of every viewport so the coach can
 * never confuse impersonation with their own session. Includes
 * an "exit" button that closes the audit row + clears the cookie.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X, Loader2 } from "lucide-react";
import { endViewAs } from "@/app/actions/coach-view-as";

interface Props {
  /** Already-resolved label — usually the impersonated user's email or first name. */
  viewedLabel: string;
  isHe:        boolean;
}

export function ViewAsBanner({ viewedLabel, isHe }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onExit = () => {
    startTransition(async () => {
      await endViewAs();
      // Send the coach back to their dashboard. Hard navigation
      // so server-rendered surfaces redraw without view-as in the
      // request context.
      window.location.assign("/dashboard/my-clients");
      router.refresh();
    });
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300/40 bg-amber-500/15 px-4 py-2 text-amber-100 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Eye className="size-4" />
        {isHe
          ? `מצב צפייה: רואה כמו ${viewedLabel}`
          : `View-as mode: viewing as ${viewedLabel}`}
      </div>
      <button
        type="button"
        onClick={onExit}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wider transition hover:bg-amber-300/25 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <X className="size-3" />
        )}
        {isHe ? "יציאה" : "Exit"}
      </button>
    </div>
  );
}
