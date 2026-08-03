"use client";

import type { ComponentProps, ReactNode } from "react";
import NextLink from "next/link";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import {
  trackSurveyLinkClick,
  type SurveyLinkLocation,
} from "@/lib/analytics/survey-link";

/**
 * SurveyLink — a `<Link>` to the daily-survey flow that reports its own click.
 * ───────────────────────────────────────────────────────────────────────────
 * Every entry point into /[locale]/survey should go through one of these
 * instead of a bare `<Link>` with a hand-rolled `onClick`. There are already
 * six such links (header ×2, footer, mobile services bar, shell side-nav,
 * shell mobile tabs, plus the marketing landing page) and the list grows.
 *
 * Two variants because the codebase has two kinds of link:
 *   • <SurveyLink> / <SurveyNavLink> — next-intl's locale-aware Link. Pass an
 *     UN-prefixed path ("/survey"); the locale prefix is added for you.
 *   • <SurveyLinkRaw>                — plain next/link, for the Hebrew-only
 *     marketing page whose hrefs are already prefixed ("/he/survey"). Using
 *     the locale-aware Link there would produce "/he/he/survey".
 *
 * The click handler never blocks navigation — see lib/analytics/survey-link.ts.
 */

type LocaleAwareLinkProps = ComponentProps<typeof Link>;

export type SurveyLinkProps = LocaleAwareLinkProps & {
  /** Where this link sits in the UI — becomes `link_location` on both events. */
  location: SurveyLinkLocation;
  children: ReactNode;
};

/** Narrow next-intl's locale string to the two values the events carry. */
function useEventLocale(): "he" | "en" {
  return useLocale() === "en" ? "en" : "he";
}

export function SurveyLink({
  location,
  children,
  onClick,
  ...rest
}: SurveyLinkProps) {
  const locale = useEventLocale();
  return (
    <Link
      {...rest}
      onClick={(e) => {
        trackSurveyLinkClick(location, locale);
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Pre-bound `location="nav"` variant. Shaped exactly like `<Link>` so a nav
 * loop that renders every pillar from one template can swap it in for the
 * survey row without duplicating the row's markup.
 */
export function SurveyNavLink(props: Omit<SurveyLinkProps, "location">) {
  return <SurveyLink location="nav" {...props} />;
}

export type SurveyLinkRawProps = ComponentProps<typeof NextLink> & {
  location: SurveyLinkLocation;
  children: ReactNode;
};

/** As above, but for an href that already carries its locale prefix. */
export function SurveyLinkRaw({
  location,
  children,
  onClick,
  ...rest
}: SurveyLinkRawProps) {
  const locale = useEventLocale();
  return (
    <NextLink
      {...rest}
      onClick={(e) => {
        trackSurveyLinkClick(location, locale);
        onClick?.(e);
      }}
    >
      {children}
    </NextLink>
  );
}
