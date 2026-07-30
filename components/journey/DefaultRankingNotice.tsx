import { Link } from "@/navigation";
import { Sparkles } from "@/components/icons/Icons";

/**
 * Shown when the user's five categories are ordered by the DEFAULT ranking
 * rather than by their assessment result — i.e. they bought before finishing
 * the questionnaire.
 *
 * Spec §2א(א): buying is enough to start receiving content, so nobody is left
 * empty waiting on an assessment. The order is the one thing we genuinely
 * cannot personalise without it, so we say so plainly and invite them to fix
 * it — an invitation, never a gate.
 *
 * Copy approved by Itzik 2026-07-31; do not reword without asking.
 */
export function DefaultRankingNotice({ locale }: { locale: string }) {
  const isHe = locale !== "en";

  return (
    <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-3.5 backdrop-blur">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13.5px] leading-relaxed text-white/85">
            {isHe
              ? "הסדר כאן הוא ברירת מחדל. השלימו את האבחון הקצר, ונסדר את חמשת התכנים לפי מה שהכי חשוב לכם עכשיו."
              : "This order is our default. Take the short assessment and we'll arrange the five topics around what matters most to you right now."}
          </p>
          <Link
            href="/journey/assessment"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-amber-200 underline underline-offset-4 transition hover:text-amber-100"
          >
            {isHe ? "לאבחון הקצר" : "Take the assessment"}
          </Link>
        </div>
      </div>
    </div>
  );
}
