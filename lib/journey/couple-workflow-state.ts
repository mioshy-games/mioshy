/**
 * lib/journey/couple-workflow-state.ts
 *
 * Phase 13 — per-couple workflow state machine. Heart of the
 * "always-on guidance for the coach" experience.
 *
 * Returns the current state of a couple + the next concrete action
 * the coach should take. Works for brand-new couples and for couples
 * 20+ items into the journey.
 *
 * No new schema needed — pure derivation from existing tables:
 *   - journey_responses (assessment done?)
 *   - journey_assignments (have an active program?)
 *   - journey_scheduled_items + journey_item_completions (progress)
 *   - journey_messages (latest interaction + author)
 *   - journey_drift_alerts (drift state + last coach check-in)
 *   - journey_messages.sentiment (urgent/concerning AI flag)
 *   - journey_couple_channel_messages (couple channel activity)
 *   - journey_couple_recommendations (24h cooldown)
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type WorkflowStateKind =
  | "URGENT"                    // AI flagged urgent message — drop everything
  | "NEEDS_COACH_REPLY"         // user posted, coach hasn't replied
  | "DRIFTING_NEEDS_CHECKIN"    // 8+ days silent, needs coach reach-out
  | "NEW_NO_ASSESSMENT"         // signed up, didn't take assessment
  | "ASSESSMENT_DONE_NO_WELCOME"// took assessment, no welcome message yet
  | "WELCOMED_NO_FIRST_ITEM"    // welcomed, no first item scheduled
  | "FIRST_ITEM_PENDING_OPEN"   // first item scheduled, not opened (24-72h)
  | "AWAITING_USER_RESPONSE"    // user opened item, no response yet
  | "NEEDS_NEXT_ITEM"           // completed everything, queue is empty
  | "ACTIVE_HEALTHY";           // engaged, on track, nothing urgent

export type Urgency = "high" | "medium" | "low" | "info";

export interface WorkflowContext {
  /** Last user message preview (for state= NEEDS_COACH_REPLY/URGENT). */
  lastUserMessage?:    string | null;
  /** When the user last posted anything. */
  lastUserActivity?:   string | null;
  /** Days since last user signal (for drift). */
  daysSilent?:         number;
  /** Distinct count of items they've completed. */
  completedItemsCount: number;
  /** Distinct count of items in their queue (active scheduled). */
  scheduledItemsCount: number;
  /** Top priority from assessment (e.g. 'communication'). */
  topPriority?:        string | null;
  /** Sentiment of latest user message, if AI classified. */
  latestSentiment?:    string | null;
}

export interface WorkflowState {
  state:              WorkflowStateKind;
  /** Hebrew label for the chip. */
  label_he:           string;
  /** Hebrew action prompt — what the coach should DO. */
  next_action_he:     string;
  /** URL to navigate to (often /dashboard/my-clients/[couple] with focus query). */
  next_action_href:   string;
  /** CTA button label in Hebrew. */
  cta_label_he:       string;
  urgency:            Urgency;
  context:            WorkflowContext;
}

// ─────────────────────────────────────────────────────────────────────
// State labels + presets
// ─────────────────────────────────────────────────────────────────────

