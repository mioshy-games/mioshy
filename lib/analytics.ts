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

  // Journey post-purchase (private space + therapeutic dashboard)
  | "journey_dashboard_viewed"      // user landed on /my/journey
  | "journey_rail_pill_clicked"     // user clicked a clickable rail pill
  | "journey_priority_reordered"    // user moved a priority up/down
  | "journey_priority_added"        // user added a custom priority
  | "journey_priority_removed"      // user removed a custom priority
  | "journey_message_to_expert_sent" // user sent a free-text note to clinician
  | "journey_response_submitted"     // user submitted a response on an item
  | "journey_assessment_submitted"   // user submitted a structured assessment

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
  | "home_v2_cta_click"        // user clicked any v2 CTA - see properties for which

  // ── Behavior analytics (admin-analytics-spec §5.1) ────────────────────────
  // Cross-pillar instrumentation feeding the per-user behavior dashboard.
  // Metadata-only by design (privacy approach A, spec §10.1) - never carry
  // intimate content (response text, adult content) in `properties`.
  | "service_opened"           // entered a pillar surface: { pillar, surface, item_id? }
  | "chapter_opened"           // journey chapter opened (unified-events option; journey
                               // already covered by journey_user_activity - reserved)
  | "adult_game_opened"        // adults: experience game opened: { game_id, ... }
  | "adult_level_viewed"       // adults: a level viewed: { game_id, level }
  | "dwell"                    // dwell heartbeat (useDwellTracking): { pillar, path, ms, item_id? }
  | "abandoned"                // unified abandonment: { context, ref_id, last_step }
  | "click";                   // marked-element click (not blanket): { target, pillar, path }

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

const INTAKE_URL = "/api/analytics/event";

/**
 * Build the wire payload shared by every send path (fetch + sendBeacon).
 * Centralises the session_id / device_id / locale enrichment so the dwell
 * hook's beacon and the regular `track()` call produce identical rows.
 */
function buildPayload(event: AnalyticsEvent, props: EventProperties) {
  return {
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
}

/**
 * Fire-and-forget analytics event.
 *
 * @param event  - One of the AnalyticsEvent strings
 * @param props  - Additional key-value context
 */
export function track(event: AnalyticsEvent, props: EventProperties = {}): void {
  if (typeof window === "undefined") return; // no-op during SSR

  const payload = buildPayload(event, props);

  if (DEBUG) {
    console.debug("[analytics]", payload.event, payload.properties);
  }

  // Fire-and-forget - never await, never throw into the caller
  void fetch(INTAKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // keepalive lets the request survive page navigation
    keepalive: true,
  }).catch(() => {
    /* silently swallow - analytics must never break the app */
  });
}

/**
 * Beacon-based event send, for use during page-hide / unload where a normal
 * fetch may be cancelled. Prefers `navigator.sendBeacon` (queued by the
 * browser, survives navigation) and falls back to `fetch(..., keepalive)`.
 *
 * Used by `useDwellTracking` to flush the final dwell span. Same payload
 * shape as `track()`, so it lands in `analytics_events` identically and the
 * edge route still resolves the user from the (same-origin) session cookie.
 */
export function sendBeaconEvent(
  event: AnalyticsEvent,
  props: EventProperties = {},
): void {
  if (typeof window === "undefined") return;

  const payload = buildPayload(event, props);

  if (DEBUG) {
    console.debug("[analytics:beacon]", payload.event, payload.properties);
  }

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // sendBeacon sends text/plain by default; the intake route reads
      // req.json() which parses the body regardless of content-type.
      const ok = navigator.sendBeacon(INTAKE_URL, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    // Fallback: keepalive fetch (best-effort during unload).
    void fetch(INTAKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the app */
  }
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
