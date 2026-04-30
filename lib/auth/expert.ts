import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Auth helpers for the "Mioshy Coaching" expert role.
 *
 * Roles:
 *   - 'admin'  — full dashboard access (existing). Implicitly an expert
 *                — can see/manage every couple's coaching path.
 *   - 'expert' — limited dashboard access. Can only see couples linked to
 *                them via the `expert_couples` table.
 *   - 'user'   — no dashboard access.
 */

export type ExpertSession = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: { id: string; email?: string | null };
  isAdmin: boolean;
};

export async function getExpertSession(): Promise<ExpertSession | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  if (profile.role !== "admin" && profile.role !== "expert") return null;

  return {
    supabase,
    user: { id: user.id, email: user.email ?? null },
    isAdmin: profile.role === "admin",
  };
}

export async function requireExpert(): Promise<ExpertSession> {
  const session = await getExpertSession();
  if (!session) {
    redirect("/");
  }
  return session;
}
