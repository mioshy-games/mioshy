/**
 * /my/start — post-login landing decider (C, work-order 2026-06-15).
 *
 * The login/signup forms send the user here (instead of straight to
 * /my/lessons). This is the ONE place that decides the landing — it is NOT a
 * per-page gate: it renders nothing and immediately redirects, so it only ever
 * runs at the login-landing moment, never during normal navigation.
 *
 *   · assessment still pending → /my/setup   (the non-blocking landing card)
 *   · otherwise               → /my/lessons  ("הפרקים שלי", the normal hub)
 *
 * Both targets enforce auth themselves (shell layout → /auth when logged out),
 * so an unauthenticated hit flows through to /my/lessons → /auth.
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSetupLandingState } from "@/lib/journey/setup-landing";

export const dynamic = "force-dynamic";

export default async function MyStartPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);

  const { pending } = await getSetupLandingState();
  redirect(pending ? `/${locale}/my/setup` : `/${locale}/my/lessons`);
}
