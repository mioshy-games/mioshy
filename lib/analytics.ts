/**
 * Mioshy Product Analytics
 * ────────────────────────
 * Lightweight internal analytics layer backed by Supabase (no third-party
 * trackers - see privacy policy).
 *
 * Usage (client components):
 *   import { track } from "@/lib/analytics";
 *   track("game_start", { game_type: "snakes", mode: "local" });
 *
 * The call is fire-and-forget - it never throws and never blocks UI.
 *
 * In development, events are also printed to the console (debug mode).
 */

// ─── Event catalogue ─────────────────────────────────────────────────────────
// Keep this in sync with the analytics_events table columns.

export type AnalyticsEvent =
  // Acquisition
  | "page_view"

  // Games
  | "game_lobby_opened"        // user lands on /game
  | "game_start"               // game begins (after host presses Start)
  | "game_question_answered"   // any question answered during play
  | "game_completed"           // game ends (winner declared or exit)
  | "game_abandoned"           // user exits mid-game

  // Journey / assessment
  | "journey_started"
  | "journey_question_answered"
  | "journey_auth_gate_shown"  // registration step shown
  | "journey_completed"        // all questions answered

  // Auth
  | "registration_started"     // user opens registration form
  | "registration_completed"   // user successfully signed up

  // Billing
  | "paywall_shown"
  | "checkout_started"
  | "subscription_activated"
  | "subscription_cancelled"

  // Homepage V2 (new marketing surface)
  | "home_v2_section_viewed"   // user scrolled a v2 section into view
  | "home_v2_cta_click";       // user clicked any v2 CTA - see properties for which

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

// ─── Session ID ───────────────────────────────────────────────────────────────
// A random ID per browser tab that helps group events into a session without
// relying on cookies. Survives navigations within the same tab.

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "ssr";
  const KEY = "_mioshy_sid";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

// ─── Device ID helper (reads the cookie set by device-id.ts) ─────────────────
function readDeviceId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )mioshy_device_id=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ─── Core track function ──────────────────────────────────────────────────────

const DEBUG = process.env.NODE_ENV === "development";

/**
 * Fire-and-forget analytics event.
 *
 * @param event  - One of the AnalyticsEvent strings
 * @param props  - Additional key-value context
 */
export function track(event: AnalyticsEvent, props: EventProperties = {}): void {
  if (typeof window === "undefined") return; // no-op during SSR

  // Merge standard context into properties
  const payload = {
    event,
    session_id: getSessionId(),
    device_id: readDeviceId(),
    locale:
      // Extract from pathname: /he/... or /en/...
      window.location.pathname.match(/^\/(he|en)\//)?.[1] ?? null,
    properties: {
      path: window.location.pathname,
      ...props,
    },
  };

  if (DEBUG) {
    console.debug("[analytics]", payload.event, payload.properties);
  }

  // Fire-and-forget - never await, never throw into the caller
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // keepalive lets the request survive page navigation
    keepalive: true,
  }).catch(() => {
    /* silently swallow - analytics must never break the app */
  });
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Page view (call from layout or page useEffect) */
export function trackPageView(props: EventProperties = {}): void {
  track("page_view", props);
}

/** Quick helper for game events */
export function trackGame(
  event: Extract<
    AnalyticsEvent,
    | "game_lobby_opened"
    | "game_start"
    | "game_question_answered"
    | "game_completed"
    | "game_abandoned"
  >,
  props: EventProperties & { game_type?: string; mode?: string } = {},
): void {
  track(event, props);
}

/** Quick helper for journey events */
export function trackJourney(
  event: Extract<
    AnalyticsEvent,
    | "journey_started"
    | "journey_question_answered"
    | "journey_auth_gate_shown"
    | "journey_completed"
  >,
  props: EventProperties = {},
): void {
  track(event, props);
}
