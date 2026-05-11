"use client";

/**
 * ClinicianReplyBanner - calm one-line banner at the top of the
 * /my/journey page when the clinician has replied to one or more of
 * the user's responses since the user's last visit.
 *
 * Phase 2F. No DB tracking - we use localStorage to remember the
 * user's last visit timestamp client-side. Server provides the most
 * recent reply timestamp; client compares.
 *
 * Why not a toast: a banner is calmer and stays put long enough for
 * the user to actually read it. Per the §1.5 tone guidelines we want
 * informational, not flashy.
 */

import { useEffect, useState } from "react";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";

const LS_KEY = "mioshy:journey:lastSeenReplyAt";

export function ClinicianReplyBanner({
  isHe,
  /** ISO timestamp of the most recent clinician reply across all the
   *  user's responses. Pass null when there's none. */
  latestReplyAt,
  /** Optional href deep-linking to the item that has the new reply.
   *  When omitted, the banner is informational only. */
  href,
  /** Number of fresh replies (since last visit). Helps the banner
   *  copy say "3 תגובות חדשות" when it makes sense. Optional. */
  freshCount = 1,
}: {
  isHe: boolean;
  latestReplyAt: string | null;
  href?: string;
  freshCount?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!latestReplyAt) {
      setShow(false);
      return;
    }
    try {
      const lastSeen = localStorage.getItem(LS_KEY);
      const lastSeenMs = lastSeen ? Date.parse(lastSeen) : 0;
      const replyMs = Date.parse(latestReplyAt);
      if (Number.isFinite(replyMs) && replyMs > lastSeenMs) {
        setShow(true);
      }
    } catch {
      // localStorage unavailable (private mode etc.) - show once,
      // dismiss takes us back to hidden but we won't be persistent.
      setShow(true);
    }
  }, [latestReplyAt]);

  const dismiss = () => {
    try {
      localStorage.setItem(LS_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show || !latestReplyAt) return null;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
            <MessageCircle className="size-4 text-emerald-200" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {isHe
                ? freshCount > 1
                  ? `${freshCount} תגובות חדשות מהמומחה שלכם`
                  : "תגובה חדשה מהמומחה שלכם"
                : freshCount > 1
                  ? `${freshCount} new replies from your clinician`
                  : "A new reply from your clinician"}
            </p>
            <p className="mt-0.5 text-[12px] text-emerald-100/70">
              {isHe
                ? "פתחו את הפריט כדי לקרוא את ההתייחסות האישית."
                : "Open the item to read the personal note."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {href ? (
            <Link
              href={href}
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
            >
              {isHe ? "לקריאה" : "Open"}
              <Arrow className="h-3 w-3" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
          >
            {isHe ? "סגור" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
