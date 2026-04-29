import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getBetweenUsSettings } from "@/lib/between-us/queries";
import { SettingsForm } from "@/components/dashboard/between-us/SettingsForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { BetweenUsSettingsFormValues } from "@/lib/between-us/validations";

export const dynamic = "force-dynamic";

export default async function BetweenUsSettingsPage() {
  await requireAdmin();
  const settings = await getBetweenUsSettings();

  const defaultValues: BetweenUsSettingsFormValues = {
    section_slug: settings.section_slug,
    section_name_he: settings.section_name_he,
    section_name_en: settings.section_name_en,
    section_tagline_he: settings.section_tagline_he ?? "",
    section_tagline_en: settings.section_tagline_en ?? "",
    single_purchase_enabled: settings.single_purchase_enabled,
    monthly_enabled: settings.monthly_enabled,
    annual_enabled: settings.annual_enabled,
    buy_x_get_x_enabled: settings.buy_x_get_x_enabled,
    single_price_ils: Number(settings.single_price_ils),
    single_price_usd: Number(settings.single_price_usd),
    monthly_price_ils: Number(settings.monthly_price_ils),
    monthly_price_usd: Number(settings.monthly_price_usd),
    annual_price_ils: Number(settings.annual_price_ils),
    annual_price_usd: Number(settings.annual_price_usd),
    buy_x_get_x_tiers: Array.isArray(settings.buy_x_get_x_tiers)
      ? settings.buy_x_get_x_tiers.map((t) => ({
          buy: Number(t.buy),
          get: Number(t.get),
        }))
      : [],
    default_intimacy_badge_url: settings.default_intimacy_badge_url ?? null,
    default_communication_badge_url:
      settings.default_communication_badge_url ?? null,
    default_heat_badge_url: settings.default_heat_badge_url ?? null,
    preview_cards_count: settings.preview_cards_count,
    show_empty_state_cta: settings.show_empty_state_cta,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/adults"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Adults Only — Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Global settings for the couples-games section. Everything here is
            live as soon as you save.
          </p>
        </div>
        <Link
          href="/dashboard/adults/games"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Manage games →
        </Link>
      </div>

      <SettingsForm defaultValues={defaultValues} />
    </div>
  );
}
