/**
 * components/my/CompleteFullAssessmentCard.tsx (F3.2)
 *
 * Minimal "complete your full assessment" card on /my for a subscriber who
 * chose "complete later" after the short report. Renders nothing unless the
 * derived pending state holds. Links back to the assessment, where the
 * subscriber resumes straight into the full delta (page resolves activePhase).
 *
 * Copy is intentionally minimal here; F3.3 owns the richer report/copy.
 */

import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isFullAssessmentPending } from "@/lib/journey/full-assessment-pending";

export async function CompleteFullAssessmentCard({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const pending = await isFullAssessmentPending(admin, userId);
  if (!pending) return null;

  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <Link
      href="/journey/assessment"
      className="group flex items-center justify-between gap-4 rounded-2xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/15 via-white/5 to-violet-500/15 p-5 backdrop-blur transition hover:border-fuchsia-300/55"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-200" />
        <div>
          <p className="text-[15px] font-semibold text-white">
            {isHe ? "השלימו את האבחון המלא" : "Complete your full assessment"}
          </p>
          <p className="mt-0.5 text-[13px] text-white/70">
            {isHe
              ? "עוד 2 דקות כדי לפתוח את התוכנית האישית המלאה שלכם."
              : "2 more minutes to unlock your full personalized plan."}
          </p>
        </div>
      </div>
      <Arrow className="h-5 w-5 shrink-0 text-white/70 transition group-hover:text-white" />
    </Link>
  );
}
