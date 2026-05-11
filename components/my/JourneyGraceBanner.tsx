/**
 * JourneyGraceBanner - surfaces the v3 grace / blocked state across
 * every journey-adjacent surface (/my, /my/journey, /journey/timeline).
 *
 * Two variants driven by entitlements.journeyState:
 *
 *   "grace"   - 14-day window after natural expiry. Cadence is paused
 *               but past content stays accessible. Amber tone. Optional
 *               "X days remaining" countdown when journeyGraceUntil is
 *               in the future.
 *   "blocked" - grace expired without renewal. Rose tone. The locked
 *               screen takes over /journey, /my/journey, /journey/timeline
 *               on its own; this banner remains for /my (the hub) and
 *               anywhere else that doesn't redirect to the locked screen.
 *
 * Renders nothing when state === 'active' or null. Caller passes the
 * field directly so we don't re-fetch.
 *
 * Static, no animation. Calm informational tone.
 */

import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, AlertTriangle, Lock } from "lucide-react";
import type { JourneyEntitlementState } from "@/lib/entitlements/getUserEntitlements";

export function JourneyGraceBanner({
  isHe,
  state,
  graceUntil,
}: {
  isHe: boolean;
  state: JourneyEntitlementState | null;
  /** ISO timestamp; used to compute the "X days remaining" caption
   *  during grace. Ignored when state !== 'grace'. */
  graceUntil: string | null;
}) {
  if (state !== "grace" && state !== "blocked") return null;
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  if (state === "grace") {
    const daysLeft = computeDaysLeft(graceUntil);
    const headline = isHe
      ? "המנוי פג. יש לכם 14 יום לחזור לתוכן שכבר קיבלתם - חידוש פותח את הכל מחדש."
      : "Your plan ended. You have 14 days to revisit content you've already received - renew to unlock everything.";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 backdrop-blur-md">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/15">
            <AlertTriangle className="size-4 text-amber-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{headline}</p>
            {daysLeft !== null ? (
              <p className="mt-0.5 text-[12px] text-amber-100/75">
                {isHe
                  ? `נותרו ${daysLeft} ימים לחידוש לפני נעילה מלאה.`
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining before full lockout.`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            {isHe ? "חידוש מנוי" : "Renew plan"}
            <Arrow className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  // blocked
  const headline = isHe
    ? "המנוי פג. חידוש מחזיר את הגישה לכל מה שצברתם."
    : "Your plan ended. Renew to restore access to everything you've earned.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/[0.08] p-4 backdrop-blur-md">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/15">
          <Lock className="size-4 text-rose-200" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{headline}</p>
          <p className="mt-0.5 text-[12px] text-rose-100/75">
            {isHe
              ? "כל התקדמותכם, התכנים שקיבלתם וההיסטוריה שמורים. חידוש משחזר את הגישה לכל זה."
              : "Your progress, content history, and threads are preserved. Renewing restores access to all of it."}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
        >
          {isHe ? "חידוש מנוי" : "Renew plan"}
          <Arrow className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function computeDaysLeft(graceUntilIso: string | null): number | null {
  if (!graceUntilIso) return null;
  const ms = new Date(graceUntilIso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}
