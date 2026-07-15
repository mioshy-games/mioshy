/**
 * components/my/PairingPopups.tsx
 *
 * Server component that mounts the once-per-session pairing popup for the
 * authenticated user, split by role — the same role split the /my hub does,
 * but reusable from anywhere. It exists because the funnel almost never lands
 * users on /my (the hub): post-payment journey buyers go to /journey/assessment
 * → /my/journey, and the post-login decider sends everyone to /my/setup or
 * /my/lessons — all under the (shell) group. Mounting this in the shell layout
 * makes the invite / redeem popup fire wherever a funnel user actually lands.
 *
 *   · entitled owner who still needs a partner → invite popup (PartnerShareCard).
 *   · logged-in non-purchaser (no couple)      → "enter your code" popup.
 *   · already paired / partner                 → nothing.
 *
 * Lazy couple creation mirrors /my: some purchase paths (Cardcom indicator
 * webhook, hand-granted subs) don't create the couple row, and a buyer who
 * never visits /my would otherwise have no pair_code → the owner popup could
 * never satisfy `pair_code`. We create it idempotently here so the popup works.
 *
 * getCurrentCoupleContext + getUserEntitlements are React.cache-wrapped, so the
 * extra calls here collapse onto the same round-trips the shell layout already
 * made — no added cost on the happy path.
 */

import {
  getCurrentCoupleContext,
  getCurrentCoupleContextFresh,
} from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { hasActionablePendingInvitationForEmail } from "@/lib/between-us/invitations";
import { MyInvitePopup } from "@/components/my/MyInvitePopup";

export async function PairingPopups() {
  const [initialCtx, entitlements] = await Promise.all([
    getCurrentCoupleContext(),
    getUserEntitlements(),
  ]);
  // Not authenticated / no entitlement resolved → the surrounding shell layout
  // already handles the auth redirect; render nothing here.
  if (!initialCtx || !entitlements) return null;
  let ctx = initialCtx;

  // Lazy couple creation for entitled owners so pair_code exists (idempotent).
  if (entitlements.pillarCount > 0 && !ctx.couple_id) {
    try {
      const { createCoupleForSelf } = await import(
        "@/app/actions/between-us-couple"
      );
      const created = await createCoupleForSelf();
      if (created.ok) {
        const refreshed = await getCurrentCoupleContextFresh();
        if (refreshed) ctx = refreshed;
      }
    } catch {
      // Non-fatal — the popup just won't show this render.
    }
  }

  const hasCouple = !!ctx.couple_id;
  const partnerCount = ctx.partner_count ?? 0;

  // Full couple → the pairing job is done; never mount either popup again.
  // (The role-specific checks below already exclude this, but make the
  // "stop once paired" contract explicit and robust.)
  if (hasCouple && partnerCount >= 2) return null;

  const needsPartner = hasCouple && partnerCount < 2;
  const isOwner = !hasCouple || ctx.role === "owner";

  // Owner (purchaser) who still needs a partner → invite/share popup.
  if (hasCouple && needsPartner && ctx.pair_code && isOwner) {
    return <MyInvitePopup mode="owner" pairCode={ctx.pair_code} />;
  }

  // Logged-in non-purchaser (no couple at all). Do NOT auto-open the "enter your
  // code" popup for a plain free registrant (Itzik 2026-07-15) — nobody invited
  // them, so it's confusing. Genuinely-invited partners are auto-redeemed at
  // signup (OtpFlow consumes the ?code=), so they already have a couple by here.
  // Auto-open only when a REAL actionable pending invitation exists for their
  // email (best-effort; false where couple_invitations is absent, e.g. prod).
  // The standing "enter code" card on /my stays available for a manual open.
  // NOTE: this runs in the shell layout, which has no access to searchParams, so
  // the ?code= signal is handled at signup / on the /my hub page, not here.
  if (!hasCouple) {
    const invited = await hasActionablePendingInvitationForEmail(
      entitlements.email,
    );
    return invited ? (
      <MyInvitePopup mode="redeemer" redirectTo="/my/lessons" />
    ) : null;
  }

  return null;
}
