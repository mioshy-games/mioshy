/**
 * GET /api/trial/status
 *
 * Per-user trial status for the /my days-6-7 escalation (task 21). Returns the
 * trial day (1..7), deadline, and the amount that will be charged on day 7
 * (intro if still within the intro window, else plan_amount). No trial → show:false.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ show: false });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, plan_amount, intro_amount, intro_charges_remaining, currency")
    .eq("user_id", auth.user.id)
    .eq("status", "trialing")
    .order("trial_ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!sub?.trial_ends_at) return NextResponse.json({ show: false });

  const remainingMs = new Date(sub.trial_ends_at).getTime() - Date.now();
  const remainingDays = Math.ceil(remainingMs / 86_400_000);
  const day = Math.min(7, Math.max(1, 8 - remainingDays)); // 1 on signup … 7 last day

  const useIntro = (sub.intro_charges_remaining ?? 0) > 0 && sub.intro_amount != null;
  const amount = useIntro ? sub.intro_amount : sub.plan_amount;

  return NextResponse.json({
    show: true,
    day,
    trialEndsAt: sub.trial_ends_at,
    amount,
    currency: sub.currency ?? "ILS",
  });
}
