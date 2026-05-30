// ============================================================
// notifications-read.ts - slice 10 read side of journey_notifications.
//
// Three audiences:
//   - User: bell icon dropdown on the site header (own rows only).
//   - Admin pool: red banner on /dashboard/journey/health.
//   - (Expert pool reads land on the same surface as admin pool for
//      now - no dedicated expert UI yet.)
//
// Read helpers are server-only. Mark-read mutations are server actions
// in actions/journey-notifications.ts.
// ============================================================

import "server-only";
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { NotificationKind } from "./notifications";

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const DEFAULT_LIMIT = 20;

// 2026-05-31 — wrapped in React.cache. The (shell) parent
// `[locale]/layout.tsx` already calls this once per request to populate
// the marketing bell badge, and then `getShellData()` calls it AGAIN to
// populate the shell's PageHeader bell. Cache makes the second call free.
// Scope is request-only; no cross-request staleness.
export const getUnreadCountForUser = cache(_getUnreadCountForUser);

async function _getUnreadCountForUser(userId: string): Promise<number> {
  const admin = createServiceRoleClient();
  if (!admin || !userId) return 0;
  const { count } = await admin
    .from("journey_notifications")
    .select("id", { head: true, count: "exact" })
    .eq("recipient_kind", "user")
    .eq("recipient_user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getNotificationsForUser(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  const admin = createServiceRoleClient();
  if (!admin || !userId) return [];
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, 100);
  let q = admin
    .from("journey_notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("recipient_kind", "user")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.unreadOnly) q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) {
    console.error("[notifications-read.user]", error);
    return [];
  }
  return ((data ?? []) as Array<{
    id: string;
    kind: string;
    payload: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    payload: r.payload ?? {},
    read_at: r.read_at,
    created_at: r.created_at,
  }));
}

export async function getUnreadAdminAlerts(
  limit = DEFAULT_LIMIT,
): Promise<NotificationRow[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("journey_notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("recipient_kind", "admin_pool")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notifications-read.admin]", error);
    return [];
  }
  return ((data ?? []) as Array<{
    id: string;
    kind: string;
    payload: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    payload: r.payload ?? {},
    read_at: r.read_at,
    created_at: r.created_at,
  }));
}
