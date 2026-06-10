"use client";

/**
 * components/dashboard/journey/CoupleAiSummaryCard.tsx
 *
 * Top-of-page "סיכום AI" for the couple control panel: a 3-4 line coach
 * briefing (weak areas, prominent need, recommended direction) synthesised
 * across both partners' assessments. Generates on mount from the digest the
 * server already assembled — no extra DB round-trip, and it doesn't block
 * the page's initial render (the heavy assignment data paints first).
 *
 * Renders nothing when no partner has an assessment. On AI failure it shows a
 * soft retry, never an error wall. Also hosts the "טיוטת אימייל" action so
 * both AI affordances sit together at the top.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import {
  generateCoupleSummary,
  type CoupleAiDigest,
} from "@/app/dashboard/journey/clients/[ownerKey]/ai-actions";
import { EmailDraftSheet } from "./EmailDraftSheet";

export function CoupleAiSummaryCard({ digest }: { digest: CoupleAiDigest }) {
  const hasAssessment = digest.partners.some((p) => p.hasAssessment);
  const [loading, setLoading] = useState(hasAssessment);
  const [summary, setSummary] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  async function run() {
    setLoading(true);
    try {
      const out = await generateCoupleSummary(digest);
      setSummary(out);
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  useEffect(() => {
    if (!hasAssessment || ran.current) return;
    ran.current = true;
    void run();
    // digest is stable for a given page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No assessment for anyone — stay out of the way entirely.
  if (!hasAssessment) return null;

  return (
    <section className="border-border bg-card rounded-xl border p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Sparkles className="size-5 text-rose-600" />
          סיכום AI
        </h2>
        {done ? (
          <button
            type="button"
            onClick={run}
            disabled={loading}
            aria-label="רענן סיכום"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-2">
          <div className="bg-muted h-3.5 w-full animate-pulse rounded" />
          <div className="bg-muted h-3.5 w-11/12 animate-pulse rounded" />
          <div className="bg-muted h-3.5 w-3/4 animate-pulse rounded" />
        </div>
      ) : summary ? (
        <p dir="rtl" className="text-[15px] leading-relaxed text-foreground/90">
          {summary}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          לא הצלחתי להפיק סיכום כרגע.{" "}
          <button
            type="button"
            onClick={run}
            className="text-foreground underline underline-offset-4"
          >
            נסה שוב
          </button>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <EmailDraftSheet digest={digest} />
      </div>
    </section>
  );
}
