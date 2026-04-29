import { requireAdmin } from "@/lib/auth/admin";
import type { SiteSettingsRow } from "@/lib/types/database";
import { HomepageAdminClient } from "./HomepageAdminClient";

export const metadata = { title: "Homepage editor — Mioshy Admin" };

export default async function HomepageAdminPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings = (data ?? {
    id: 1,
    updated_at: new Date().toISOString(),
    home_hero_bg_type: "gradient",
    home_hero_bg_value: "default",
    expert_photo_url: null,
    social_proof_couples_count: 0,
    rating_value: 4.9,
    rating_count: 0,
  }) as SiteSettingsRow;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Homepage Editor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control every image, text, button and link on the public homepage.
        </p>
      </div>
      <HomepageAdminClient settings={settings} />
    </div>
  );
}
