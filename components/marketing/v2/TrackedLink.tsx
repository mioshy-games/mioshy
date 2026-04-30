"use client";

import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/navigation";
import { track } from "@/lib/analytics";

type Props = ComponentProps<typeof Link> & {
  /** A short stable identifier for this CTA - used for analytics. */
  ctaId: string;
  /** Optional section name to group CTAs by source section. */
  section?: string;
  children: ReactNode;
};

/**
 * TrackedLink - fires `home_v2_cta_click` to internal analytics on click,
 * then navigates via the locale-aware `Link` from next-intl.
 *
 * Use only for key conversion CTAs (Hero, Pricing, Assessment, Final).
 * Other regular nav links can stay as plain `Link`.
 */
export function TrackedLink({ ctaId, section, children, onClick, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        // Fire-and-forget; never blocks navigation
        try {
          track("home_v2_cta_click", { cta_id: ctaId, section: section ?? null });
        } catch {
          /* analytics failure must not break navigation */
        }
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
