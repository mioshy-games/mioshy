/**
 * DriftAwarenessBanner
 * ─────────────────────────────────────────────────────────
 * Layer-3 user-facing banner. Renders ONLY when:
 *   1. The user's couple is in drifting/silent state, AND
 *   2. The coach has actually sent a check-in
 *      (drift_alerts.coach_checked_in_at IS NOT NULL).
 *
 * Tone: warm, low-effort, no guilt. Just points at the new
 * message in the general channel.
 */

import { Link } from "@/navigation";
import { HeartHandshake, ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  isHe:      boolean;
  /** Locale-resolved coach display name (or null). */
  coachName: string | null;
  /** Days silent at the time the coach reached out. */
  daysSilent: number | null;
}

export function DriftAwarenessBanner({ isHe, coachName, daysSilent }: Props) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const greeter = coachName ?? (isHe ? "המומחה שלכם" : "Your coach");

  return (
    <section
      className="mt-4 flex items-start gap-3 rounded-2xl border p-4"
      style={{
        borderColor: "rgba(184,60,77,0.25)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.10) 0%, rgba(184,60,77,0.03) 100%)",
      }}
      aria-live="polite"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#FAF6F7]"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
        }}
      >
        <HeartHandshake className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
          {isHe ? `${greeter} השאיר/ה לכם הודעה` : `${greeter} left you a message`}
        </div>
        <p className="mt-1 text-[15px] leading-snug text-white/85">
          {isHe
            ? daysSilent
              ? `עברו ${daysSilent} ימים מאז שהיינו בקשר. יש הודעה בערוץ — תקראו כשבא לכם.`
              : "יש הודעה בערוץ — תקראו כשבא לכם."
            : daysSilent
              ? `It's been ${daysSilent} days since we last heard from you. There's a message waiting — read it when you're ready.`
              : "There's a message in your channel — read it when you're ready."}
        </p>
        <Link
          href="/my/journey"
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#FAF6F7]/85 underline-offset-4 hover:underline"
        >
          {isHe ? "לקרוא" : "Read it"}
          <Arrow className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
