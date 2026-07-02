import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { TrialSettingsForm } from "@/components/dashboard/trial/TrialSettingsForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TrialRow = { product: "games" | "journey"; coaching: boolean; enabled: boolean };

export default async function TrialSettingsPage() {
  await requireAdmin();

  // Service client: trial_settings is public-read but we read via admin to be
  // independent of RLS session state on the dashboard.
  const admin = await createAdminClient();
  const { data } = await admin
    .from("trial_settings")
    .select("product, coaching, enabled");

  const initial: TrialRow[] = ((data ?? []) as TrialRow[]).map((r) => ({
    product: r.product,
    coaching: r.coaching,
    enabled: r.enabled,
  }));

  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}
        >
          <ArrowLeft className="ml-1 size-4" />
          חזרה להגדרות
        </Link>
        <h1 className="text-2xl font-bold">7 ימי ניסיון חינם</h1>
        <p className="text-muted-foreground">
          בחר אילו מנויים מציעים תקופת ניסיון של 7 ימים.
        </p>
      </div>

      <TrialSettingsForm initial={initial} />
    </div>
  );
}
