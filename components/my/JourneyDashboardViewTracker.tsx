"use client";

/**
 * JourneyDashboardViewTracker — fires a single `journey_dashboard_viewed`
 * analytics event the first time the page mounts in a session. Renders
 * nothing.
 *
 * Why a separate component? /my/journey is a server component, but the
 * track() call needs to run in the browser (it reads cookies and posts
 * to /api/analytics/event). A thin client wrapper keeps the server
 * component pure and makes the analytics dependency obvious in the
 * page layout.
 */

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

export function JourneyDashboardViewTracker({
  hasJourneyEntitlement,
  hasCompletedAssessment,
  hasActiveAssignments,
  timelineSize,
  railIsDynamic,
  freshReplyCount,
}: {
  hasJourneyEntitlement: boolean;
  hasCompletedAssessment: boolean;
  hasActiveAssignments: boolean;
  timelineSize: number;
  railIsDynamic: boolean;
  freshReplyCount: number;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("journey_dashboard_viewed", {
      has_journey_entitlement: hasJourneyEntitlement,
      has_completed_assessment: hasCompletedAssessment,
      has_active_assignments: hasActiveAssignments,
      timeline_size: timelineSize,
      rail_is_dynamic: railIsDynamic,
      fresh_reply_count: freshReplyCount,
    });
  }, [
    hasJourneyEntitlement,
    hasCompletedAssessment,
    hasActiveAssignments,
    timelineSize,
    railIsDynamic,
    freshReplyCount,
  ]);
  return null;
}
