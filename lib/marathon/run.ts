import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  israelDate,
  israelHour,
  weekdayOf,
  marathonDayFor,
  slotHourForWeekday,
} from "./schedule";
import { getMarathonDayCopy } from "./copy";
import { sendMarathonDay } from "./send";

/**
 * Marathon daily dispatcher. Designed to run HOURLY (Israel hour is computed
 * here, DST-safe). For each active enrollment it sends the due day once its
 * weekday slot has arrived in Israel time, and marks the enrollment completed
 * after day 7. Idempotent: marathon_day_sends has a unique (enrollment, day),
 * and we skip any day already recorded, so re-runs / missed hours never double
 * send. Never throws per enrollment — one bad row can't stop the batch.
 */
export type MarathonRunResult = {
  ok: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  completed: number;
  errors: string[];
};

export async function runMarathonDispatch(opts: { limit?: number } = {}): Promise<MarathonRunResult> {
  const res: MarathonRunResult = {
    ok: true,
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
    errors: [],
  };

  const admin = createServiceRoleClient();
  if (!admin) {
    res.ok = false;
    res.errors.push("admin-client-unavailable");
    return res;
  }

  const today = israelDate();
  const hour = israelHour();
  const weekday = weekdayOf(today);
  const slot = slotHourForWeekday(weekday);

  const { data: enrollments, error } = await admin
    .from("marathon_enrollments")
    .select("id, phone, language, started_on, status")
    .eq("status", "active")
    .limit(opts.limit ?? 1000);

  if (error) {
    res.ok = false;
    res.errors.push(error.message);
    return res;
  }

  type Enr = {
    id: string;
    phone: string;
    language: string;
    started_on: string;
    status: string;
  };

  for (const enr of (enrollments ?? []) as Enr[]) {
    res.scanned += 1;
    try {
      const day = marathonDayFor(enr.started_on, today);

      if (day < 1) {
        res.skipped += 1; // not started yet
        continue;
      }
      if (day > 7) {
        await admin
          .from("marathon_enrollments")
          .update({ status: "completed" })
          .eq("id", enr.id);
        res.completed += 1;
        continue;
      }
      // Wait for the slot. `>=` (not `===`) so a delayed/missed hourly run still
      // sends later the same day, never before the slot.
      if (hour < slot) {
        res.skipped += 1;
        continue;
      }

      // Already sent this day? (idempotency)
      const { data: already } = await admin
        .from("marathon_day_sends")
        .select("id")
        .eq("enrollment_id", enr.id)
        .eq("day", day)
        .maybeSingle();
      if (already) {
        res.skipped += 1;
        continue;
      }

      const copy = await getMarathonDayCopy(day, enr.language);
      if (!copy) {
        res.skipped += 1;
        res.errors.push(`no-copy:day${day}`);
        continue;
      }

      const sent = await sendMarathonDay({
        phone: enr.phone,
        day,
        domain: copy.domain,
        activity: copy.activity,
        language: enr.language,
      });

      await admin
        .from("marathon_day_sends")
        .insert({
          enrollment_id: enr.id,
          day,
          wa_message_id: sent.waMessageId ?? null,
          status: sent.ok ? "sent" : "failed",
        })
        .then(() => undefined, () => undefined);

      if (sent.ok) {
        res.sent += 1;
        if (day === 7) {
          await admin
            .from("marathon_enrollments")
            .update({ status: "completed" })
            .eq("id", enr.id);
          res.completed += 1;
        }
      } else {
        res.failed += 1;
        res.errors.push(`send-failed:${enr.id}:${sent.reason ?? "?"}`);
      }
    } catch (err) {
      res.failed += 1;
      res.errors.push(
        `threw:${enr.id}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (res.failed > 0) res.ok = false;
  return res;
}
