"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: "active" | "paused" | "canceled" | "cancelled",
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status })
    .eq("id", subscriptionId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/subscriptions");
  return { ok: true as const };
}

