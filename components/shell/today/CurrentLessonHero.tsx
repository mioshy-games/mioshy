/**
 * CurrentLessonHero — the big card that owns the "Today" page.
 *
 * Per Studio v12 this is the ONLY element on the page that uses the
 * loud gradient CTA. Sidebar active states and the ExpertMini are kept
 * intentionally subtle so the eye lands here first.
 *
 * Renders an empty state when no lesson is currently open — copy comes
 * from the parent (so it stays CMS-controlled). Returns null when both
 * `lesson` AND `emptyTitle` are null — caller decides whether to hide
 * the whole section.
 */

import { Link } from "@/navigation";
import { ArrowLeft, Clock, MessageCircle } from "lucide-react";

export interface CurrentLessonHeroData {
  /** Display title of the lesson. */
  title: string;
  /** Short description / teaser (≤180 chars recommended). */
  description: string;
  /** Category name shown in the eyebrow ("תקשורת"). */
  categoryName: string | null;
  /** Estimated minutes from journey_items.est_minutes. */
  estMinutes: number | null;
  /** Where the "open lesson" CTA links to. */
  href: string;
  /** When true, the "נפתח עכשיו" amber tag renders top-right. */
  isFresh: boolean;
}

interface Props {
  lesson: CurrentLessonHeroData | null;

  /** Localized chip text — "השיעור הנוכחי". */
  currentChip: string;
  /** Localized CTA text — "פתחו את השיעור". */
  ctaLabel: string;
  /** Localized fresh tag — "נפתח עכשיו". */
  freshTag: string;
  /** Localized minutes suffix — "דקות". */
  minutesSuffix: string;

  /** Empty-state title shown when lesson === null. Null = render nothing. */
  emptyTitle?: string | null;
  /** Empty-state body when lesson === null. */
  emptyBody?: string | null;
}

export function CurrentLessonHero({
  lesson,
  currentChip,
  ctaLabel,
  freshTag,
  minutesSuffix,
  emptyTitle,
  emptyBody,
}: Props) {
  // Empty state — render only when caller gave a title.
  if (!lesson) {
    if (!emptyTitle) return null;
    return (
      <article
        className="relative overflow-hidden rounded-[18px] border p-6"
        style={{
          background: "var(--shell-card)",
          borderColor: "var(--shell-line-soft)",
        }}
      >
        <h2 className="m-0 text-[24px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--shell-text-1)" }}>
          {emptyTitle}
        </h2>
        {emptyBody ? (
          <p className="mt-2 text-[18px] leading-relaxed" style={{ color: "var(--shell-text-2)" }}>
            {emptyBody}
          </p>
        ) : null}
      </article>
    );
  }

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
      {/* "נפתח עכשיו" tag, top-right (RTL natural). */}
      {lesson.isFresh ? (
        <span
          className="absolute top-3.5 right-3.5 rounded-full px-2.5 py-1 text-[14px] font-extrabold"
          style={{ background: "var(--shell-amber)", color: "#1A0F00" }}
        >
          {freshTag}
        </span>
      ) : null}

      {/* eyebrow row: category + "השיעור הנוכחי" chip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2" style={{ paddingInlineStart: lesson.isFresh ? "100px" : 0 }}>
        {lesson.categoryName ? (
          <span
            className="inline-flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.10em]"
            style={{ color: "var(--shell-pink-text)" }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {lesson.categoryName}
          </span>
        ) : <span />}
        <span
          className="rounded-full border px-3 py-1 text-[14px] font-bold"
          style={{
            background: "var(--shell-wine-soft)",
            borderColor: "var(--shell-wine-edge)",
            color: "var(--shell-pink-text)",
          }}
        >
          {currentChip}
        </span>
      </div>

      <h2
        className="m-0 mb-2.5 text-[28px] font-extrabold leading-[1.18] tracking-tight"
        style={{ color: "var(--shell-text-1)" }}
      >
        {lesson.title}
      </h2>

      <p
        className="mb-4 text-[20px] leading-[1.55]"
        style={{ color: "var(--shell-text-1)" }}
      >
        {lesson.description}
      </p>

      {/* meta chips: only show if we actually have data (no fabrication). */}
      {lesson.estMinutes ? (
        <div className="mb-4 flex flex-wrap gap-2 text-[14px]" style={{ color: "var(--shell-text-2)" }}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <Clock className="h-3 w-3 opacity-85" />
            {lesson.estMinutes} {minutesSuffix}
          </span>
        </div>
      ) : null}

      <Link
        href={lesson.href}
        className="inline-flex max-w-[320px] items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[18px] font-extrabold tracking-tight text-white shadow-lg"
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
