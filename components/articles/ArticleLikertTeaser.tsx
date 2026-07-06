import { Link } from "@/navigation";

/**
 * ArticleLikertTeaser — a single Likert question styled like the site's
 * assessment questions (1–5 circles with a brand-gradient ring + endpoint
 * labels), embedded in an article body at a `{{likert:QUESTION}}` token.
 *
 * It is a GATE, not a real question: clicking any value navigates straight to
 * the full assessment. Nothing is saved and it is not part of the assessment.
 * Reusable across articles — the question is passed per-article via the token.
 */

const BRAND_GRADIENT =
  "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";
const GRAD_RING_BG = `linear-gradient(#fff,#fff) padding-box, ${BRAND_GRADIENT} border-box`;

export function ArticleLikertTeaser({
  question,
  locale,
}: {
  question: string;
  locale: "he" | "en";
}) {
  const isHe = locale === "he";
  const low = isHe ? "כמעט ולא" : "Not at all";
  const high = isHe ? "מאוד" : "Very much";
  const labels = [low, "", "", "", high];
  // Per spec: the teaser always leads into the full assessment funnel.
  const href = "/journey/assessment";

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="my-10 rounded-2xl border border-purple-100 bg-[#fbf9ff] px-5 py-7 text-center"
    >
      <p className="mx-auto mb-6 max-w-[520px] text-[1.25rem] font-bold leading-snug text-gray-900">
        {question}
      </p>
      <div className="mx-auto flex w-full max-w-[440px] items-start">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="flex min-w-0 flex-1 flex-col items-center gap-[9px]"
          >
            <Link
              href={href}
              aria-label={`${n}`}
              className="grid aspect-square w-[clamp(46px,11vw,54px)] place-items-center rounded-full text-[17px] font-extrabold text-[#141414] no-underline transition hover:-translate-y-0.5"
              style={{ background: GRAD_RING_BG, border: "0.4px solid transparent" }}
            >
              {n}
            </Link>
            <div className="px-0.5 text-center text-[12.5px] font-bold leading-[1.22] text-[#4a4441]">
              {labels[n - 1]}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-gray-400">
        {isHe
          ? "לחיצה על תשובה תיקח אתכם לאבחון המלא · לא נשמרת תשובה"
          : "Tapping an answer takes you to the full assessment · nothing is saved"}
      </p>
    </div>
  );
}
