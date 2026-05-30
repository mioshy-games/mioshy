/**
 * lib/dashboard/pillar-state.ts
 *
 * Pure functions that map (entitlements + journey status) to the
 * single state badge and CTA copy on each pillar card. No DB calls
 * here - that's the page's job. This file just turns inputs into the
 * three things the UI needs:
 *
 *   - state:    "open" | "in_progress" | "not_purchased"  (§3)
 *   - ctaLabel: localized button text                     (§5)
 *   - ctaHref:  where the button takes the user
 *
 * Why pure: it's easy to unit-test, and it kills the scatter of
 * `if (entitlements.x) { ... } else { ... }` we had inline on /my.
 *
 * MVP rule (per docs/my-page-redesign-spec.md §0): we only handle
 * the three "open / in_progress / not_purchased" states. No
 * COMING_SOON, no UNAVAILABLE - those were over-engineering.
 */

import type { PillarStateKind } from "@/components/ui/StateBadge"

export type PillarKey = "games" | "journey" | "adults"

/**
 * Assessment stage - only meaningful for the Journey pillar.
 * Derived from the legacy `journeys` table, not from the new
 * journey_assignments. The "completed" stage means the user finished
 * the questionnaire; whether or not the clinician has attached
 * follow-up content is a separate axis (hasActiveAssignments).
 */
export type AssessmentStage = "not_started" | "in_progress" | "completed"

export interface PillarStateInputs {
  pillar: PillarKey
  entitlement: boolean

  // Journey only
  hasActiveAssignments?: boolean
  assessmentStage?: AssessmentStage

  // Locale
  isHe: boolean
}

export interface PillarStateOutput {
  state: PillarStateKind
  ctaLabel: string
  ctaHref: string
}

/**
 * Top-level: derive the state + CTA for a single pillar card.
 */
export function derivePillarState(input: PillarStateInputs): PillarStateOutput {
  switch (input.pillar) {
    case "journey":
      return deriveJourneyState(input)
    case "games":
      return deriveGamesState(input)
    case "adults":
      return deriveAdultsState(input)
  }
}

// ─────────────────────────────────────────────────────────────────────
// Journey - the most nuanced one (per spec §5)
// ─────────────────────────────────────────────────────────────────────

function deriveJourneyState(input: PillarStateInputs): PillarStateOutput {
  const { entitlement, hasActiveAssignments, assessmentStage, isHe } = input

  // No subscription → marketing entry. Per Itzik 2026-05-06 the
  // generic "Discover" was too vague — replaced with action-language
  // that signals what happens next on click.
  if (!entitlement) {
    return {
      state: "not_purchased",
      ctaLabel: isHe ? "להתחיל את הליווי" : "Start coaching",
      ctaHref: "/journey",
    }
  }

  // Has active program → enter directly
  if (hasActiveAssignments) {
    return {
      state: "open",
      ctaLabel: isHe ? "כניסה לחדר הפרטי" : "Enter your private space",
      ctaHref: "/my/journey",
    }
  }

  // Stage-dependent labels per §5
  //
  // Itzik 2026-05-29: simplified to two-state — paid users ALWAYS see
  // "פתוח", regardless of assessment progress. The earlier "in_progress"
  // badge confused users into thinking their *subscription* was being
  // processed, when in fact the subscription was already active and the
  // only thing pending was the assessment itself. The CTA still routes
  // them to the right place (resume assessment / enter coaching) so no
  // funnel step is lost.
  switch (assessmentStage) {
    case "completed":
      // Welcome, never re-invite.
      return {
        state: "open",
        ctaLabel: isHe ? "כניסה לליווי עם מיאושי" : "Enter coaching with Mioshy",
        ctaHref: "/my/journey",
      }
    case "in_progress":
      // Paid, mid-assessment — still "open"; CTA continues the assessment.
      return {
        state: "open",
        ctaLabel: isHe ? "להמשיך אבחון" : "Continue assessment",
        ctaHref: "/journey/assessment",
      }
    case "not_started":
    default:
      return {
        state: "open",
        ctaLabel: isHe ? "להתחיל אבחון" : "Start assessment",
        ctaHref: "/journey/assessment",
      }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Games - light, two-state
// ─────────────────────────────────────────────────────────────────────

function deriveGamesState(input: PillarStateInputs): PillarStateOutput {
  const { entitlement, isHe } = input
  if (!entitlement) {
    return {
      state: "not_purchased",
      ctaLabel: isHe ? "לפתוח את המשחקים" : "Open the games",
      ctaHref: "/games",
    }
  }
  return {
    state: "open",
    ctaLabel: isHe ? "המשחקים שלי" : "My games",
    ctaHref: "/my/games",
  }
}

// ─────────────────────────────────────────────────────────────────────
// Adults - light, two-state
// ─────────────────────────────────────────────────────────────────────

function deriveAdultsState(input: PillarStateInputs): PillarStateOutput {
  const { entitlement, isHe } = input
  if (!entitlement) {
    return {
      state: "not_purchased",
      ctaLabel: isHe ? "לבחור משחק" : "Pick a game",
      ctaHref: "/mioshy-sex",
    }
  }
  return {
    state: "open",
    ctaLabel: isHe ? "הרכישות שלי" : "My purchases",
    ctaHref: "/my/adults",
  }
}
