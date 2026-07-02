/**
 * GET /api/promo/campaign
 *
 * Powers the holiday-campaign sticky top bar (task 21) — shown ONLY in
 * promo_mode=campaign_timer with an active journey promo. Returns the shared
 * deadline + the admin display text. In personal_window/off → show:false, which
 * is the "one active indicator at a time" resolver at the campaign layer (the
 * personal-window line + trial escalation live on their own surfaces/modes).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getPromoMode } from "@/lib/billing/promo-mode";
import { findActivePromo } from "@/lib/billing/promos";

export async function GET() {
  try {
    const admin = await createAdminClient();
    const mode = await getPromoMode(admin);
    if (mode !== "campaign_timer") return NextResponse.json({ show: false });

    const { promo } = await findActivePromo(admin, { product: "journey", coaching: false });
    if (!promo?.ends_at) return NextResponse.json({ show: false });

    return NextResponse.json({
      show: true,
      endsAt: promo.ends_at,
      // display_text is admin-authored (migration 147); the bar renders it as-is.
      text: (promo as { display_text?: string | null }).display_text ?? null,
    });
  } catch {
    return NextResponse.json({ show: false });
  }
}
