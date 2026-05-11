/**
 * lib/journey/view-as.ts
 *
 * Read-side helper for Layer-2 coach impersonation. Returns:
 *   - the impersonated user_id when an active view-as exists for
 *     the current coach session
 *   - null when no impersonation is active OR the cookie is stale
 *
 * Server-only — must NEVER be exposed to the client. Validation:
 *   1. Cookie present
 *   2. Audit row exists with id = cookie + coach_id = auth.uid()
 *      + ended_at IS NULL + started_at within TTL window
 *
 * If any check fails, returns null. Pages that opted into view-as
 * fall back to the regular auth.uid() user read.
 */

import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";

const VIEW_AS_COOKIE = "mioshy_view_as";
const VIEW_AS_TTL_MS = 60 * 60 * 1000;

export interface ViewAsContext {
  /** The user being viewed-as (impersonated). */
  viewedUserId: string;
  /** The coach doing the viewing. Always present. */
  coachId:      string;
  /** Optional couple context the impersonation was launched from. */
  coupleId:     string | null;
  /** The audit row id — useful for closing impersonation later. */
  auditId:      string;
}

/**
 * Resolve active impersonation for the request's session, if any.
 * Cheap: one cookie read + one audit-row lookup.
 */
export async function getActiveViewAs(): Promise<ViewAsContext | null> {
  const auditId = cookies().get(VIEW_AS_COOKIE)?.value;
  if (!auditId) return null;

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: row } = await admin
    .from("journey_view_as_audit")
    .select("id, coach_id, viewed_user_id, couple_id, started_at, ended_at")
    .eq("id", auditId)
    .maybeSingle();

  if (!row) return null;
  const r = row as {
    id:             string;
    coach_id:       string;
    viewed_user_id: string;
    couple_id:      string | null;
    started_at:     string;
    ended_at:       string | null;
  };

  if (r.coach_id !== auth.user.id) return null;
  if (r.ended_at) return null;

  const startedMs = new Date(r.started_at).getTime();
  if (Number.isFinite(startedMs)) {
    if (Date.now() - startedMs > VIEW_AS_TTL_MS) return null;
  }

  return {
    viewedUserId: r.viewed_user_id,
    coachId:      r.coach_id,
    coupleId:     r.couple_id,
    auditId:      r.id,
  };
}
