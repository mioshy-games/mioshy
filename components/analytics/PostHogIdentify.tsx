"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Ties a PostHog person to the logged-in Mioshy user — by user id ONLY.
 *
 * We deliberately pass NO email / name / phone. For an intimate-content
 * product the analytics identity should be a pseudonymous key, not PII; the
 * user id is enough to stitch sessions across devices and is already a random
 * UUID. If you ever need to look someone up by email, do it in Supabase, not
 * in PostHog.
 *
 * Renders nothing. Mounted from app/[locale]/layout.tsx where the request user
 * is already resolved, so it costs no extra round-trip.
 *
 *   • userId present  → identify() once (no-op if already identified to same id)
 *   • userId null     → reset() so a logout doesn't bleed the previous person
 *                       into the next anonymous session on a shared device.
 */
export function PostHogIdentify({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    const apply = () => {
      if (userId) {
        if (posthog.get_distinct_id() !== userId) posthog.identify(userId);
      } else {
        posthog.reset();
      }
    };

    // posthog init is deferred to the browser idle window, so on first mount it
    // may not be loaded yet. Poll briefly until it is, then apply once.
    if ((posthog as any).__loaded) {
      apply();
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if ((posthog as any).__loaded) {
        clearInterval(timer);
        apply();
      } else if (tries > 40) {
        clearInterval(timer); // give up after ~10s
      }
    }, 250);
    return () => clearInterval(timer);
  }, [userId]);

  return null;
}
