/**
 * /my/start — post-login landing decider (C, work-order 2026-06-15).
 *
 * The login/signup forms send the user here (instead of straight to
 * /my/lessons). This is the ONE place that decides the landing — it is NOT a
 * per-page gate: it renders nothing and immediately redirects, so it only ever
 * runs at the login-landing moment, never during normal navigation.
 *
 * Itzik 2026-07-31 — the full assessment is NO LONGER a gate. It used to send
 * a paying subscriber to /my/setup while their assessment was pending, which is
 * how content ended up sitting behind it. The assessment is an invitation to
 * sharpen the order, never a door: everyone lands on their chapters, and
 * /my/setup stays reachable on its own.
 *
 * Both targets enforce auth themselves (shell layout → /auth when logged out),
 * so an unauthenticated hit flows through to /my/lessons → /auth.
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function MyStartPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);

  redirect(`/${locale}/my/lessons`);
}
