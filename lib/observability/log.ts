/**
 * Structured logger for server-side code.
 *
 * Every log line is a single-line JSON-ish blob with a stable shape:
 *
 *   level=warn scope=shell.action event=chat.send.start user=abc dur_ms=42 ...
 *
 * Why this shape: Vercel's log viewer treats each console.log as a single
 * row. Single-line key=value (or JSON) is the easiest to filter on. A
 * search like `event=chat.send.failed` will surface every failed chat
 * send across all routes/users; `scope=shell.data` will surface the
 * shell-data render timings for any user.
 *
 * Levels:
 *   • error — something broke; an action failed, a query threw, etc.
 *   • warn  — slow path or unexpected-but-recoverable state.
 *   • info  — state changes worth seeing (auth resolved, action ok, …).
 *   • debug — opt-in via OBSERV_DEBUG=1; off by default.
 *
 * Each call ALSO writes the JSON object to stderr at error level so
 * Vercel's error-rate metric counts it. Info/warn go to stdout.
 *
 * Added 2026-05-31 (Itzik: "logs that help us locate every issue —
 * nothing is more or less important").
 */

import "server-only";

type Level = "error" | "warn" | "info" | "debug";

interface Fields {
  [k: string]: string | number | boolean | null | undefined;
}

const DEBUG_ON = process.env.OBSERV_DEBUG === "1";

function emit(level: Level, scope: string, event: string, fields: Fields) {
  if (level === "debug" && !DEBUG_ON) return;

  // Build a single-line key=value sequence. Strings with spaces or
  // special chars get JSON-quoted; primitives stay bare. This is the
  // shape Vercel's text search handles best (`event=chat.send.failed`).
  const parts: string[] = [`level=${level}`, `scope=${scope}`, `event=${event}`];
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null) continue;
    const v = typeof val === "string" ? safeQuote(val) : String(val);
    parts.push(`${key}=${v}`);
  }
  const line = parts.join(" ");

  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

function safeQuote(value: string): string {
  // If the value has any ws or = / " — JSON-quote it so the line stays
  // unambiguously parseable. Otherwise leave it bare.
  if (/[\s="]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Factory — locks a scope name so the call sites stay short.
 *
 *   const log = makeLogger("shell.action.chat");
 *   log.info("send.start", { userId, bodyLen: trimmed.length });
 *   log.error("send.failed", { userId, reason: "profile_incomplete" });
 *
 * Pass userId/coupleId/itemId etc. as fields so the filter pipeline can
 * find every line related to a single user incident.
 */
export function makeLogger(scope: string) {
  return {
    error: (event: string, fields: Fields = {}) => emit("error", scope, event, fields),
    warn:  (event: string, fields: Fields = {}) => emit("warn",  scope, event, fields),
    info:  (event: string, fields: Fields = {}) => emit("info",  scope, event, fields),
    debug: (event: string, fields: Fields = {}) => emit("debug", scope, event, fields),
  };
}

/**
 * Time an async block. Wraps the body, captures elapsed ms, and emits a
 * single `event=<event>` line with `dur_ms=<n>` and `ok=<bool>`.
 *
 *   const result = await timed(log, "fetch.thread", async () => {
 *     return await getThread(userId);
 *   }, { userId });
 *
 * On throw, re-throws the error after logging `ok=false` + the message.
 * The SLOW_THRESHOLD_MS knob (default 500) bumps a successful slow call
 * to warn level so it shows up alongside real failures.
 */
const SLOW_THRESHOLD_MS = Number(process.env.OBSERV_SLOW_MS || 500);

export async function timed<T>(
  log: ReturnType<typeof makeLogger>,
  event: string,
  body: () => Promise<T>,
  fields: Fields = {},
): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await body();
    const dur = Date.now() - t0;
    const level: Level = dur > SLOW_THRESHOLD_MS ? "warn" : "info";
    if (level === "warn") {
      log.warn(event, { ...fields, ok: true, dur_ms: dur, slow: true });
    } else {
      log.info(event, { ...fields, ok: true, dur_ms: dur });
    }
    return out;
  } catch (err) {
    const dur = Date.now() - t0;
    log.error(event, {
      ...fields,
      ok: false,
      dur_ms: dur,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
