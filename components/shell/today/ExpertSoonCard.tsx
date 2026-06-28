/**
 * ExpertSoonCard — shown on /my/today when the user has a Journey
 * subscription but no expert chat preview yet.
 *
 * Itzik 2026-06-28: repurposed from a passive "we're matching you" placeholder
 * into an assessment hand-off — completing the full assessment is what unlocks
 * the tailored content and guidance, so the card now carries a CTA to it.
 *
 * `cta` is optional so the card degrades to its original text-only form when
 * no action is supplied.
 */

import { MessageCircle } from "lucide-react";

interface Props {
  title: string;
  body: string;
  /** Optional call-to-action link (e.g. the full assessment). `href` must be
   *  an absolute, locale-prefixed path since this is a plain anchor in a
   *  server component (no @/navigation locale handling). */
  cta?: { href: string; label: string };
}

export function ExpertSoonCard({ title, body, cta }: Props) {
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border p-4"
      style={{
        background: "var(--shell-card)",
        borderColor: "var(--shell-line-soft)",
      }}
      aria-label={title}
    >
      <div
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--shell-wine-soft)",
          color: "var(--shell-pink-text)",
        }}
        aria-hidden
      >
        <MessageCircle className="h-[20px] w-[20px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[16px] font-bold"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </div>
        <p
          className="m-0 mt-1 text-[16px] leading-[1.45]"
          style={{ color: "var(--shell-text-2)" }}
        >
          {body}
        </p>
        {cta ? (
          <a
            href={cta.href}
            className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-full px-5 text-[15px] font-semibold transition hover:brightness-110"
            style={{
              background: "var(--shell-wine-soft)",
              color: "var(--shell-pink-text)",
            }}
          >
            {cta.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
