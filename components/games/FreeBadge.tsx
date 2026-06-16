/**
 * components/games/FreeBadge.tsx
 *
 * Small catalogue/game-page markers for the games pillar (H, g-h-launch):
 *   - <FreeBadge>        — emerald "חינם" pill on the free game (is_free).
 *   - <SubscriptionTag>  — quiet "דרוש מנוי" pill on non-free games in the
 *                          PUBLIC catalogue (never on /my/games, where the
 *                          viewer already holds the games entitlement).
 *
 * Server components (no interactivity) — labels via <CmsText> so the copy is
 * CMS-editable. Keys: games.freeBadge / games.subscriptionTag (he+en fallbacks
 * live in messages/*.json). Position is set by the caller via `className`.
 */

import { CmsText } from "@/components/cms/CmsText";

export function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-extrabold text-[#3a2200] shadow-lg ${className}`}
      style={{ background: "linear-gradient(135deg,#f59e0b,#FCCA65)" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "#3a2200", opacity: 0.55 }}
        aria-hidden
      />
      <CmsText cmsKey="games.freeBadge" as="span" />
    </span>
  );
}

export function SubscriptionTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] font-bold text-white/80 ${className}`}
    >
      <span aria-hidden>🔒</span>
      <CmsText cmsKey="games.subscriptionTag" as="span" />
    </span>
  );
}
