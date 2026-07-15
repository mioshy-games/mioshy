/**
 * GET/POST /api/journey/d1-reminders
 *
 * Layer-3 first-week activation cron. Runs hourly. For every user
 * who has a day-1 unlocked item that's still unopened:
 *
 *   - 24-48h since unlock → send d1_morning reminder (once, ever)
 *   - 48-72h since unlock → send d2_evening reminder (once, ever)
 *
 * Idempotency is the journey_reminder_log composite-unique on
 * (user_id, scheduled_item_id, reminder_kind). Cron retries are
 * free.
 *
 * Schedule: vercel.json `0 * * * *` (every hour, top of hour).
 *
 * Auth: Bearer with the same shared cron secret pattern as
 * /api/journey/reminders.
 *
 * FU6.S2 — email wiring. After the log row is inserted (channel='email'),
 * we send the email through notifyUser, which handles Brevo + the
 * in-app journey_notifications row. Emails are best-effort: failures
 * log a warning but don't fail the cron run, and the log row is the
 * idempotency key so retries on transient email failures won't double-send.
 */

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { resolveUserLocale } from "@/lib/notifications/recipient-locale";
import { notifyUser } from "@/lib/journey-content/notifications";

interface Summary {
  ok:                boolean;
  d1_sent:           number;
  d2_sent:           number;
  considered:        number;
  errors:            string[];
}

const HOURS = (n: number) => n * 60 * 60 * 1000;

