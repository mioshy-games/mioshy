/**
 * Loads the per-user behavior analytics shown on /dashboard/users/[id]
 * (admin-analytics-spec §7.2, Phase 3).
 *
 * Reads the Phase-2 views + analytics_events + auth_login_events + the journey
 * tables. These are RLS-locked to service_role, so this loader MUST be called
 * with the service-role client (createServiceRoleClient) from a server context
 * already gated by requireAdmin(). Metadata only — no intimate content (privacy
 * approach A, §10.1); response/message text stays in the existing threads.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const ABANDON_CHAPTER_DAYS = 7; // §10.4
const JERUSALEM_TZ = "Asia/Jerusalem";

export type LoginRow = { at: string; ua: string | null; country: string | null };

export type DwellRow = { pillar: string; events: number; totalMs: number };

export type TimelineRow = {
  at: string;
  event: string;
  pillar: string | null;
  ref: string | null;
};

export type GamesSummary = {
  snakes: { sessions: number; completed: number; abandoned: number; avgDurationMs: number | null };
  wheel: { sessions: number; abandoned: number; avgDurationMs: number | null; totalSpins: number };
};

export type AdultGameRow = { key: string; opens: number; lastAt: string };

export type ChapterStuck = { scheduledItemId: string; openedAt: string };

export type UserBehavior = {
  logins: LoginRow[];
  loginSummary: { count: number; first: string | null; last: string | null; lastCountry: string | null };
  /** 24 buckets, index = hour-of-day in Asia/Jerusalem. */
  hourHistogram: number[];
  dwell: DwellRow[];
  adultsDwellMs: number;
  timeline: TimelineRow[];
  games: GamesSummary;
  adults: AdultGameRow[];
  abandonment: { chapters: ChapterStuck[]; checkoutSessions: number; snakesAbandoned: number };
  coupleId: string | null;
};

type EventRow = {
  event: string;
  properties: Record<string, unknown> | null;
  session_id: string | null;
  created_at: string;
};

const PILLAR_EVENTS = [
  "game_start",
  "game_completed",
  "game_abandoned",
  "adult_game_opened",
  "checkout_started",
  "subscription_activated",
  "service_opened",
  "dwell",
] as const;

