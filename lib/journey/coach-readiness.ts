/**
 * lib/journey/coach-readiness.ts
 *
 * Phase 8 — coach onboarding readiness check. Powers the checklist on
 * /dashboard (the coach landing page).
 *
 * Returns a status object the dashboard can render as a "next steps"
 * checklist + a today's queue summary so the coach hits the dashboard
 * and immediately knows:
 *   1. What setup they still need to do (one-time onboarding).
 *   2. What needs their attention RIGHT NOW (recurring queue).
 *
 * Server-only.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

export interface ReadinessMilestone {
  /** Stable key — used as React key + for analytics. */
  key:           string;
  /** Hebrew label, sentence-case. */
  label_he:      string;
  /** Short rationale (why it matters). */
  why_he:        string;
  /** Where to go to complete it. */
  href:          string;
  /** Whether the milestone is currently met. */
  done:          boolean;
}

export interface CoachQueueSummary {
  /** Couples linked to this coach (active expert_couples links). */
  totalCouples:    number;
  /** Couples in drifting + silent state. */
  needsCheckIn:    number;
  /** Open per-item threads (latest message from user, no coach reply yet). */
  openThreads:     number;
  /** Urgent + concerning user messages (Phase 4 classifier). */
  urgentMessages:  number;
  /** Couples whose latest user response is older than 48h
   *  with no coach response — SLA breach. */
  slaBreaches:     number;
}

export interface CoachReadiness {
  milestones: ReadinessMilestone[];
  /** Count of milestones still TODO. */
  todoCount:  number;
  queue:      CoachQueueSummary;
  /** The coach's display name (HE) or null if persona not set. */
  displayName: string | null;
}

/**
 * Build the full readiness snapshot for one coach. Single function
 * because every metric is small and the dashboard needs them all
 * at once — fanning out into separate helpers is overkill.
 */
