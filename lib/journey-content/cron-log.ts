// ============================================================
// cron-log.ts - write a journey_cron_runs row at the end of every
// cron run, no matter how it terminated. Slice 9 observability.
//
// Usage from a cron route handler:
//
//   const result = await runWithCronLog("cadence_advance", async () => {
//     // ...do the work
//     return { rowsProcessed: 17, payload: { delivered: 17, skipped: 4 } };
//   });
//
// Always logs - successes (ok=true), thrown errors (ok=false +
// error_text), and partial-success cases where the wrapped function
// returned `ok: false` explicitly. Never throws back to the caller
// from the log step itself; if the insert fails the cron's outcome
// is preserved and the failure is just console.error'd.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { notifyAdminPool } from "./notifications";

export type CronJobName =
  | "cadence_advance"
  | "notify_unlocks"
  | "grace_watcher"
  | "scores_recompute"
  | "reminders";

export interface CronLogPayload {
  /** Free-form job-specific details. Stored in journey_cron_runs.payload. */
  payload?: Record<string, unknown>;
  /** Count surfaced in the health board (e.g. items delivered). */
  rowsProcessed?: number;
  /** When set, marks the run as failed and stores the message in error_text.
   *  Used by jobs that want to report partial-success / known-error cases
   *  without throwing. */
  error?: string;
}

/**
 * Wrap a cron job's body. The fn receives nothing (the body should
 * close over its own context); it returns either a success summary
 * (`{ payload, rowsProcessed }`) or a failure summary (`{ error }`).
 * Thrown errors are caught and logged as `ok=false`.
 */
export async function runWithCronLog<T extends CronLogPayload>(
  jobName: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  let result: T;
  let okFlag = true;
  let errorText: string | null = null;
  try {
    result = await fn();
    if (typeof result.error === "string" && result.error.length > 0) {
      okFlag = false;
      errorText = result.error;
    }
  } catch (e) {
    okFlag = false;
    errorText = e instanceof Error ? e.message : String(e);
    // Re-throw AFTER logging so the route's error handling still runs.
    await writeRow(jobName, startedAt, okFlag, 0, errorText, {
      thrown: true,
    });
    throw e;
  }

  await writeRow(
    jobName,
    startedAt,
    okFlag,
    result.rowsProcessed ?? 0,
    errorText,
    result.payload ?? {},
  );
  return result;
}

async function writeRow(
  jobName: CronJobName,
  startedAt: Date,
  ok: boolean,
  rowsProcessed: number,
  errorText: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    console.warn(
      "[cron-log] no admin client - skipping log row",
      jobName,
    );
    return;
  }
  const { error } = await admin.from("journey_cron_runs").insert({
    job_name: jobName,
    started_at: startedAt.toISOString(),
    // finished_at defaults to now() in the schema; we let Postgres set it
    // so it's the authoritative server time.
    ok,
    rows_processed: Math.max(0, Math.floor(rowsProcessed)),
    error_text: errorText,
    payload,
  });
  if (error) {
    // Logging failure must never break the cron itself.
    console.error("[cron-log] insert failed", { jobName, error });
  }

  // Slice 10 - surface failures to the admin pool. Throttled to one
  // email per job per 6h (per Itzik's brief), but the in-app log row
  // is always written so the health page banner shows every failure.
  if (!ok) {
    try {
      await notifyAdminPool({
        kind: "cron_failure",
        subject: `Mioshy admin: cron ${jobName} failed`,
        throttleHours: 6,
        throttleKey: jobName,
        payload: {
          throttle_key: jobName,
          job_name: jobName,
          finished_at: new Date().toISOString(),
          error_text: errorText,
          rows_processed: rowsProcessed,
          context_label: `Cron job ${jobName} reported a failure`,
          preview: errorText ?? "(no error text)",
          href: "/dashboard/journey/health",
        },
      });
    } catch (notifyErr) {
      console.error(
        "[cron-log] notifyAdminPool failed - non-fatal",
        notifyErr,
      );
    }
  }
}
