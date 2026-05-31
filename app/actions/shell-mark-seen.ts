"use server";

/**
 * Server actions used by <MarkSurfaceSeen /> to clear nav badges when
 * a user lands on the corresponding shell page.
 *
 *   markExpertSurfaceSeen()  — called on /my/expert mount.
 *                              Stamps profiles.expert_messages_seen_at.
 *   markLessonsSurfaceSeen() — called on /my/lessons mount.
 *                              Stamps profiles.lessons_seen_at.
 *
 * Both functions:
 *   • require an authenticated session (no-op when missing — never
 *     writes to a random profile);
 *   • use the SESSION client so RLS still applies (the user can only
 *     update their OWN profile row);
 *   • call `revalidatePath` on the shell-mounted routes so the next
 *     SSR resolves the new badge counts from getShellData.
 *
 * Idempotent — bumping the timestamp twice in a row is harmless. The
 * action returns void; the client component fires it and ignores any
 * response.
 *
 * Added 2026-05-29 (Step B5 of the post-login redesign).
 */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { makeLogger } from "@/lib/observability/log";

// 2026-05-31 — surface every mark-seen call in Vercel logs. Both helpers
// are silent no-ops on session-loss, which can hide a regression in the
// auth path. Filter by `scope=shell.action.mark_seen` to see each call.
const log = makeLogger("shell.action.mark_seen");

async function stamp(field: "expert_messages_seen_at" | "lessons_seen_at") {
  const t0 = Date.now();
  log.info("start", { surface: field });
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    log.warn("no_session", { surface: field });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    log.error("update_failed", {
      surface: field,
      user_id: user.id,
      reason: error.message,
    });
    return;
  }

  // Revalidate every shell route that reads the badge — the layout
  // (which calls getShellData) re-renders on next navigation. We can't
  // revalidate a locale prefix wildcard, so we hit the likely landings.
  revalidatePath("/he/my/today");
  revalidatePath("/en/my/today");
  revalidatePath("/he/my/lessons");
  revalidatePath("/en/my/lessons");
  revalidatePath("/he/my/expert");
  revalidatePath("/en/my/expert");

  log.info("done", {
    surface: field,
    user_id: user.id,
    dur_ms: Date.now() - t0,
  });
}

export async function markExpertSurfaceSeen(): Promise<void> {
  await stamp("expert_messages_seen_at");
}

export async function markLessonsSurfaceSeen(): Promise<void> {
  await stamp("lessons_seen_at");
}
