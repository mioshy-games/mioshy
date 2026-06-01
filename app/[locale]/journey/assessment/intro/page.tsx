/**
 * /[locale]/journey/assessment/intro → /[locale]/journey/assessment
 *
 * 2026-06-01 — Itzik: the pre-assessment "pact" screen was an extra
 * click that interrupted the user mid-funnel. Removed entirely from
 * the flow; the route stays as a permanent redirect so any
 * historical link (emails, blog posts, share screens) still lands
 * the user on the assessment instead of a 404.
 *
 * Behaviour kept by the assessment page itself: it already detects
 * an in-progress journey and resumes where the user left off.
 */

import { redirect } from "next/navigation";

export default function AssessmentIntroRedirect({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/journey/assessment`);
}
