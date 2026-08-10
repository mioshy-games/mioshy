import { Link } from "@/navigation";
import { Sparkles } from "@/components/icons/Icons";

/**
 * Shown when the user's five categories are ordered by the DEFAULT ranking
 * rather than by their full assessment result.
 *
 * Spec §2א(א): buying is enough to start receiving content, so nobody is left
 * empty waiting on an assessment. The order is the one thing we genuinely
 * cannot personalise fully without it, so we say so plainly and invite them to
 * sharpen it — an invitation, never a gate.
 *
 * Copy: the SHORT assessment is already done by the time this renders, so the
 * text acknowledges that order and asks for the remaining questions rather than
 * asking them to start. Both languages must say the same thing.
 *
 * Copy approved by Itzik 2026-08-10 (he + en); do not reword without asking.
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
              ? "סיימתם את האבחון הקצר, וזה הסדר שיצא ממנו. עוד כמה שאלות והוא יהיה מדויק הרבה יותר, וגם המומחה שלנו יידע מאיפה להתחיל איתכם."
              : "You've finished the short assessment, and this is the order it came out in. A few more questions and it gets a lot more accurate, and your expert will know where to start with you."}
          </p>
          <Link
            href="/journey/assessment"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-amber-200 underline underline-offset-4 transition hover:text-amber-100"
          >
            {isHe ? "להשלמת האבחון" : "Complete the assessment"}
          </Link>
        </div>
      </div>
    </div>
  );
}
