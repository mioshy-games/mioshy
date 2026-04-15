"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function cancelSubscription(subscriptionId: string) {
  const supabase = await createServerSupabaseClient();
  await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId);
}