const PRESETS: Record<WorkflowStateKind, {
  label_he:        string;
  cta_label_he:    string;
  next_action_he:  string;
  urgency:         Urgency;
}> = {
  URGENT: {
    label_he:       "🚨 דחוף",
    cta_label_he:   "טפלו עכשיו",
    next_action_he: "ה-AI סימן הודעה דחופה. קראו את ההיסטוריה המלאה לפני שאתם עונים, ענו תוך שעה, צרפו משאבי חירום אם יש חשד לסכנה.",
    urgency:        "high",
  },
  NEEDS_COACH_REPLY: {
    label_he:       "🔔 צריך תגובה",
    cta_label_he:   "ענו להודעה",
    next_action_he: "המשתמש שלח הודעה ועדיין לא קיבל תגובה. SLA של 48 שעות — אל תחרגו.",
    urgency:        "high",
  },
  DRIFTING_NEEDS_CHECKIN: {
    label_he:       "😴 drift",
    cta_label_he:   "שלחו check-in",
    next_action_he: "הזוג שקט יותר משמונה ימים. שלחו הודעה רכה דרך הערוץ הזוגי — שאלה, לא דרישה.",
    urgency:        "medium",
  },
  NEW_NO_ASSESSMENT: {
    label_he:       "⏳ ממתין לאבחון",
    cta_label_he:   "שלחו תזכורת",
    next_action_he: "הזוג נרשם אבל לא השלים אבחון. בלי אבחון אין דרך להמליץ תוכן רלוונטי. שלחו תזכורת רכה.",
    urgency:        "low",
  },
  ASSESSMENT_DONE_NO_WELCOME: {
    label_he:       "✨ צריך ברכת קבלה",
    cta_label_he:   "שלחו ברכה אישית",
    next_action_he: "הזוג השלים אבחון ומחכה לכם. קראו את התשובות שלהם, ושלחו הודעה אישית דרך הערוץ הזוגי. זה מגדיר את הטון לכל המסע.",
    urgency:        "high",
  },
  WELCOMED_NO_FIRST_ITEM: {
    label_he:       "📩 פריט ראשון",
    cta_label_he:   "דחפו פריט ראשון",
    next_action_he: "ברכתם אותם — עכשיו צריך לדחוף פריט ראשון. השתמשו ב-Smart Suggestions כדי לבחור פריט מותאם לעדיפות הראשונה שלהם.",
    urgency:        "high",
  },
  FIRST_ITEM_PENDING_OPEN: {
    label_he:       "👀 ממתין לפתיחה",
    cta_label_he:   "המתינו / תזכרו",
    next_action_he: "הפריט נשלח, הזוג עוד לא נכנס. עברו 24-72 שעות. תזכורת רכה דרך הערוץ הזוגי תעבוד.",
    urgency:        "low",
  },
  AWAITING_USER_RESPONSE: {
    label_he:       "💭 ממתין לתגובה",
    cta_label_he:   "אין פעולה כעת",
    next_action_he: "הזוג פתח את הפריט. תנו להם זמן להגיב — לא כל פריט מקבל תגובה מיידית.",
    urgency:        "info",
  },
  NEEDS_NEXT_ITEM: {
    label_he:       "🎯 פריט הבא",
    cta_label_he:   "דחפו פריט הבא",
    next_action_he: "הזוג השלים את הפריטים בתור והמערכת ריקה. בחרו את הפריט הבא מ-Smart Suggestions או צרו תוכן ad-hoc אם אין מתאים.",
    urgency:        "medium",
  },
  ACTIVE_HEALTHY: {
    label_he:       "✓ פעיל",
    cta_label_he:   "אין פעולה דרושה",
    next_action_he: "הכל מתנהל כשורה. תוכלו לפתוח את הזוג כדי לסקור התקדמות.",
    urgency:        "info",
  },
};

// ─────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────

