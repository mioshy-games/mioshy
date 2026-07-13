/**
 * GET  /api/poll/subscribe  → { subscribed: boolean }  (current user's state)
 * POST /api/poll/subscribe  body { subscribed: boolean }  → toggle (§6)
 *
 * Requires a logged-in user (the daily poll subscription is per account).
 * Uses the existing Supabase auth; writes poll_subscriptions (migration 187).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

async function currentUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = await createAdminClient();
  const { data } = await admin.from("poll_subscriptions").select("subscribed").eq("user_id", userId).maybeSingle();
  return NextResponse.json({ subscribed: data?.subscribed ?? false });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const subscribed = body?.subscribed === true;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("poll_subscriptions")
    .upsert({ user_id: userId, subscribed, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscribed });
}
