import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Counts "what the user can act on right now but hasn't seen yet" for the
 * coaching pillar notification badge on /my.
 *
 * "Unread" = a scheduled item that:
 *   • belongs to the user (or their couple) via an active assignment,
 *   • has unlocked (`unlock_at <= now()`),
 *   • is NOT marked completed,
 *   • has NO `item_opened` activity event yet for this user.
 *
 * Drives a single number → red dot + counter on the coaching card. When
 * the expert prescribes new content (program / category / single item), the
 * materializer creates rows that immediately match this query, so the
 * badge appears the moment the user lands on /my.
 *
 * Pure read; uses the service-role client because /my already enforces
 * auth at the page layer.
 */
export async function countUnreadJourneyItems(args: {
  userId: string;
  coupleId: string | null;
}): Promise<number> {
  const admin = createServiceRoleClient();
  if (!admin) return 0;

  // 1. Owner's active assignments (user OR couple).
  const orFilter = args.coupleId
    ? `user_id.eq.${args.userId},couple_id.eq.${args.coupleId}`
    : `user_id.eq.${args.userId}`;
  const { data: assignRows } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("is_active", true)
    .or(orFilter);

  const assignmentIds = ((assignRows ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  if (assignmentIds.length === 0) return 0;

  // 2. Scheduled items unlocked already.
  const nowIso = new Date().toISOString();
  const { data: schedRows } = await admin
    .from("journey_scheduled_items")
    .select("id")
    .in("assignment_id", assignmentIds)
    .lte("unlock_at", nowIso);

  const scheduledIds = ((schedRows ?? []) as Array<{ id: string }>).map(
    (s) => s.id,
  );
  if (scheduledIds.length === 0) return 0;

  // 3. Knock out completed items.
  const { data: doneRows } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id")
    .in("scheduled_item_id", scheduledIds);
  const completedSet = new Set(
    ((doneRows ?? []) as Array<{ scheduled_item_id: string }>).map(
      (r) => r.scheduled_item_id,
    ),
  );

  // 4. Knock out items the user already opened (per-user audit log so
  //    couple partners get independent badges).
  const { data: openedRows } = await admin
    .from("journey_user_activity")
    .select("scheduled_item_id")
    .eq("user_id", args.userId)
    .eq("verb", "item_opened")
    .in("scheduled_item_id", scheduledIds);
  const openedSet = new Set(
    ((openedRows ?? []) as Array<{ scheduled_item_id: string | null }>)
      .map((r) => r.scheduled_item_id)
      .filter((x): x is string => !!x),
  );

  return scheduledIds.filter(
    (id) => !completedSet.has(id) && !openedSet.has(id),
  ).length;
}
