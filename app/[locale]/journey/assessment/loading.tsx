/**
 * Skeleton shown while journey/assessment server component loads.
 * Matches the real page layout so there's no layout shift.
 */
export default function JourneyAssessmentLoading() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col gap-8 px-4 py-10 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="h-8 w-52 rounded-xl bg-white/10" />
        <div className="h-4 w-72 rounded bg-white/6" />
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <div className="h-4 w-10 rounded bg-white/8" />
          <div className="h-4 w-10 rounded bg-white/8" />
        </div>
        <div className="h-2 w-full rounded-full bg-white/10" />
      </div>

      {/* Question text */}
      <div className="flex flex-col gap-3">
        <div className="h-7 w-4/5 rounded-lg bg-white/10" />
        <div className="h-7 w-3/5 rounded-lg bg-white/8" />
      </div>

      {/* Answer options (likert-style placeholder) */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 rounded-2xl bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}
