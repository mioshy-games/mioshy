/**
 * SubscriptionStatusBanner — calm, deliberate confirmation that the
 * paid surface is, indeed, available to the user.
 *
 * Why this exists: the user reported "אני לא משוכנע שאכן אנחנו מציינים
 * ויודעים [שיש לי גישה]". Without an explicit signal, paying users
 * can land on /my/journey and not realize they crossed the threshold —
 * especially after a billing flow that bounced through Cardcom.
 *
 * Two variants:
 *   - "active"  → emerald, "המנוי שלכם פעיל" + a tiny Library icon
 *   - "incomplete" → amber, recovery CTA when the assessment didn't
 *     attach to this account (the bug we surfaced via diagnostic logs)
 *
 * Static, no animation. The banner is informational, not promotional.
 */

import { Link } from "@/navigation";
import { CheckCircle2, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";

export type SubscriptionStatusVariant = "active" | "assessment_missing";

export function SubscriptionStatusBanner({
  isHe,
  variant,
}: {
  isHe: boolean;
  variant: SubscriptionStatusVariant;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  if (variant === "active") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3 backdrop-blur-md sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
            <CheckCircle2 className="size-4 text-emerald-200" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {isHe ? "המנוי שלכם פעיל" : "Your subscription is active"}
            </p>
            <p className="mt-0.5 text-[12px] text-emerald-100/70">
              {isHe
                ? "כל התכנים והכלים פתוחים עבורכם בחדר הזה."
                : "All content and tools are open for you in this room."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // assessment_missing — recovery flow
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/15">
          <AlertTriangle className="size-4 text-amber-200" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {isHe
              ? "האבחון לא קושר לחשבון שלכם"
              : "Your assessment isn't linked to this account"}
          </p>
          <p className="mt-0.5 text-[12px] text-amber-100/75">
            {isHe
              ? "המנוי פעיל ומוכן. כדי שהמומחים שלנו יכינו לכם תוכנית אישית, צריך לחזור על האבחון פעם אחת בלבד."
              : "Your subscription is active. To let our experts build a personal plan, please complete the assessment one more time."}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <Link
          href="/journey/assessment"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
        >
          {isHe ? "להשלמת האבחון" : "Complete assessment"}
          <Arrow className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
