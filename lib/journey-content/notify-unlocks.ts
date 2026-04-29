// ============================================================
// Unlock notification worker for the Journey Content System.
//
// Finds scheduled items where:
//   unlock_at <= now
//   AND notified_at IS NULL
//   AND assignment is active
//   AND there is no completion yet (no point emailing about something
//       the couple already finished — admin-scheduled items sometimes
//       unlock retroactively)
//
// Groups them by owner, resolves the email recipients (solo user OR
// both couple members), sends a single summary email per recipient,
// then stamps notified_at on every item we successfully dispatched.
//
// Designed to be called by a cron endpoint. Never throws — returns a
// structured report so the cron can log outcomes. All writes go through
// the admin/service-role client.
// ============================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { renderJourneyUnlockEmail } from "@/lib/email/templates/journey-unlock";

interface ScheduledRow {
  id: string;
  assignment_id: string;
  item_id: string;
  unlock_at: string;
  notified_at: string | null;
}

interface ItemRow {
  id: string;
  category_id: string;
  title_he: string;
  title_en: string | null;
}

interface CategoryRow {
  id: string;
  name_he: string;
  name_en: string | null;
}

interface AssignmentRow {
  id: string;
  user_id: string | null;
  couple_id: string | null;
  is_active: boolean;
}

interface OwnerRecipient {
  userId: string;
  email: string;
  name: string | null;
  locale: "he" | "en";
}

export interface NotifyUnlocksResult {
  ok: boolean;
  scanned: number;
  dispatched: number;
  skipped: number;
  errors: Array<{ where: string; message: string }>;
  /** Per-recipient breakdown for the cron log. */
  recipients: Array<{
    email: string;
    items: number;
    status: "sent" | "failed";
  }>;
}

interface NotifyUnlocksOptions {
  /** Max scheduled items to examine in one run (keeps runtime bounded). */
  limit?: number;
  /** Override the "now" clock — helpful for tests/backfills. */
  now?: Date;
  /** Allow callers to pass an existing admin client (e.g. from the cron route). */
  supabase?: SupabaseClient;
  /** Root URL used to build item deep-links — falls back to env. */
  baseUrl?: string;
}

function resolveBaseUrl(override?: string): string {
  const raw =
    override ??
    process.env.PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://mioshy.com";
  return raw.replace(/\/+$/, "");
}

