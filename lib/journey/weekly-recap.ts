/**
 * lib/journey/weekly-recap.ts
 *
 * Layer-4 weekly recap generator.
 *
 * computeWeeklyRecap(coupleId, weekStarting) gathers all signals
 * from the [weekStarting, weekStarting + 7d] window and emits:
 *   - summary_he / summary_en (warm narrative the user reads)
 *   - notable_signals (structured counts the coach view consumes)
 *
 * No LLM. Pure templated copy keyed off counts so the output is
 * predictable and never hallucinates.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface WeeklyRecapResult {
  summary_he:      string;
  summary_en:      string;
  notable_signals: {
    items_completed:    number;
    responses_posted:   number;
    reactions_received: number;
    expert_replies:     number;
    top_item_title:     string | null;
  };
}

/**
 * Returns the Sunday 00:00 UTC date that starts the week the given
 * date falls in. Used as the canonical week_starting key.
 */
export function startOfWeekSundayUTC(d: Date = new Date()): Date {
  const out = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0, 0, 0, 0,
  ));
  // getUTCDay: 0=Sunday. Subtract back to nearest Sunday.
  out.setUTCDate(out.getUTCDate() - out.getUTCDay());
  return out;
}

export async function computeWeeklyRecap(
  coupleId: string,
  weekStarting: Date,
): Promise<WeeklyRecapResult | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const startIso = weekStarting.toISOString();
  const endDate = new Date(weekStarting);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endIso = endDate.toISOString();

  // Resolve members to scope user-keyed signals.
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );

  // Active assignments → scheduled items in this couple.
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );

  let scheduledIds: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .in("assignment_id", assignmentIds);
    scheduledIds = ((scheduled ?? []) as Array<{ id: string }>).map((r) => r.id);
  }

  // 1. Items completed this week (any partner counts).
  let itemsCompleted = 0;
  let topItemTitle: string | null = null;
  if (scheduledIds.length > 0) {
    const { data: completions } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id, completed_at")
      .in("scheduled_item_id", scheduledIds)
      .gte("completed_at", startIso)
      .lt("completed_at", endIso);
    itemsCompleted = ((completions ?? []) as Array<{ scheduled_item_id: string }>).length;

    if (completions && completions.length > 0) {
      // Resolve the title of the FIRST completed item this week as
      // a representative anchor for the recap copy.
      const firstSchedId = (completions[0] as { scheduled_item_id: string }).scheduled_item_id;
      const { data: schedRow } = await admin
        .from("journey_scheduled_items")
        .select("item_id")
        .eq("id", firstSchedId)
        .maybeSingle();
      const itemId = (schedRow as { item_id: string } | null)?.item_id;
      if (itemId) {
        const { data: itemRow } = await admin
          .from("journey_items")
          .select("title_he, title_en")
          .eq("id", itemId)
          .maybeSingle();
        if (itemRow) {
          topItemTitle =
            (itemRow as { title_he: string }).title_he ||
            (itemRow as { title_en: string | null }).title_en ||
            null;
        }
      }
    }
  }

  // 2. Responses posted this week (per item).
  let responsesPosted = 0;
  if (scheduledIds.length > 0) {
    const { data: responses } = await admin
      .from("journey_item_responses")
      .select("id")
      .in("scheduled_item_id", scheduledIds)
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    responsesPosted = ((responses ?? []) as Array<{ id: string }>).length;
  }

  // 3. Reactions received this week — count from journey_messages.reactions
  //    we only need a bool-per-message ("got at least one new reaction").
  //    For Layer 4 we approximate as the count of messages this week with
  //    a non-empty reactions JSONB. Refines later if needed.
  let reactionsReceived = 0;
  if (userIds.length > 0) {
    const { data: messages } = await admin
      .from("journey_messages")
      .select("reactions")
      .in("author_user_id", userIds)
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    for (const m of (messages ?? []) as Array<{ reactions: Record<string, string[]> | null }>) {
      const r = m.reactions ?? {};
      for (const arr of Object.values(r)) {
        if (Array.isArray(arr) && arr.length > 0) {
          reactionsReceived++;
          break;
        }
      }
    }
  }

  // 4. Expert replies this week — channel + per-item.
  let expertReplies = 0;
  if (userIds.length > 0) {
    const { data: channelReplies } = await admin
      .from("journey_messages")
      .select("id")
      .in("channel_user_id", userIds)
      .eq("author_kind", "expert")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    expertReplies += ((channelReplies ?? []) as Array<{ id: string }>).length;
  }
  if (scheduledIds.length > 0) {
    const { data: itemReplies } = await admin
      .from("journey_messages")
      .select("id")
      .in("scheduled_item_id", scheduledIds)
      .eq("author_kind", "expert")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    expertReplies += ((itemReplies ?? []) as Array<{ id: string }>).length;
  }

  // ── Compose summary copy ────────────────────────────────────────
  // Pure template — no LLM, no per-couple personalisation beyond
  // the counts. Predictable.
  const summary_he = renderSummary({
    locale: "he",
    counts: {
      itemsCompleted,
      responsesPosted,
      reactionsReceived,
      expertReplies,
    },
    topItemTitle,
  });
  const summary_en = renderSummary({
    locale: "en",
    counts: {
      itemsCompleted,
      responsesPosted,
      reactionsReceived,
      expertReplies,
    },
    topItemTitle,
  });

  return {
    summary_he,
    summary_en,
    notable_signals: {
      items_completed:    itemsCompleted,
      responses_posted:   responsesPosted,
      reactions_received: reactionsReceived,
      expert_replies:     expertReplies,
      top_item_title:     topItemTitle,
    },
  };
}

