import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth/admin";
import { listAllPrices } from "@/lib/billing/pricing-queries";
import { PricingForm } from "@/components/dashboard/pricing/PricingForm";
import {
  CADENCES_BY_PRODUCT,
  PRICING_PRODUCTS,
  type PricingFormValues,
} from "@/lib/billing/pricing-validations";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Weeks per cadence — used to seed no-discount placeholder prices for
// cadence slots that don't exist in the DB yet (admin then edits/enables).
const WEEKS: Record<string, number> = {
  weekly: 1,
  monthly: 4.345,
  quarterly: 13.04,
  yearly: 52.14,
};

const FALLBACK_WEEKLY: Record<string, { ils: number; usd: number }> = {
  games: { ils: 9, usd: 3 },
  journey: { ils: 57, usd: 17 },
};

export default async function SubscriptionPricingPage() {
  await requireAdmin();
  const prices = await listAllPrices();

  // Build the full (product × cadence) matrix: real rows where they
  // exist, no-discount placeholders (disabled) for slots not seeded yet.
  const rows: PricingFormValues["rows"] = [];
  for (const product of PRICING_PRODUCTS) {
    const existing = prices.filter((p) => p.product === product);
    const weekly = existing.find((p) => p.cadence === "weekly");
    const baseIls = weekly ? Math.round(weekly.price_ils) : FALLBACK_WEEKLY[product].ils;
    const baseUsd = weekly ? Math.round(weekly.price_usd) : FALLBACK_WEEKLY[product].usd;

    for (const cadence of CADENCES_BY_PRODUCT[product]) {
      const row = existing.find((p) => p.cadence === cadence);
      if (row) {
        rows.push({
          product,
          cadence,
          price_ils: Math.round(row.price_ils),
          price_usd: Math.round(row.price_usd),
          enabled: row.enabled,
          is_default: row.is_default,
        });
      } else {
        const w = WEEKS[cadence] ?? 1;
        rows.push({
          product,
          cadence,
          price_ils: Math.round(baseIls * w),
          price_usd: Math.round(baseUsd * w),
          enabled: false,
          is_default: false,
        });
      }
    }
  }

  const defaultValues: PricingFormValues = { rows };

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          חזרה להגדרות
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">תמחור מנויים</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          מחירי מנוי לפי מוצר וקדנציה. כל שינוי נכנס לתוקף מיד עם השמירה — בלי
          deploy. התצוגה ללקוח נשארת שבועית.
        </p>
      </div>

      {prices.length === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          לא נמצאו שורות תמחור. ודאו ש-migration 112 הוחל על מסד הנתונים.
        </div>
      ) : (
        <PricingForm defaultValues={defaultValues} />
      )}

      <div className="border-t pt-4">
        <Link
          href="/dashboard/adults/settings"
          className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
        >
          תמחור Adults (חד-פעמי) ←
        </Link>
      </div>
    </div>
  );
}
