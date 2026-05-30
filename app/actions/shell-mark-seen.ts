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

async function stamp(field: "expert_messages_seen_at" | "lessons_seen_at") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // no session → silent no-op

  await supabase
    .from("profiles")
    .update({ [field]: new Date().toISOString() })
    .eq("id", user.id);

  // Revalidate every shell route that reads the badge — the layout
  // (which calls getShellData) re-renders on next navigation. We
  // can't revalidate a locale prefix wildcard, so we hit the two
  // most likely landings.
  revalidatePath("/he/my/today");
  revalidatePath("/en/my/today");
  revalidatePath("/he/my/lessons");
  revalidatePath("/en/my/lessons");
  revalidatePath("/he/my/expert");
  revalidatePath("/en/my/expert");
}

export async function markExpertSurfaceSeen(): Promise<void> {
  await stamp("expert_messages_seen_at");
}

export async function markLessonsSurfaceSeen(): Promise<void> {
  await stamp("lessons_seen_at");
}
