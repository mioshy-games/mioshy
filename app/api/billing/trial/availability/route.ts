/**
 * GET /api/billing/trial/availability?product=journey&coaching=false
 *
 * Display-only: tells a client CTA whether a 7-day trial is offered for a
 * (product, coaching) package and the post-trial charge amount (for the
 * "then ₪X" disclosure). The real eligibility/abuse/pricing enforcement runs
 * server-side in /api/billing/checkout/create-trial. isIsraeli is derived from
 * the request IP (v1 is ILS-only).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { geoFromRequest } from "@/lib/geo-from-request";
import { getTrialAvailability } from "@/lib/billing/trial-availability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productRaw = url.searchParams.get("product");
  const coaching = url.searchParams.get("coaching") === "true";
  const plan = url.searchParams.get("plan"); // cadence hint (optional)

  if (productRaw !== "games" && productRaw !== "journey") {
    return NextResponse.json({ enabled: false, amount: null, currency: null });
  }

  const geo = geoFromRequest(req);
  const admin = await createAdminClient();

  try {
    const result = await getTrialAvailability(admin, {
      product: productRaw,
      coaching,
      isIsraeli: geo.isIsraeli,
      plan,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[trial/availability] failed", err);
    // Fail closed: no trial offered → CTA falls back to the paid flow.
    return NextResponse.json({ enabled: false, amount: null, currency: null });
  }
}
