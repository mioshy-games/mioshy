import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Shared name resolution for the coach chat console.
 *
 * One rule, used in every surface (feed rows, active-window title, partner
 * labels, profile links): a human name ALWAYS — profiles.full_name first,
 * then the email local-part, then a short id suffix as the true last resort.
 * This is what replaces the bare "user 2670046f" labels the MVP showed when a
 * profile row had no full_name.
 */

export interface UserIdentity {
  fullName: string | null;
  email: string | null;
}

/**
 * Resolve a single display name from already-fetched identity bits.
 * `emptyFallback`, when given, is returned instead of the id suffix (used for
 * couple partners where "פרטנר א/ב" reads better than a raw id).
 */
export function personName(opts: {
  fullName?: string | null;
  email?: string | null;
  userId: string;
  emptyFallback?: string | null;
}): string {
  const full = opts.fullName?.trim();
  if (full) return full;
  const email = opts.email ?? "";
  if (email.includes("@")) {
    const local = email.split("@")[0].trim();
    if (local) return local;
  }
  if (opts.emptyFallback?.trim()) return opts.emptyFallback.trim();
  return opts.userId.slice(0, 8);
}

/**
 * Batch-resolve full_name + email for a set of users from v_user_directory
 * (admin-only view, auth.users LEFT JOIN profiles — so email is present even
 * when the profiles row is bare). One indexed `.in()` round-trip; de-duped and
 * empty-safe. Returns an empty map on any failure so callers degrade to their
 * own fallbacks rather than throwing.
 */
export async function fetchUserIdentities(
  userIds: Array<string | null | undefined>,
): Promise<Map<string, UserIdentity>> {
  const map = new Map<string, UserIdentity>();
  const ids = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return map;

  try {
    const admin = createServiceRoleClient();
    if (!admin) return map;
    const { data, error } = await admin
      .from("v_user_directory")
      .select("user_id, full_name, email")
      .in("user_id", ids);
    if (error) return map;
    for (const r of (data ?? []) as Array<{
      user_id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      map.set(r.user_id, { fullName: r.full_name, email: r.email });
    }
  } catch {
    // Degrade silently — callers fall back to email/id.
  }
  return map;
}
