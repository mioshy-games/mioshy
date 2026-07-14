import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { PollDashboardLanding } from "@/components/survey/PollDashboardLanding";

export const dynamic = "force-dynamic";

/**
 * Dashboard landing for "סקר הזוגיות של ישראל" (screen 5). Lives INSIDE the
 * existing (shell) — inherits the current header / hamburger / sidebar. Shows
 * the join confirmation + a daily-question subscribe toggle (§6) + a link to
 * answer today's question.
 */
export default async function MySurveyPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  let subscribed = false;
  let userName: string | null = null;
  if (auth.user) {
    const admin = await createAdminClient();
    const [{ data: sub }, { data: profile }] = await Promise.all([
      admin.from("poll_subscriptions").select("subscribed").eq("user_id", auth.user.id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    ]);
    subscribed = sub?.subscribed ?? false;
    // First name only for a friendlier invite ("דנה מזמינה אותך…").
    userName = (profile?.full_name ?? "").trim().split(/\s+/)[0] || null;
  }
  return <PollDashboardLanding initialSubscribed={subscribed} userName={userName} />;
}
