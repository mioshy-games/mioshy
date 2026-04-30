import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Append-only logger for the user's journey timeline. Server actions
 * (completion, response post, etc.) call logActivity() so the user's
 * "recent activity" view + the expert's couple-detail timeline preview
 * have a single source of truth.
 *
 * Failure is non-fatal — if the insert errors we log to the server console
 * and return; we never want a logging failure to abort the actual user
 * action it's tracking.
 */
export type JourneyVerb =
  | "item_opened"
  | "item_completed"
  | "item_uncompleted"
  | "response_posted"
  | "response_deleted";

export async function logActivity(args: {
  userId: string;
  coupleId: string | null;
  scheduledItemId: string | null;
  verb: JourneyVerb;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    console.warn("[logActivity] service role unavailable, skipping");
    return;
  }
  const { error } = await admin.from("journey_user_activity").insert({
    user_id: args.userId,
    couple_id: args.coupleId,
    scheduled_item_id: args.scheduledItemId,
    verb: args.verb,
    payload: args.payload ?? {},
  });
  if (error) {
    console.warn("[logActivity] insert failed", { args, err: error.message });
  }
}

export type ActivityEntry = {
  id: string;
  userId: string;
  userEmail: string | null;
  scheduledItemId: string | null;
  itemTitle: string | null;
  verb: JourneyVerb;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * Read the most recent N activity rows for a couple, joined to scheduled
 * item title + actor email. Used by the expert dashboard.
 */
export async function listCoupleActivity(
  coupleId: string,
  limit = 30,
): Promise<ActivityEntry[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const { data: rows } = await admin
    .from("journey_user_activity")
    .select("id, user_id, scheduled_item_id, verb, payload, created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const list = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    scheduled_item_id: string | null;
    verb: JourneyVerb;
    payload: Record<string, unknown>;
    created_at: string;
  }>;

  if (list.length === 0) return [];

  const userIds = Array.from(new Set(list.map((r) => r.user_id)));
  const scheduledIds = Array.from(
    new Set(list.map((r) => r.scheduled_item_id).filter(Boolean) as string[]),
  );

  const [{ data: users }, scheduledTitles] = await Promise.all([
    userIds.length > 0
      ? admin
          .from("admin_users_overview")
          .select("user_id, email")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; email: string | null }> }),
    scheduledTitleMap(scheduledIds),
  ]);

  const emailById = new Map<string, string | null>();
  for (const u of (users ?? []) as Array<{ user_id: string; email: string | null }>) {
    emailById.set(u.user_id, u.email);
  }

  return list.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: emailById.get(r.user_id) ?? null,
    scheduledItemId: r.scheduled_item_id,
    itemTitle: r.scheduled_item_id
      ? scheduledTitles.get(r.scheduled_item_id) ?? null
      : null,
    verb: r.verb,
    payload: r.payload,
    createdAt: r.created_at,
  }));
}

/**
 * Same query but scoped to a single user — powers the user-facing
 * "recent activity" panel on /journey/timeline.
 */
export async function listUserActivity(
  userId: string,
  limit = 12,
): Promise<ActivityEntry[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  const { data: rows } = await admin
    .from("journey_user_activity")
    .select("id, user_id, scheduled_item_id, verb, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const list = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    scheduled_item_id: string | null;
    verb: JourneyVerb;
    payload: Record<string, unknown>;
    created_at: string;
  }>;

  if (list.length === 0) return [];

  const scheduledIds = Array.from(
    new Set(list.map((r) => r.scheduled_item_id).filter(Boolean) as string[]),
  );
  const titles = await scheduledTitleMap(scheduledIds);

  return list.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: null,
    scheduledItemId: r.scheduled_item_id,
    itemTitle: r.scheduled_item_id
      ? titles.get(r.scheduled_item_id) ?? null
      : null,
    verb: r.verb,
    payload: r.payload,
    createdAt: r.created_at,
  }));
}

async function scheduledTitleMap(
  scheduledIds: string[],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  if (scheduledIds.length === 0) return titles;
  const admin = createServiceRoleClient();
  if (!admin) return titles;
  const { data } = await admin
    .from("journey_scheduled_items")
    .select("id, item_id")
    .in("id", scheduledIds);
  const itemIds = Array.from(
    new Set(((data ?? []) as Array<{ item_id: string }>).map((s) => s.item_id)),
  );
  if (itemIds.length === 0) return titles;
  const { data: items } = await admin
    .from("journey_items")
    .select("id, title_he, title_en")
    .in("id", itemIds);
  const itemTitles = new Map<string, string>();
  for (const i of (items ?? []) as Array<{
    id: string;
    title_he: string;
    title_en: string | null;
  }>) {
    itemTitles.set(i.id, i.title_he || i.title_en || i.id);
  }
  for (const s of (data ?? []) as Array<{ id: string; item_id: string }>) {
    const t = itemTitles.get(s.item_id);
    if (t) titles.set(s.id, t);
  }
  return titles;
}