function renderSummary(args: {
  locale: "he" | "en";
  counts: {
    itemsCompleted:    number;
    responsesPosted:   number;
    reactionsReceived: number;
    expertReplies:     number;
  };
  topItemTitle: string | null;
}): string {
  const { itemsCompleted, responsesPosted, expertReplies } = args.counts;
  const isHe = args.locale === "he";

  if (itemsCompleted === 0 && responsesPosted === 0 && expertReplies === 0) {
    return isHe
      ? "השבוע היה שקט אצלכם. לפעמים גם זה חלק מהמסע. נמשיך משם בשבוע הבא."
      : "It was a quiet week for you. Sometimes that's part of the journey too. We pick up from here.";
  }

  const parts: string[] = [];

  if (itemsCompleted > 0 && args.topItemTitle) {
    parts.push(
      isHe
        ? `השבוע השלמתם ${itemsCompleted} ${itemsCompleted === 1 ? "צעד" : "צעדים"} — בין השאר "${args.topItemTitle}".`
        : `You completed ${itemsCompleted} ${itemsCompleted === 1 ? "step" : "steps"} this week — including "${args.topItemTitle}".`,
    );
  } else if (itemsCompleted > 0) {
    parts.push(
      isHe
        ? `השבוע השלמתם ${itemsCompleted} ${itemsCompleted === 1 ? "צעד" : "צעדים"} ביחד.`
        : `You completed ${itemsCompleted} ${itemsCompleted === 1 ? "step" : "steps"} together this week.`,
    );
  }

  if (responsesPosted > 0) {
    parts.push(
      isHe
        ? `כתבתם ${responsesPosted} ${responsesPosted === 1 ? "הרהור" : "הרהורים"} שהמומחה קרא.`
        : `You wrote ${responsesPosted} ${responsesPosted === 1 ? "reflection" : "reflections"} that your coach read.`,
    );
  }

  if (expertReplies > 0) {
    parts.push(
      isHe
        ? `קיבלתם ${expertReplies} ${expertReplies === 1 ? "תגובה אישית" : "תגובות אישיות"} מהמומחה.`
        : `You received ${expertReplies} ${expertReplies === 1 ? "personal reply" : "personal replies"} from your coach.`,
    );
  }

  parts.push(
    isHe
      ? "ממשיכים מכאן בשבוע הבא."
      : "We pick up from here next week.",
  );

  return parts.join(" ");
}
