/**
 * components/my/UpgradeToJourneyCard.tsx
 *
 * Cross-sell card surfaced on `/my` for users who currently hold an
 * active "games" subscription but no "journey" subscription. It pitches
 * the upgrade path that was formalised on 2026-05-22:
 *
 *   • The user pays 57 ₪/week for Journey from the next checkout onward.
 *   • Their existing games subscription is auto-cancelled by the Cardcom
 *     indicator the moment the Journey checkout succeeds (see
 *     `app/api/billing/cardcom/indicator/route.ts` → JOURNEY_UPGRADE block).
 *     Per policy, no refund is issued for the unused portion of the
 *     current games week.
 *   • Every previously-bought one-off Adults game stays in their account
 *     untouched. Journey also bundles unrestricted Adults access on top.
 *
 * Visual contract: matches the muted-glass aesthetic of the membership
 * banner two sections above it on /my, but uses a wine/rose tint so it
 * reads as a Journey-specific surface (Journey's brand colour family).
 *
 * The CTA itself is a plain link to `/pricing` (where the user picks
 * Journey and goes through the regular checkout flow) — we don't try to
 * skip steps. Centralising the checkout entry point on one page keeps
 * country/VAT confirmation consistent.
 */

import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { CmsText } from "@/components/cms/CmsText";

export function UpgradeToJourneyCard({ isHe }: { isHe: boolean }) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-rose-300/35 bg-gradient-to-br from-rose-500/12 via-amber-500/6 to-violet-500/12 p-5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-100">
            <Sparkles className="h-3 w-3 text-rose-200" />
            <CmsText cmsKey="myHub.upgradeJourneyBadge" />
          </div>
          <CmsText
            cmsKey="myHub.upgradeJourneyTitle"
            as="p"
            className="mt-2 text-[18px] font-semibold text-white sm:text-[19px]"
          />
          <CmsText
            cmsKey="myHub.upgradeJourneyBody"
            as="p"
            className="mt-1 text-[15px] leading-[1.55] text-white/75 sm:text-[15px]"
          />
        </div>
        <Link
          href="/pricing"
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-rose-500 px-6 text-[15px] font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400 hover:shadow-xl"
        >
          <CmsText cmsKey="myHub.upgradeJourneyCta" />
          <Arrow className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