export async function getCoachReadiness(
  expertId: string,
): Promise<CoachReadiness> {
  const admin = await createAdminClient();
  const now = Date.now();
  const fortyEightHoursAgo = new Date(now - 48 * 3600_000).toISOString();

  // ── Persona ──────────────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "coach_display_name_he, coach_short_bio_he, coach_avatar_url",
    )
    .eq("id", expertId)
    .maybeSingle();
  const p = profile as {
    coach_display_name_he: string | null;
    coach_short_bio_he:    string | null;
    coach_avatar_url:      string | null;
  } | null;
  const personaComplete =
    !!(p?.coach_display_name_he?.trim()) &&
    !!(p?.coach_short_bio_he?.trim());
  const personaHasAvatar = !!(p?.coach_avatar_url?.trim());

  // ── Library size ─────────────────────────────────────────────
  const { count: libCount } = await admin
    .from("journey_expert_library")
    .select("id", { head: true, count: "exact" })
    .eq("expert_id", expertId);

  // ── Linked couples ───────────────────────────────────────────
  const { data: links } = await admin
    .from("expert_couples")
    .select("couple_id")
    .eq("expert_id", expertId)
    .eq("is_active", true);
  const coupleIds = ((links ?? []) as Array<{ couple_id: string }>).map(
    (l) => l.couple_id,
  );

  // ── Drift cohort ─────────────────────────────────────────────
  let needsCheckIn = 0;
  if (coupleIds.length > 0) {
    const { data: drift } = await admin
      .from("journey_drift_alerts")
      .select("state, couple_id, coach_checked_in_at")
      .in("couple_id", coupleIds)
      .neq("state", "active")
      .is("coach_checked_in_at", null);
    needsCheckIn = (drift ?? []).length;
  }

  // ── Open threads + SLA breaches ──────────────────────────────
  // Strategy: pull recent user messages tied to scheduled items in
  // this coach's couples. For each, see if there's a newer coach
  // reply. If not → open. If older than 48h and no reply → SLA breach.
  let openThreads = 0;
  let slaBreaches = 0;
  if (coupleIds.length > 0) {
    const { data: assignments } = await admin
      .from("journey_assignments")
      .select("id")
      .in("couple_id", coupleIds)
      .eq("is_active", true);
    const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
      (a) => a.id,
    );
    if (assignmentIds.length > 0) {
      const { data: scheduled } = await admin
        .from("journey_scheduled_items")
        .select("id")
        .in("assignment_id", assignmentIds);
      const schedIds = ((scheduled ?? []) as Array<{ id: string }>).map(
        (r) => r.id,
      );
      if (schedIds.length > 0) {
        const { data: messages } = await admin
          .from("journey_messages")
          .select("scheduled_item_id, author_kind, created_at")
          .in("scheduled_item_id", schedIds)
          .order("created_at", { ascending: false });
        const latestByItem = new Map<
          string,
          { author_kind: string; created_at: string }
        >();
        for (const m of (messages ?? []) as Array<{
          scheduled_item_id: string;
          author_kind: string;
          created_at: string;
        }>) {
          if (!latestByItem.has(m.scheduled_item_id)) {
            latestByItem.set(m.scheduled_item_id, {
              author_kind: m.author_kind,
              created_at: m.created_at,
            });
          }
        }
        for (const [, latest] of latestByItem) {
          if (latest.author_kind === "user") {
            openThreads++;
            if (latest.created_at < fortyEightHoursAgo) slaBreaches++;
          }
        }
      }
    }
  }

  // ── Urgent / concerning messages ─────────────────────────────
  let urgentMessages = 0;
  if (coupleIds.length > 0) {
    // Couple-channel rows
    const { count: ccCount } = await admin
      .from("journey_couple_channel_messages")
      .select("id", { head: true, count: "exact" })
      .eq("author_kind", "partner")
      .in("couple_id", coupleIds)
      .in("sentiment", ["urgent", "concerning"]);
    urgentMessages += ccCount ?? 0;

    // Per-item / channel rows — need the scheduled-item join already
    // computed above. We re-pull lightweight here for accuracy.
    const { data: assignments } = await admin
      .from("journey_assignments")
      .select("id")
      .in("couple_id", coupleIds)
      .eq("is_active", true);
    const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
      (a) => a.id,
    );
    if (assignmentIds.length > 0) {
      const { data: sched } = await admin
        .from("journey_scheduled_items")
        .select("id")
        .in("assignment_id", assignmentIds);
      const schedIds = ((sched ?? []) as Array<{ id: string }>).map(
        (r) => r.id,
      );
      if (schedIds.length > 0) {
        const { count: jmCount } = await admin
          .from("journey_messages")
          .select("id", { head: true, count: "exact" })
          .eq("author_kind", "user")
          .in("scheduled_item_id", schedIds)
          .in("sentiment", ["urgent", "concerning"]);
        urgentMessages += jmCount ?? 0;
      }
    }
  }

  // ── Build milestones list ────────────────────────────────────
  const milestones: ReadinessMilestone[] = [
    {
      key:      "persona_basics",
      label_he: "השלמת הפרופיל המקצועי",
      why_he:
        "השם והביו שלכם מופיעים על כל הודעה שתשלחו ובמסך הראשון שהזוג רואה. בלי זה, כל ההודעות חתומות 'מיאושי' באופן גנרי.",
      href:     "/dashboard/coach-profile",
      done:     personaComplete,
    },
    {
      key:      "persona_avatar",
      label_he: "העלאת תמונת פרופיל",
      why_he:
        "תמונה מוסיפה אנושיות. הזוגות רואים אדם, לא רק טקסט.",
      href:     "/dashboard/coach-profile",
      done:     personaHasAvatar,
    },
    {
      key:      "library_seed",
      label_he: "5 תגובות שמורות בספרייה",
      why_he:
        "תגובות שמורות = תגובות מהירות. הספרייה גם נושמת תגיות לדשבורד האדמין.",
      href:     "/dashboard/coach-library",
      done:     (libCount ?? 0) >= 5,
    },
    {
      key:      "have_clients",
      label_he: "לפחות זוג אחד פעיל",
      why_he:
        "הזוגות מחוברים אליכם דרך אדמין. אם אין כאלה, נסו לבדוק מול הצוות.",
      href:     "/dashboard/my-clients",
      done:     coupleIds.length > 0,
    },
  ];

  const todoCount = milestones.filter((m) => !m.done).length;

  return {
    milestones,
    todoCount,
    queue: {
      totalCouples:    coupleIds.length,
      needsCheckIn,
      openThreads,
      urgentMessages,
      slaBreaches,
    },
    displayName: p?.coach_display_name_he ?? null,
  };
}
