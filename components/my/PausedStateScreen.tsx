/**
 * PausedStateScreen
 * ─────────────────────────────────────────────────────────
 * Layer-3 follow-up — full /my/journey replacement when the user
 * has an active pause. Replaces the dashboard with a single calm
 * surface that says: "you're on pause until X, here's how to come
 * back."
 *
 * One CTA: "We're back" → resumeSubscription(). No content
 * surfaces. No anxiety.
 *
 * The dashboard returns the moment the pause ends (resumed_at
 * stamp OR paused_until passes — the UI gate just checks both).
 */

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resumeSubscription } from "@/app/actions/subscription-pause";

interface Props {
  isHe:        boolean;
  pausedUntil: string;
}

export function PausedStateScreen({ isHe, pausedUntil }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const formatted = new Date(pausedUntil).toLocaleDateString(
    isHe ? "he-IL" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );

  const onResume = () => {
    startTransition(async () => {
      const res = await resumeSubscription();
      if (!res.ok) {
        toast.error(
          isHe ? `חזרה נכשלה: ${res.error}` : `Resume failed: ${res.error}`,
        );
        return;
      }
      toast.success(isHe ? "שמחים שחזרתם." : "Glad to have you back.");
      router.refresh();
    });
  };

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-white"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, #B83C4D 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center">
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40"
          style={{
            background: "rgba(251, 191, 36, 0.10)",
            boxShadow: "0 12px 40px -16px rgba(251,191,36,0.4)",
          }}
        >
          <CalendarClock className="h-9 w-9 text-amber-200" />
        </div>

        <h1 className="mt-6 font-heading text-[30px] font-extrabold leading-tight sm:text-[36px]">
          {isHe ? "אתם בהשהיה" : "You're on pause"}
        </h1>

        <p className="mt-3 text-[16px] leading-relaxed text-white/75">
          {isHe
            ? `המסלול חוזר אליכם ב-${formatted}. עד אז — כלום לא מצפה מכם.`
            : `Your path resumes ${formatted}. Until then — nothing's expected from you.`}
        </p>

        <p className="mt-2 text-[14px] text-white/55">
          {isHe
            ? "אם אתם מוכנים מוקדם — אפשר לחזור עכשיו."
            : "If you're ready earlier — you can come back now."}
        </p>

        <Button
          type="button"
          onClick={onResume}
          disabled={pending}
          className="mt-7 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-bold"
          style={{
            background:
              "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            boxShadow: "0 18px 40px -12px rgba(184,60,77,0.55)",
          }}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isHe ? "חוזרים…" : "Resuming…"}
            </>
          ) : (
            <>
              <PlayCircle className="size-5" />
              {isHe ? "חזרנו" : "We're back"}
            </>
          )}
        </Button>

        <p className="mt-6 text-[12px] text-white/40">
          {isHe
            ? "תוכלו לנהל את המנוי גם דרך עמוד החשבון."
            : "You can also manage your subscription from the account page."}
        </p>
      </div>
    </div>
  );
}