function authOk(req: Request): boolean {
  const expected =
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.JOURNEY_CADENCE_CRON_SECRET ||
    process.env.JOURNEY_UNLOCK_CRON_SECRET ||
    process.env.CARDCOM_CRON_SECRET;
  // No secret configured → allow only on localhost / preview.
  if (!expected) return process.env.VERCEL_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!authOk(req)) {
    return NextResponse.json(
      { ok: false, d1_sent: 0, d2_sent: 0, considered: 0, errors: ["unauthorized"] },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, d1_sent: 0, d2_sent: 0, considered: 0, errors: ["service_role_unavailable"] },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  let d1Sent = 0;
  let d2Sent = 0;
  let considered = 0;

  // Find candidate scheduled_items: has_unlock_override=true (day-1
  // override marker), seen_at IS NULL (not opened yet), and unlocked
  // recently. We deliberately limit the window to ≤ 96h to keep the
  // batch small and the latency tolerable.
  const now = Date.now();
  const earliestUnlockIso = new Date(now - HOURS(96)).toISOString();
  const latestUnlockIso   = new Date(now - HOURS(24)).toISOString();

  const { data: candidates, error: candErr } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id, item_id, unlock_at, seen_at")
    .eq("has_unlock_override", true)
    .is("seen_at", null)
    .gte("unlock_at", earliestUnlockIso)
    .lte("unlock_at", latestUnlockIso)
    .limit(500);

  if (candErr) {
    return NextResponse.json(
      { ok: false, d1_sent: 0, d2_sent: 0, considered: 0, errors: [candErr.message] },
      { status: 500 },
    );
  }
  considered = (candidates ?? []).length;

  // Resolve owner (user_id) per scheduled item via assignment.
  const assignmentIds = Array.from(
    new Set(((candidates ?? []) as Array<{ assignment_id: string }>).map((c) => c.assignment_id)),
  );
  const userByAssignment = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const { data: assignments } = await admin
      .from("journey_assignments")
      .select("id, user_id, couple_id")
      .in("id", assignmentIds);
    for (const a of (assignments ?? []) as Array<{
      id:        string;
      user_id:   string | null;
      couple_id: string | null;
    }>) {
      // Prefer user_id; for couple-owned, fan out to both members.
      if (a.user_id) {
        userByAssignment.set(a.id, a.user_id);
      }
    }
    // Couple-owned: fetch members.
    const coupleAssignments = ((assignments ?? []) as Array<{
      id:        string;
      user_id:   string | null;
      couple_id: string | null;
    }>).filter((a) => a.couple_id && !a.user_id);
    if (coupleAssignments.length > 0) {
      const coupleIds = coupleAssignments.map((a) => a.couple_id!) as string[];
      const { data: members } = await admin
        .from("couple_members")
        .select("couple_id, user_id")
        .in("couple_id", coupleIds);
      const memberByCouple = new Map<string, string[]>();
      for (const m of (members ?? []) as Array<{ couple_id: string; user_id: string }>) {
        const arr = memberByCouple.get(m.couple_id) ?? [];
        arr.push(m.user_id);
        memberByCouple.set(m.couple_id, arr);
      }
      for (const a of coupleAssignments) {
        const list = memberByCouple.get(a.couple_id!) ?? [];
        if (list.length > 0) {
          // For couples we attribute to the FIRST member as the
          // primary recipient. Both partners share the timeline so
          // either one opening will set seen_at.
          userByAssignment.set(a.id, list[0]);
        }
      }
    }
  }

  // Resolve item titles (HE) for the email preview, in one batch.
  const itemIds = Array.from(
    new Set(
      ((candidates ?? []) as Array<{ item_id: string | null }>)
        .map((c) => c.item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const titleByItem = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await admin
      .from("journey_items")
      .select("id, title_he")
      .in("id", itemIds);
    for (const it of (items ?? []) as Array<{ id: string; title_he: string | null }>) {
      if (it.title_he) titleByItem.set(it.id, it.title_he);
    }
  }

  // Per-cron email cap — Brevo / spam-protection guardrail.
  const EMAIL_CAP_PER_RUN = 100;
  let emailsSent = 0;

  // For each candidate, decide kind + check log + record.
  for (const cand of (candidates ?? []) as Array<{
    id:           string;
    assignment_id: string;
    item_id:       string | null;
    unlock_at:     string;
    seen_at:       string | null;
  }>) {
    const userId = userByAssignment.get(cand.assignment_id);
    if (!userId) continue;

    const ageMs = now - new Date(cand.unlock_at).getTime();
    const kind: "d1_morning" | "d2_evening" =
      ageMs >= HOURS(48) ? "d2_evening" : "d1_morning";

    // Idempotent insert: composite unique skips when already sent.
    // FU6.S2 — channel flips from 'in_app' to 'email' since we now
    // actually send through Brevo on success.
    const { error: insErr } = await admin.from("journey_reminder_log").insert({
      user_id:           userId,
      scheduled_item_id: cand.id,
      reminder_kind:     kind,
      channel:           "email",
    });

    if (insErr) {
      const msg = String(insErr.message || "");
      // Postgres unique-violation = duplicate; not an error to surface.
      if (!/duplicate|unique/i.test(msg)) {
        errors.push(`${kind}:${cand.id}:${msg}`);
        continue;
      }
      // Already sent — no double-counting.
      continue;
    }

    if (kind === "d1_morning") d1Sent++;
    else d2Sent++;

    // Email send — gated by per-run cap so we don't hammer Brevo on
    // a backlog. Best-effort: failures are logged but don't fail the
    // cron run (the log row is the source of truth for "already sent").
    if (emailsSent < EMAIL_CAP_PER_RUN) {
      try {
        const title = cand.item_id ? titleByItem.get(cand.item_id) ?? null : null;
        const href = `/${await resolveUserLocale(userId)}/journey/timeline/${cand.id}`;
        // Human-first copy — sounds like the coach left a quick
        // note, not the system. No "we released", no "system reminder".
        const subject =
          kind === "d1_morning"
            ? "מיאושי: הפריט שלכם מחכה"
            : "מיאושי: הפריט מחכה כבר יומיים";
        const preview =
          kind === "d1_morning"
            ? title
              ? `${title} — נפתח אצלכם אתמול. כמה דקות וזה מתחיל.`
              : "הפריט הראשון שלכם נפתח אתמול. כמה דקות וזה מתחיל."
            : title
              ? `${title} עדיין שם. אם הזמן לא היה מתאים אתמול — אולי הוא מתאים עכשיו.`
              : "הפריט עדיין שם. אם הזמן לא היה מתאים אתמול — אולי הוא מתאים עכשיו.";

        await notifyUser({
          recipientUserId: userId,
          kind: "reminder_inactivity",
          subject,
          payload: {
            href,
            preview,
          },
        });
        emailsSent++;
      } catch (e) {
        // Don't roll back the log row — keeping it idempotent is
        // worth more than retrying a flaky email send.
        console.warn("[d1-reminders] notifyUser threw", {
          user_id: userId,
          scheduled_item_id: cand.id,
          kind,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    d1_sent: d1Sent,
    d2_sent: d2Sent,
    considered,
    errors,
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
