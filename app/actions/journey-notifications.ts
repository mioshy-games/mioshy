"use server";

// ============================================================
// Server actions for the v3 notification inbox (slice 10).
//
// Auth model:
//   - User actions resolve identity via createServerSupabaseClient().
//     The mark-read action verifies the row's recipient_user_id
//     matches the caller before stamping read_at.
//   - Admin pool reads/marks gate on requireAdmin().
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getNotificationsForUser,
  type NotificationRow,
} from "@/lib/journey-content/notifications-read";

type Result = { ok: true } | { ok: false; error: string };

export async function markNotificationRead(
  notificationId: string,
): Promise<Result> {
  if (!notificationId) return { ok: false, error: "missing_id" };
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const admin = await createAdminClient();
  // Match recipient_user_id to prevent cross-user mark-read.
  const { error } = await admin
    .from("journey_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_user_id", user.id)
    .eq("recipient_kind", "user");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/my", "layout");
  return { ok: true };
}

export async function markAllUserNotificationsRead(): Promise<Result> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", user.id)
    .eq("recipient_kind", "user")
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/my", "layout");
  return { ok: true };
}

/**
 * Lazy-load handler for the bell dropdown. Server action returns the
 * latest 20 notifications for the signed-in user. The UI renders them
 * client-side after the bell is clicked.
 */
export async function listMyNotifications(): Promise<NotificationRow[]> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return [];
  return getNotificationsForUser(user.id, { limit: 20 });
}

// ------------------------------------------------------------
// Admin pool — health page banner
// ------------------------------------------------------------

export async function markAllAdminAlertsRead(): Promise<Result> {
  await requireAdmin();
  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_kind", "admin_pool")
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/journey/health", "page");
  return { ok: true };
}
