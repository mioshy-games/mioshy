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
  if (auth.user) {
    const admin = await createAdminClient();
    const { data } = await admin.from("poll_subscriptions").select("subscribed").eq("user_id", auth.user.id).maybeSingle();
    subscribed = data?.subscribed ?? false;
  }
  return <PollDashboardLanding initialSubscribed={subscribed} />;
}