function jerusalemHour(iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: JERUSALEM_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  // "24" can appear for midnight in some runtimes → normalise to 0.
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n % 24 : 0;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function loadUserBehavior(
  admin: SupabaseClient,
  userId: string,
): Promise<UserBehavior> {
  const [
    { data: loginsRaw },
    { data: dwellRaw },
    { data: eventsRaw },
    { data: openedRaw },
    { data: completedRaw },
    { data: coupleRaw },
  ] = await Promise.all([
    admin
      .from("auth_login_events")
      .select("created_at, device_info, country")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("v_service_dwell")
      .select("pillar, dwell_events, total_ms")
      .eq("user_id", userId),
    admin
      .from("analytics_events")
      .select("event, properties, session_id, created_at")
      .eq("user_id", userId)
      .in("event", PILLAR_EVENTS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("journey_user_activity")
      .select("scheduled_item_id, created_at")
      .eq("user_id", userId)
      .eq("verb", "item_opened")
      .not("scheduled_item_id", "is", null),
    admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .eq("completed_by", userId),
    admin
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Logins + hour heatmap ──────────────────────────────────────────────────
  const logins: LoginRow[] = (loginsRaw ?? []).map((r) => ({
    at: r.created_at as string,
    ua: str((r.device_info as { ua?: unknown } | null)?.ua),
    country: str(r.country),
  }));
  const hourHistogram = Array.from({ length: 24 }, () => 0);
  for (const l of logins) hourHistogram[jerusalemHour(l.at)] += 1;
  const loginSummary = {
    count: logins.length,
    last: logins[0]?.at ?? null,
    first: logins[logins.length - 1]?.at ?? null,
    lastCountry: logins.find((l) => l.country)?.country ?? null,
  };

  // ── Dwell per pillar ───────────────────────────────────────────────────────
  const dwell: DwellRow[] = (dwellRaw ?? []).map((r) => ({
    pillar: (r.pillar as string) ?? "—",
    events: Number(r.dwell_events ?? 0),
    totalMs: Number(r.total_ms ?? 0),
  }));
  const adultsDwellMs = dwell.find((d) => d.pillar === "adults")?.totalMs ?? 0;

  const events = (eventsRaw ?? []) as EventRow[];

  // ── Cross-pillar timeline (most recent 40) ─────────────────────────────────
  const timeline: TimelineRow[] = events.slice(0, 40).map((e) => ({
    at: e.created_at,
    event: e.event,
    pillar: str(e.properties?.pillar),
    ref:
      str(e.properties?.item_id) ??
      str(e.properties?.game_slug) ??
      str(e.properties?.game_id) ??
      str(e.properties?.slug),
  }));

  // ── Group analytics_events by session for game/checkout aggregates ──────────
  type Session = { events: EventRow[] };
  const sessions = new Map<string, Session>();
  for (const e of events) {
    if (!e.session_id) continue;
    const s = sessions.get(e.session_id) ?? { events: [] };
    s.events.push(e);
    sessions.set(e.session_id, s);
  }

  const snakesDur: number[] = [];
  const wheelDur: number[] = [];
  let snakesSessions = 0, snakesCompleted = 0, snakesAbandoned = 0;
  let wheelSessions = 0, wheelAbandoned = 0, wheelSpins = 0;
  let checkoutSessions = 0;

  for (const { events: ev } of sessions.values()) {
    const has = (p: (e: EventRow) => boolean) => ev.some(p);
    const isSnakesStart = (e: EventRow) =>
      e.event === "game_start" && str(e.properties?.game_type) === "snakes";
    const isWheelStart = (e: EventRow) =>
      e.event === "game_start" && str(e.properties?.game_type) === "wheel";

    if (has(isSnakesStart)) {
      snakesSessions += 1;
      if (has((e) => e.event === "game_completed")) {
        snakesCompleted += 1;
        const d = num(ev.find((e) => e.event === "game_completed")?.properties?.duration_ms);
        if (d !== null) snakesDur.push(d);
      } else {
        snakesAbandoned += 1;
        const d = num(ev.find((e) => e.event === "game_abandoned")?.properties?.duration_ms);
        if (d !== null) snakesDur.push(d);
      }
    }
    if (has(isWheelStart)) {
      wheelSessions += 1;
      const ab = ev.find((e) => e.event === "game_abandoned");
      if (ab) {
        wheelAbandoned += 1;
        const d = num(ab.properties?.duration_ms);
        if (d !== null) wheelDur.push(d);
        const sp = num(ab.properties?.spins);
        if (sp !== null) wheelSpins += sp;
      }
    }
    // checkout abandonment: started, never activated (same session)
    if (has((e) => e.event === "checkout_started") &&
        !has((e) => e.event === "subscription_activated")) {
      checkoutSessions += 1;
    }
  }

  const games: GamesSummary = {
    snakes: {
      sessions: snakesSessions,
      completed: snakesCompleted,
      abandoned: snakesAbandoned,
      avgDurationMs: avg(snakesDur),
    },
    wheel: {
      sessions: wheelSessions,
      abandoned: wheelAbandoned,
      avgDurationMs: avg(wheelDur),
      totalSpins: wheelSpins,
    },
  };

  // ── Adults: opens grouped by game (slug → id fallback) ─────────────────────
  const adultsMap = new Map<string, { opens: number; lastAt: string }>();
  for (const e of events) {
    if (e.event !== "adult_game_opened") continue;
    const key = str(e.properties?.slug) ?? str(e.properties?.game_id) ?? "—";
    const cur = adultsMap.get(key) ?? { opens: 0, lastAt: e.created_at };
    cur.opens += 1;
    if (e.created_at > cur.lastAt) cur.lastAt = e.created_at;
    adultsMap.set(key, cur);
  }
  const adults: AdultGameRow[] = Array.from(adultsMap.entries())
    .map(([key, v]) => ({ key, opens: v.opens, lastAt: v.lastAt }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  // ── Chapter abandonment: opened, never completed, older than threshold ─────
  const completedIds = new Set(
    (completedRaw ?? []).map((r) => r.scheduled_item_id as string),
  );
  const openedFirst = new Map<string, string>();
  for (const r of openedRaw ?? []) {
    const id = r.scheduled_item_id as string;
    const at = r.created_at as string;
    const prev = openedFirst.get(id);
    if (!prev || at < prev) openedFirst.set(id, at);
  }
  const cutoff = Date.now() - ABANDON_CHAPTER_DAYS * 24 * 60 * 60 * 1000;
  const chapters: ChapterStuck[] = Array.from(openedFirst.entries())
    .filter(([id, at]) => !completedIds.has(id) && new Date(at).getTime() < cutoff)
    .map(([scheduledItemId, openedAt]) => ({ scheduledItemId, openedAt }))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));

  return {
    logins,
    loginSummary,
    hourHistogram,
    dwell,
    adultsDwellMs,
    timeline,
    games,
    adults,
    abandonment: { chapters, checkoutSessions, snakesAbandoned },
    coupleId: (coupleRaw?.couple_id as string | undefined) ?? null,
  };
}