export async function runJourneyUnlockNotifier(
  opts: NotifyUnlocksOptions = {},
): Promise<NotifyUnlocksResult> {
  const result: NotifyUnlocksResult = {
    ok: true,
    scanned: 0,
    dispatched: 0,
    skipped: 0,
    errors: [],
    recipients: [],
  };

  const supabase = opts.supabase ?? (await createAdminClient());
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 1000));
  const nowIso = (opts.now ?? new Date()).toISOString();
  const baseUrl = resolveBaseUrl(opts.baseUrl);

  // ── 1. Pull due, unnotified scheduled items ─────────────────────────────
  const { data: scheduledRaw, error: sErr } = await supabase
    .from("journey_scheduled_items")
    .select("id, assignment_id, item_id, unlock_at, notified_at")
    .is("notified_at", null)
    .lte("unlock_at", nowIso)
    .order("unlock_at", { ascending: true })
    .limit(limit);

  if (sErr) {
    result.ok = false;
    result.errors.push({ where: "scheduled_fetch", message: sErr.message });
    return result;
  }
  const scheduled = (scheduledRaw ?? []) as ScheduledRow[];
  result.scanned = scheduled.length;
  if (scheduled.length === 0) return result;

  // ── 2. Filter out items the owner already completed ─────────────────────
  const scheduledIds = scheduled.map((s) => s.id);
  const { data: completions, error: cErr } = await supabase
    .from("journey_item_completions")
    .select("scheduled_item_id")
    .in("scheduled_item_id", scheduledIds);
  if (cErr) {
    result.errors.push({ where: "completions_fetch", message: cErr.message });
  }
  const completedSet = new Set<string>(
    ((completions ?? []) as Array<{ scheduled_item_id: string }>).map(
      (r) => r.scheduled_item_id,
    ),
  );
  const active = scheduled.filter((s) => !completedSet.has(s.id));
  result.skipped += scheduled.length - active.length;
  if (active.length === 0) return result;

  // ── 3. Hydrate assignments / items / categories ─────────────────────────
  const assignmentIds = Array.from(new Set(active.map((s) => s.assignment_id)));
  const itemIds = Array.from(new Set(active.map((s) => s.item_id)));
  const [assignmentsRes, itemsRes] = await Promise.all([
    supabase
      .from("journey_assignments")
      .select("id, user_id, couple_id, is_active")
      .in("id", assignmentIds),
    supabase
      .from("journey_items")
      .select("id, category_id, title_he, title_en")
      .in("id", itemIds),
  ]);
  if (assignmentsRes.error) {
    result.ok = false;
    result.errors.push({
      where: "assignments_fetch",
      message: assignmentsRes.error.message,
    });
    return result;
  }
  if (itemsRes.error) {
    result.ok = false;
    result.errors.push({
      where: "items_fetch",
      message: itemsRes.error.message,
    });
    return result;
  }
  const assignments = (assignmentsRes.data ?? []) as AssignmentRow[];
  const assignmentsById = new Map(assignments.map((a) => [a.id, a]));

  const items = (itemsRes.data ?? []) as ItemRow[];
  const itemsById = new Map(items.map((it) => [it.id, it]));

  const categoryIds = Array.from(new Set(items.map((it) => it.category_id)));
  const { data: categoriesRaw, error: catErr } = await supabase
    .from("journey_categories")
    .select("id, name_he, name_en")
    .in("id", categoryIds);
  if (catErr) {
    result.errors.push({ where: "categories_fetch", message: catErr.message });
  }
  const categoriesById = new Map(
    ((categoriesRaw ?? []) as CategoryRow[]).map((c) => [c.id, c]),
  );

  // ── 4. Group scheduled items by assignment, drop inactive ones ──────────
  const byAssignment = new Map<string, ScheduledRow[]>();
  for (const s of active) {
    const a = assignmentsById.get(s.assignment_id);
    if (!a || !a.is_active) {
      result.skipped += 1;
      continue;
    }
    const arr = byAssignment.get(s.assignment_id) ?? [];
    arr.push(s);
    byAssignment.set(s.assignment_id, arr);
  }
  if (byAssignment.size === 0) return result;

  // ── 5. Expand assignments → owner recipient users ───────────────────────
  // We need a list of {userId, email, locale, name} per assignment so the
  // email goes to both members of a couple. Couple members are queried in
  // one batch to avoid N round-trips.
  const userIdsToLookup = new Set<string>();
  const coupleIdsToLookup = new Set<string>();
  for (const a of assignments) {
    if (!a.is_active) continue;
    if (a.couple_id) coupleIdsToLookup.add(a.couple_id);
    if (a.user_id) userIdsToLookup.add(a.user_id);
  }

  // 5a. couple_members → flatten to user ids
  let coupleMembersByCouple = new Map<string, string[]>();
  if (coupleIdsToLookup.size > 0) {
    const { data: members, error: mErr } = await supabase
      .from("couple_members")
      .select("user_id, couple_id")
      .in("couple_id", Array.from(coupleIdsToLookup));
    if (mErr) {
      result.errors.push({
        where: "couple_members_fetch",
        message: mErr.message,
      });
    } else {
      coupleMembersByCouple = new Map();
      for (const row of (members ?? []) as Array<{
        user_id: string;
        couple_id: string;
      }>) {
        const arr = coupleMembersByCouple.get(row.couple_id) ?? [];
        arr.push(row.user_id);
        coupleMembersByCouple.set(row.couple_id, arr);
        userIdsToLookup.add(row.user_id);
      }
    }
  }

  if (userIdsToLookup.size === 0) return result;

  // 5b. Pull email + preferred locale via admin_users_overview.
  type UserRow = {
    user_id: string;
    email: string | null;
    full_name?: string | null;
    preferred_locale?: string | null;
  };
  let userRows: UserRow[] = [];
  const userFetch = await supabase
    .from("admin_users_overview")
    .select("user_id, email, full_name, preferred_locale")
    .in("user_id", Array.from(userIdsToLookup));
  if (userFetch.error) {
    // `preferred_locale` / `full_name` may not exist on older views — retry
    // with the minimal shape before giving up.
    const retry = await supabase
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", Array.from(userIdsToLookup));
    if (retry.error) {
      result.ok = false;
      result.errors.push({
        where: "users_fetch",
        message: retry.error.message,
      });
      return result;
    }
    userRows = (retry.data ?? []) as UserRow[];
  } else {
    userRows = (userFetch.data ?? []) as UserRow[];
  }

  const usersById = new Map<string, OwnerRecipient>();
  for (const row of userRows) {
    if (!row.email) continue;
    const raw = (row.preferred_locale ?? "").toLowerCase();
    const locale: "he" | "en" = raw === "en" ? "en" : "he";
    usersById.set(row.user_id, {
      userId: row.user_id,
      email: row.email,
      name: row.full_name?.trim() || null,
      locale,
    });
  }

  // ── 6. For each assignment, merge newly-unlocked items per recipient ────
  // A user may own/belong-to several assignments that unlocked the same day
  // — aggregate across them into a single email per recipient.
  const itemsByRecipient = new Map<
    string,
    {
      recipient: OwnerRecipient;
      items: Array<{
        scheduledId: string;
        title: string;
        categoryName: string | null;
      }>;
    }
  >();

  for (const [assignmentId, rows] of Array.from(byAssignment.entries())) {
    const a = assignmentsById.get(assignmentId)!;
    const recipientUserIds: string[] = [];
    if (a.couple_id) {
      recipientUserIds.push(...(coupleMembersByCouple.get(a.couple_id) ?? []));
    } else if (a.user_id) {
      recipientUserIds.push(a.user_id);
    }
    if (recipientUserIds.length === 0) {
      // Couple has no members yet (edge case) — still mark notified_at so
      // we don't scan this row every cron tick. Silent skip.
      result.skipped += rows.length;
      continue;
    }

    for (const uid of recipientUserIds) {
      const recipient = usersById.get(uid);
      if (!recipient) {
        // Email missing for this user — mark these items as skipped but
        // don't stamp notified_at (the user might add an email later).
        result.skipped += rows.length;
        continue;
      }
      const bucket = itemsByRecipient.get(recipient.email) ?? {
        recipient,
        items: [],
      };
      for (const s of rows) {
        const item = itemsById.get(s.item_id);
        if (!item) continue;
        const category = categoriesById.get(item.category_id) ?? null;
        const title =
          recipient.locale === "he"
            ? item.title_he
            : (item.title_en ?? item.title_he);
        const categoryName = category
          ? recipient.locale === "he"
            ? category.name_he
            : (category.name_en ?? category.name_he)
          : null;
        bucket.items.push({
          scheduledId: s.id,
          title,
          categoryName,
        });
      }
      if (bucket.items.length > 0) {
        itemsByRecipient.set(recipient.email, bucket);
      }
    }
  }

  if (itemsByRecipient.size === 0) return result;

  // ── 7. Send one email per recipient, stamp notified_at on success ───────
  for (const { recipient, items: recipientItems } of Array.from(
    itemsByRecipient.values(),
  )) {
    const locale = recipient.locale;
    const timelineUrl = `${baseUrl}/${locale}/journey/timeline`;
    const emailItems = recipientItems.map((it) => ({
      title: it.title,
      categoryName: it.categoryName,
      url: `${baseUrl}/${locale}/journey/timeline/${it.scheduledId}`,
    }));
    const rendered = renderJourneyUnlockEmail({
      locale,
      recipientName: recipient.name,
      items: emailItems,
      timelineUrl,
    });

    const send = await sendBrevoEmail({
      to: [{ email: recipient.email, name: recipient.name ?? undefined }],
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      tags: ["journey-unlock"],
    });

    if (!send.ok) {
      result.errors.push({
        where: `send:${recipient.email}`,
        message: send.error ?? "send_failed",
      });
      result.recipients.push({
        email: recipient.email,
        items: recipientItems.length,
        status: "failed",
      });
      continue;
    }

    // Stamp notified_at on every scheduled row the recipient was told
    // about. We batch by id list — cheaper than per-row updates. Even
    // when `send.skipped` is true (dev no-op) we still stamp so the
    // item doesn't loop forever in local development.
    const scheduledIdsToStamp = Array.from(
      new Set(recipientItems.map((i) => i.scheduledId)),
    );
    const { error: stampErr } = await supabase
      .from("journey_scheduled_items")
      .update({ notified_at: nowIso })
      .in("id", scheduledIdsToStamp)
      .is("notified_at", null);
    if (stampErr) {
      result.errors.push({
        where: `stamp:${recipient.email}`,
        message: stampErr.message,
      });
    }

    result.dispatched += recipientItems.length;
    result.recipients.push({
      email: recipient.email,
      items: recipientItems.length,
      status: "sent",
    });
  }

  if (result.errors.length > 0) result.ok = false;
  return result;
}
