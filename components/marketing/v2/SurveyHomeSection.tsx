import { SurveyFlow } from "@/components/survey/SurveyFlow";

/**
 * SurveyHomeSection — anonymous homepage teaser for "סקר הזוגיות של ישראל".
 *
 * Renders the SAME interactive flow as /he/survey via <SurveyFlow embedded />:
 * answer a live question inline → Bayesian reveal (§8) → join CTA. The anon
 * vote uses the shared `poll_anon_id` cookie set by /api/poll/vote, so a vote
 * cast here counts and links on signup exactly like on the standalone page.
 *
 * HE-only (gated in app/[locale]/page.tsx; SurveyFlow's copy is Hebrew).
 * SurveyFlow is a client component that fetches the current question on mount,
 * so this section never blocks first paint — the heading paints server-side
 * immediately and the card streams in the question.
 */
export function SurveyHomeSection() {
  return (
    <section
      dir="rtl"
      aria-label="סקר הזוגיות של ישראל"
      className="relative isolate overflow-hidden bg-[#fffdfc]"
    >
      {/* Soft aurora orbs echoing the homepage palette (decorative). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.16),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-8 -end-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_70%)] blur-2xl"
      />

      <div className="relative mx-auto max-w-3xl px-4 pt-12 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/85 px-4 py-1.5 text-xs font-semibold tracking-wider text-rose-700 shadow-sm backdrop-blur">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#b83c4d] via-[#ec4899] to-[#f59e0b]"
          />
          חדש · שאלה יומית
        </span>
        <h2 className="mt-4 font-heading text-3xl font-bold text-[#2a2130] sm:text-4xl">
          סקר הזוגיות של ישראל
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-[#4a3f4a] sm:text-lg">
          שאלה אחת ביום. עונים, ורואים מיד כמה זוגות בישראל ענו בדיוק כמוכם.
        </p>
      </div>

      <div className="relative pb-6">
        <SurveyFlow embedded />
      </div>
    </section>
  );
}
