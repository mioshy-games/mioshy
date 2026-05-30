/**
 * NoJourneyUpsell — replaces the lesson hero on /my/today (and /my/lessons)
 * for users who don't have an active Journey subscription.
 *
 * Two purposes:
 *   1. The shell shouldn't feel half-empty for non-subscribers. The page
 *      still has chrome + sidebar + tabs; what's missing is a journey-
 *      backed reason to be there. This card fills that hole with a clear
 *      "here's what you're missing + how to start" prompt.
 *   2. It's a soft conversion surface on every visit, without nagging.
 *      The CTA goes to /journey (marketing) — same destination the
 *      sidebar's "התחילו את המסע" rail would point to if we ever showed
 *      it inline.
 *
 * Visually it mirrors the lesson hero shape so the page composition
 * stays consistent between subscribed and unsubscribed views — only
 * the contents differ. No assessment-funnel implication here; we just
 * show what Journey is.
 */

import { Link } from "@/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

interface Props {
  /** Localized title — "התחילו את מסע הזוגיות שלכם". */
  title: string;
  /** Localized body — ~30-50 words explaining the value. */
  body: string;
  /** Localized chip text — "החל מ-₪57 לשבוע" or "מסע חדש". */
  chip?: string | null;
  /** Localized CTA — "להתחיל אבחון" / "לבחור תוכנית". */
  ctaLabel: string;
  /** Where the CTA points. Defaults to /journey marketing. */
  ctaHref?: string;
  /** Localized 3 bullet teasers. */
  bullets: string[];
}

export function NoJourneyUpsell({
  title,
  body,
  chip,
  ctaLabel,
  ctaHref = "/journey",
  bullets,
}: Props) {
  return (
    <article
      className="relative overflow-hidden rounded-[18px] border p-6"
      style={{
        background:
          "linear-gradient(160deg, rgba(236,72,153,0.12) 0%, var(--shell-card-elev) 40%, var(--shell-card) 100%)",
        borderColor: "rgba(236,72,153,0.28)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 30px -16px rgba(236,72,153,0.30)",
      }}
    >
      {/* eyebrow chip */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.10em]"
          style={{ color: "var(--shell-pink-text)" }}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span>{chip ?? title}</span>
        </span>
      </div>

      <h2
        className="m-0 mb-2.5 text-[28px] font-extrabold leading-[1.18] tracking-tight"
        style={{ color: "var(--shell-text-1)" }}
      >
        {title}
      </h2>

      <p
        className="m-0 mb-4 text-[20px] leading-[1.55]"
        style={{ color: "var(--shell-text-1)" }}
      >
        {body}
      </p>

      {bullets.length > 0 ? (
        <ul className="m-0 mb-5 flex list-none flex-col gap-2 p-0">
          {bullets.map((b, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-[18px] leading-[1.45]"
              style={{ color: "var(--shell-text-2)" }}
            >
              <span
                aria-hidden
                className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--shell-pink-text)" }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href={ctaHref}
        className="inline-flex max-w-[320px] items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[18px] font-extrabold tracking-tight text-white"
        style={{
          background: "var(--shell-cta-grad)",
          boxShadow: "0 10px 28px -10px rgba(236,72,153,0.55)",
        }}
      >
        <span>{ctaLabel}</span>
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </article>
  );
}
