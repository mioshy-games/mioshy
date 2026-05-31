/**
 * /my/today → /my/lessons permanent redirect.
 *
 * 2026-05-31 — Itzik collapsed the two-tab "Today + My Lessons" model
 * into a single "My Lessons" entry. The Today content (current lesson
 * hero + chat preview + focus pill + history) now lives at the top of
 * /my/lessons under a "Today" pill section.
 *
 * Keeping the route as a server redirect (instead of deleting the file)
 * means:
 *   • Bookmarked /my/today links still land users on the right page.
 *   • The SiteHeader / auth flows that historically wrote /my/today as
 *     the "post-login next" continue to work during the transition.
 *
 * `redirect()` issues a 307 by default which is fine for nav — the
 * browser preserves the GET method and there's no body to forward.
 */

import { redirect } from "next/navigation";

export default function TodayLegacyRedirect({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/my/lessons`);
}
