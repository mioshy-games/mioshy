/**
 * Resolves the data needed by /my/share.
 *
 *   - pair_code from the user's couple row (auto-generated upstream)
 *   - flag for "already paired" so the page can pivot to a "you're
 *     paired with X" celebration card instead of the share UI
 *
 * If the user isn't part of a couple yet (just signed up, never paid)
 * we still surface the share UI so the partner can join — `pair_code`
 * is generated lazily via the existing /api/couple/ensure flow in a
 * follow-up step. For now we return `null` and the page renders an
 * onboarding-style placeholder.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";

interface Args {
  userId: string;
  locale: "he" | "en";
}

export interface ShareData {
  /** The pair code shared with the partner. Null = no code yet. */
  pairCode: string | null;
  /** True when a partner has already joined the couple. */
  alreadyPaired: boolean;
  /** Partner's display name (if paired). */
  partnerName: string | null;
  /** Localized share message that pre-fills WhatsApp / SMS / email. */
  shareMessage: string;
  /** Absolute URL the partner taps to claim the invite. */
  shareUrl: string | null;
}

/**
 * Build the share URL the partner will tap. Matches the existing
 * widget format: /<locale>/auth/signup?code=XYZ. The signup page
 * already wires this code into the couple-claim flow.
 */
function buildShareUrl(pairCode: string, locale: "he" | "en"): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com")
    .replace(/\/+$/, "");
  return `${base}/${locale}/auth/signup?code=${encodeURIComponent(pairCode)}`;
}

export async function getShareData(args: Args): Promise<ShareData> {
  const { userId, locale } = args;
  const isHe = locale === "he";

  const couple = await getCurrentCoupleContext();
  const coupleId = couple?.couple_id ?? null;

  let pairCode: string | null = null;
  let partnerName: string | null = null;
  let alreadyPaired = false;

  if (coupleId) {
    const admin = createServiceRoleClient();
    if (admin) {
      // Read the couple row for the pair code.
      const { data: row } = await admin
        .from("couples")
        .select("pair_code")
        .eq("id", coupleId)
        .maybeSingle();
      pairCode = (row as { pair_code: string | null } | null)?.pair_code ?? null;

      // Other member's name — present means a partner has joined.
      const { data: members } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", coupleId)
        .neq("user_id", userId)
        .limit(1);
      const otherId = (members ?? [])[0]?.user_id as string | undefined;
      if (otherId) {
        alreadyPaired = true;
        const { data: prof } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", otherId)
          .maybeSingle();
        partnerName =
          (prof as { full_name: string | null } | null)?.full_name?.trim() ?? null;
      }
    }
  }

  const shareUrl = pairCode ? buildShareUrl(pairCode, isHe ? "he" : "en") : null;

  // Pre-canned share message — admin can edit later via CMS, but the
  // shell ships with a sensible default in both locales.
  const shareMessage = pairCode
    ? isHe
      ? `הצטרפו אלי למסע במיאושי 💛 הקוד שלנו: ${pairCode}\n${shareUrl}`
      : `Join me on Mioshy 💛 our code: ${pairCode}\n${shareUrl}`
    : isHe
      ? "הצטרפו אלי למיאושי 💛"
      : "Join me on Mioshy 💛";

  return {
    pairCode,
    alreadyPaired,
    partnerName,
    shareMessage,
    shareUrl,
  };
}
