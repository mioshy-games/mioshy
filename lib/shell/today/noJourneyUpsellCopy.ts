import "server-only";

import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

/**
 * Single source of truth for the NoJourneyUpsell *body + bullets*.
 *
 * Every NoJourneyUpsell call site consumes this so the copy can never drift:
 *   - the blocked-partner takeover on /my/lessons,
 *   - the no-journey upsell on /my/lessons,
 *   - the expert gate on /my/expert.
 *
 * Body + the two bullets resolve from the appShell.today.upsell* CMS keys
 * (messages/<locale>.json fallback). Call sites still own their own chip /
 * title / CTA — those vary by surface and gate state; only the body and the
 * two bullets are unified here.
 */
export async function getNoJourneyUpsellCopy(
  locale: "he" | "en",
): Promise<{ body: string; bullets: string[] }> {
  const t = await getCmsTranslations({
    locale,
    namespace: "appShell.today",
    page: "app-shell",
  });
  return {
    body: t("upsellBody"),
    bullets: [t("upsellBullet1"), t("upsellBullet2")],
  };
}
