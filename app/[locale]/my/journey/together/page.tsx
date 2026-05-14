/**
 * /[locale]/my/journey/together
 *
 * Layer-5 couple-shared surface. The "we" page that complements
 * /my/journey (the "I" page).
 *
 * Sections:
 *   1. Joint progress — items both partners completed
 *   2. Couple channel — shared thread with both partners + coach
 *   3. Asymmetry hint — gentle line when one partner is much
 *      further along (only when meaningful)
 *
 * Solo users (no couple) redirect to /my/journey.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, HeartHandshake } from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import {
  getCoupleChannelThread,
  ensureCoupleChannel,
} from "@/lib/journey-content/couple-channel";
import { getCoupleAsymmetry } from "@/lib/journey/asymmetry";
import { getCoachPersonaForUser } from "@/lib/journey/coach";
import { CoupleChannelThread } from "@/components/my/CoupleChannelThread";
import { getCurrentUserPauseState } from "@/lib/billing/pause-state";
import { getActiveViewAs } from "@/lib/journey/view-as";
import { ViewAsBanner } from "@/components/my/ViewAsBanner";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "myJourneyTogether",
    page: "my",
  });
  return {
    title: `Mioshy - ${t("metaTitle")}`,
    robots: { index: false, follow: false },
  };
}

export default async function TogetherPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "myJourneyTogether",
    page: "my",
  });

  // Auth + entitlement.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);
  const entitlements = await getUserEntitlements();
  if (!entitlements?.journey) redirect(`/${locale}/journey`);

  // L3 follow-up — paused users see the pause screen on /my/journey;
  // bouncing them back from /together keeps that the only entry point.
  const pauseState = await getCurrentUserPauseState();
  if (pauseState.isActive) redirect(`/${locale}/my/journey`);

  // FU6.S3 — view-as substitution: every read on this page is keyed
  // to `effectiveUserId` so the coach sees the user's actual together
  // surface (their partner, their channel, their joint progress).
  const viewAsContext = await getActiveViewAs();
  const effectiveUserId = viewAsContext?.viewedUserId ?? user.id;

  // Resolve couple. Solo users never see this page.
  const admin = createServiceRoleClient();
  if (!admin) redirect(`/${locale}/my/journey`);
  const { data: membership } = await admin
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", effectiveUserId)
    .maybeSingle();
  const coupleId = (membership as { couple_id: string } | null)?.couple_id;
  if (!coupleId) redirect(`/${locale}/my/journey`);

  // ensureCoupleChannel is an idempotent upsert. Skip when impersonating
  // — coach shouldn't write into the user's couple channel side-effects.
  if (!viewAsContext) {
    await ensureCoupleChannel(coupleId);
  }

  // Resolve view-as label for the banner.
  let viewAsLabel: string | null = null;
  if (viewAsContext) {
    const { data: viewedRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", viewAsContext.viewedUserId)
      .maybeSingle();
    const fullName =
      (viewedRow as { full_name: string | null } | null)?.full_name ?? null;
    viewAsLabel = fullName || viewAsContext.viewedUserId.slice(0, 8);
  }

  // Load: messages + asymmetry + the OTHER partner's name + coach persona.
  const [thread, asymmetry, allMembers] = await Promise.all([
    getCoupleChannelThread(coupleId),
    getCoupleAsymmetry(coupleId),
    admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId),
  ]);
  const memberRows = (allMembers.data ?? []) as Array<{ user_id: string }>;
  const otherUserId = memberRows
    .map((m) => m.user_id)
    .find((id) => id !== effectiveUserId);

  let partnerLabel = t("partnerLabel");
  if (otherUserId) {
    const { data: otherProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", otherUserId)
      .maybeSingle();
    const name = (otherProfile as { full_name: string | null } | null)?.full_name;
    if (name) partnerLabel = name.split(" ")[0] ?? name;
  }

  // Joint progress — items completed by BOTH partners.
  // We rely on a simple heuristic: scheduled_items where there are
  // 2 distinct completed_by values. For Layer 5 we count, not list.
  let jointCompletedCount = 0;
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  if (assignmentIds.length > 0) {
    const { data: scheduledRows } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .in("assignment_id", assignmentIds);
    const scheduledIds = ((scheduledRows ?? []) as Array<{ id: string }>).map(
      (r) => r.id,
    );
    if (scheduledIds.length > 0) {
      const { data: comps } = await admin
        .from("journey_item_completions")
        .select("scheduled_item_id, completed_by")
        .in("scheduled_item_id", scheduledIds);
      const byScheduled = new Map<string, Set<string>>();
      for (const c of (comps ?? []) as Array<{
        scheduled_item_id: string;
        completed_by: string | null;
      }>) {
        if (!c.completed_by) continue;
        const set = byScheduled.get(c.scheduled_item_id) ?? new Set();
        set.add(c.completed_by);
        byScheduled.set(c.scheduled_item_id, set);
      }
      for (const set of byScheduled.values()) {
        if (set.size >= 2) jointCompletedCount++;
      }
    }
  }

  const coachPersona = await getCoachPersonaForUser(effectiveUserId);
  const coachName = coachPersona
    ? (isHe ? coachPersona.displayNameHe : coachPersona.displayNameEn) ||
      coachPersona.displayNameHe
    : null;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] text-white"
    >
      {viewAsContext && viewAsLabel ? (
        <ViewAsBanner viewedLabel={viewAsLabel} isHe={isHe} />
      ) : null}
      <div className="mx-auto mt-6 max-w-3xl px-3 sm:px-4">
        <main className="mx-auto w-full px-4 pb-20 pt-10 sm:pt-14">
          <Link
            href="/my/journey"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
          >
            <Arrow className="h-3 w-3 rotate-180" />
            <CmsText cmsKey="myJourneyTogether.backToPage" />
          </Link>

          <header className="mt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B83C4D]/40 bg-[#B83C4D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]">
              <HeartHandshake className="h-3 w-3" />
              <CmsText cmsKey="myJourneyTogether.heading" />
            </span>
            <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              <CmsText cmsKey="myJourneyTogether.sharedSpace" />
            </h1>
            <CmsText
              cmsKey="myJourneyTogether.headerBlurb"
              as="p"
              className="mt-2 max-w-prose text-[15px] leading-relaxed text-white/65"
            />
          </header>

          {/* Joint progress strip — three small numbers, scannable */}
          <section className="mt-6 grid grid-cols-3 gap-3">
            <Stat
              label={t("statTogether")}
              value={jointCompletedCount.toString()}
              hint={t("bothCompleted")}
            />
            <Stat
              label={t("youLabel")}
              value={
                (asymmetry?.partners.find((p) => p.userId === effectiveUserId)
                  ?.completions ?? 0).toString()
              }
              hint={t("itemsHint")}
            />
            <Stat
              label={partnerLabel}
              value={
                (asymmetry?.partners.find((p) => p.userId !== effectiveUserId)
                  ?.completions ?? 0).toString()
              }
              hint={t("itemsHint")}
            />
          </section>

          {/* Asymmetry hint — only when meaningful AND coach hasn't
              already addressed it. Tone: a quiet observation, not a
              guilt trip. Surfaces a one-line invitation. */}
          {asymmetry && asymmetry.gapFraction >= 0.4 ? (
            <section
              className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/[0.06] px-4 py-3"
              aria-live="polite"
            >
              <p className="text-[14px] leading-snug text-amber-100/90">
                {(asymmetry.leaderUserId === effectiveUserId
                  ? t("asymmetryYouLead")
                  : t("asymmetryPartnerLead")
                ).replace("{partnerLabel}", partnerLabel)}
              </p>
            </section>
          ) : null}

          {/* Couple channel — the most-important surface on this page */}
          <div className="mt-8">
            <CoupleChannelThread
              isHe={isHe}
              coupleId={coupleId}
              viewerUserId={effectiveUserId}
              initialMessages={thread}
              partnerLabel={partnerLabel}
            />
          </div>

          {/* Coach hint */}
          {coachName ? (
            <p className="mt-4 text-center text-[12px] text-white/45">
              {t("coachHint").replace("{coachName}", coachName)}
            </p>
          ) : null}

          <footer className="mt-12 border-t border-white/5 pt-6 text-center">
            <CmsText
              cmsKey="myJourneyTogether.footerNote"
              as="p"
              className="text-xs text-white/40"
            />
          </footer>
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-1 font-heading text-[24px] font-extrabold leading-none text-white">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-white/45">{hint}</div>
      ) : null}
    </div>
  );
}