export async function getCoupleWorkflowState(
  coupleId: string,
): Promise<WorkflowState> {
  const admin = await createAdminClient();
  const now = Date.now();

  // ── Members + couple basic ──────────────────────────────────
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const memberIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );

  // ── Assessment done? ────────────────────────────────────────
  let hasAssessment = false;
  let topPriority: string | null = null;
  if (memberIds.length > 0) {
    const { data: journeys } = await admin
      .from("journeys")
      .select("id")
      .in("user_id", memberIds);
    const journeyIds = ((journeys ?? []) as Array<{ id: string }>).map(
      (j) => j.id,
    );
    if (journeyIds.length > 0) {
      const { data: rankRows } = await admin
        .from("journey_responses")
        .select("answer")
        .in("journey_id", journeyIds);
      for (const r of (rankRows ?? []) as Array<{
        answer: { kind?: string; order?: unknown };
      }>) {
        if (r.answer?.kind === "ranking" && Array.isArray(r.answer.order)) {
          hasAssessment = true;
          const first = r.answer.order[0];
          if (typeof first === "string") topPriority = first;
          break;
        }
      }
      // Even responses without ranking count as "started" assessment.
      if (!hasAssessment && (rankRows ?? []).length > 0) {
        hasAssessment = true;
      }
    }
  }

  // ── Active assignment? ──────────────────────────────────────
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );

  // ── Scheduled items + completions ───────────────────────────
  let scheduledItemsCount = 0;
  let completedItemsCount = 0;
  let firstItemUnlockAt: string | null = null;
  let firstItemSeenAt:   string | null = null;
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, unlock_at, seen_at")
      .in("assignment_id", assignmentIds)
      .order("unlock_at", { ascending: true });
    const schedRows = ((scheduled ?? []) as Array<{
      id: string;
      unlock_at: string;
      seen_at: string | null;
    }>);
    scheduledItemsCount = schedRows.length;
    if (schedRows.length > 0) {
      firstItemUnlockAt = schedRows[0].unlock_at;
      firstItemSeenAt   = schedRows[0].seen_at;
    }
    if (schedRows.length > 0) {
      const schedIds = schedRows.map((r) => r.id);
      const { data: comps } = await admin
        .from("journey_item_completions")
        .select("scheduled_item_id")
        .in("scheduled_item_id", schedIds);
      completedItemsCount = ((comps ?? []) as Array<unknown>).length;
    }
  }

  // ── Latest user message + sentiment ─────────────────────────
  let latestUserMsg: {
    body:        string;
    created_at:  string;
    sentiment:   string | null;
  } | null = null;
  let latestCoachReplyAt: string | null = null;
  if (assignmentIds.length > 0) {
    const { data: scheduled2 } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .in("assignment_id", assignmentIds);
    const schedIds2 = ((scheduled2 ?? []) as Array<{ id: string }>).map(
      (r) => r.id,
    );
    if (schedIds2.length > 0) {
      // Latest user message on per-item threads
      const { data: userMsgs } = await admin
        .from("journey_messages")
        .select("body, created_at, sentiment")
        .in("scheduled_item_id", schedIds2)
        .eq("author_kind", "user")
        .order("created_at", { ascending: false })
        .limit(1);
      const userMsgRow = (userMsgs?.[0] ?? null) as {
        body: string;
        created_at: string;
        sentiment: string | null;
      } | null;
      // Latest coach message
      const { data: coachMsgs } = await admin
        .from("journey_messages")
        .select("created_at")
        .in("scheduled_item_id", schedIds2)
        .eq("author_kind", "expert")
        .order("created_at", { ascending: false })
        .limit(1);
      latestUserMsg = userMsgRow;
      latestCoachReplyAt = (coachMsgs?.[0] as { created_at: string } | undefined)?.created_at ?? null;
    }
  }

  // Couple-channel messages too
  const { data: ccMsgs } = await admin
    .from("journey_couple_channel_messages")
    .select("body, created_at, sentiment, author_kind")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(20);
  const ccRows = ((ccMsgs ?? []) as Array<{
    body:        string;
    created_at:  string;
    sentiment:   string | null;
    author_kind: string;
  }>);
  const latestCcUser   = ccRows.find((r) => r.author_kind === "partner") ?? null;
  const latestCcExpert = ccRows.find((r) => r.author_kind === "expert")  ?? null;

  // Combined latest user message: take whichever is newer between
  // per-item and couple-channel.
  const allUserMessages: Array<{
    body: string;
    created_at: string;
    sentiment: string | null;
  }> = [
    ...(latestUserMsg ? [latestUserMsg] : []),
    ...(latestCcUser
      ? [{ body: latestCcUser.body, created_at: latestCcUser.created_at, sentiment: latestCcUser.sentiment }]
      : []),
  ];
  allUserMessages.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const newestUserMsg = allUserMessages[0] ?? null;

  // Combined latest coach reply
  const allCoachReplies = [
    latestCoachReplyAt,
    latestCcExpert?.created_at ?? null,
  ].filter((s): s is string => Boolean(s));
  allCoachReplies.sort((a, b) => b.localeCompare(a));
  const newestCoachReply = allCoachReplies[0] ?? null;

  // ── Drift state ─────────────────────────────────────────────
  const { data: drift } = await admin
    .from("journey_drift_alerts")
    .select("state, coach_checked_in_at")
    .eq("couple_id", coupleId)
    .maybeSingle();
  const driftRow = drift as {
    state: string;
    coach_checked_in_at: string | null;
  } | null;

  // ── Build context ───────────────────────────────────────────
  const context: WorkflowContext = {
    lastUserMessage:     newestUserMsg?.body ?? null,
    lastUserActivity:    newestUserMsg?.created_at ?? null,
    daysSilent:          newestUserMsg
      ? Math.round((now - new Date(newestUserMsg.created_at).getTime()) / 86400_000)
      : undefined,
    completedItemsCount,
    scheduledItemsCount,
    topPriority,
    latestSentiment:     newestUserMsg?.sentiment ?? null,
  };

  const drillBase = `/dashboard/my-clients/${coupleId}`;

  // ── State machine — top-down priority ───────────────────────

  // 1. URGENT
  if (newestUserMsg?.sentiment === "urgent") {
    return {
      ...PRESETS.URGENT,
      state:             "URGENT",
      next_action_href:  `${drillBase}?focus=messages`,
      context,
    };
  }

  // 2. NEEDS_COACH_REPLY — user posted, coach hasn't replied since
  if (newestUserMsg) {
    const userT = new Date(newestUserMsg.created_at).getTime();
    const coachT = newestCoachReply
      ? new Date(newestCoachReply).getTime()
      : 0;
    if (userT > coachT) {
      return {
        ...PRESETS.NEEDS_COACH_REPLY,
        state:             "NEEDS_COACH_REPLY",
        next_action_href:  `${drillBase}?focus=messages`,
        context,
      };
    }
  }

  // 3. DRIFTING_NEEDS_CHECKIN
  if (driftRow && driftRow.state !== "active" && !driftRow.coach_checked_in_at) {
    return {
      ...PRESETS.DRIFTING_NEEDS_CHECKIN,
      state:             "DRIFTING_NEEDS_CHECKIN",
      next_action_href:  `${drillBase}?focus=messages`,
      context,
    };
  }

  // 4. NEW_NO_ASSESSMENT
  if (!hasAssessment) {
    return {
      ...PRESETS.NEW_NO_ASSESSMENT,
      state:             "NEW_NO_ASSESSMENT",
      next_action_href:  drillBase,
      context,
    };
  }

  // 5. ASSESSMENT_DONE_NO_WELCOME — no couple-channel coach message ever
  if (!latestCcExpert) {
    return {
      ...PRESETS.ASSESSMENT_DONE_NO_WELCOME,
      state:             "ASSESSMENT_DONE_NO_WELCOME",
      next_action_href:  `${drillBase}?focus=couple-channel`,
      context,
    };
  }

  // 6. WELCOMED_NO_FIRST_ITEM — no scheduled items at all
  if (scheduledItemsCount === 0) {
    return {
      ...PRESETS.WELCOMED_NO_FIRST_ITEM,
      state:             "WELCOMED_NO_FIRST_ITEM",
      next_action_href:  `${drillBase}?focus=suggestions`,
      context,
    };
  }

  // 7. FIRST_ITEM_PENDING_OPEN — has 1 scheduled item, never opened
  if (
    scheduledItemsCount === 1 &&
    completedItemsCount === 0 &&
    firstItemUnlockAt &&
    !firstItemSeenAt
  ) {
    const ageMs = now - new Date(firstItemUnlockAt).getTime();
    if (ageMs < 72 * 3600_000) {
      return {
        ...PRESETS.FIRST_ITEM_PENDING_OPEN,
        state:             "FIRST_ITEM_PENDING_OPEN",
        next_action_href:  drillBase,
        context,
      };
    }
  }

  // 8. NEEDS_NEXT_ITEM — completed all scheduled, no new in queue
  if (
    scheduledItemsCount > 0 &&
    completedItemsCount >= scheduledItemsCount
  ) {
    return {
      ...PRESETS.NEEDS_NEXT_ITEM,
      state:             "NEEDS_NEXT_ITEM",
      next_action_href:  `${drillBase}?focus=suggestions`,
      context,
    };
  }

  // 9. AWAITING_USER_RESPONSE — items pending, last user signal recent
  if (newestUserMsg) {
    const userT = new Date(newestUserMsg.created_at).getTime();
    if (now - userT < 7 * 86400_000) {
      return {
        ...PRESETS.AWAITING_USER_RESPONSE,
        state:             "AWAITING_USER_RESPONSE",
        next_action_href:  drillBase,
        context,
      };
    }
  }

  // 10. ACTIVE_HEALTHY — fallback when nothing screams
  return {
    ...PRESETS.ACTIVE_HEALTHY,
    state:             "ACTIVE_HEALTHY",
    next_action_href:  drillBase,
    context,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Batch — pull workflow state for many couples in parallel.
// Used by /dashboard/my-clients to power the status column.
// ─────────────────────────────────────────────────────────────────────

export async function getWorkflowStatesForCouples(
  coupleIds: string[],
): Promise<Map<string, WorkflowState>> {
  const states = await Promise.all(
    coupleIds.map(async (id) => [id, await getCoupleWorkflowState(id)] as const),
  );
  return new Map(states);
}
