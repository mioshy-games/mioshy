/**
 * /[locale]/journey/timeline
 *
 * The user-facing timeline for the Journey Content System (Phase 5).
 *
 * Shows every scheduled item across the viewer's active assignments,
 * grouped by category, with status-aware affordances (locked / available /
 * completed). If the viewer has no active assignments we render a warm
 * empty state that points back to the marketing pillar - this is the
 * surface an owner arrives at after a successful purchase (Phase 6 will
 * wire that redirect).
 *
 * Ownership resolution follows preferCoupleOwner: once a user has paired
 * into a couple, the couple is the owner and the timeline is shared with
 * the partner. Solo users see their user-scoped assignments. This keeps
 * the solo→couple migration cheap (see #81).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/navigation";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  Map as MapIcon,
  ShieldCheck,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { preferCoupleOwner, journeyOwnerForUser } from "@/lib/journey-content/owner";
import { partnerAssessmentGateState } from "@/lib/journey-content/partner-gate";
import { PartnerAssessmentGate } from "@/components/my/PartnerAssessmentGate";
import { getTimelineForOwner } from "@/lib/journey-content/queries";
import { countStatuses } from "@/lib/journey-content/status";
import type { TimelineEntry } from "@/lib/journey-content/types";
import { TimelineList } from "@/components/journey/timeline/TimelineList";
import { NextUpHero } from "@/components/journey/timeline/NextUpHero";
import { UserRecentActivity } from "@/components/journey/timeline/UserRecentActivity";
import { JourneyGraceBanner } from "@/components/my/JourneyGraceBanner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "journeyTimeline.page",
    page: "journey",
  });
  return {
    title: `Mioshy - ${t("meta.title")}`,
    description: t("meta.description"),
    robots: { index: false, follow: false },
  };
}

export default async function JourneyTimelinePage({
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
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "journeyTimeline.page",
    page: "journey",
  });
  const cmsRows = await loadCmsTextsForPage("journey");

  // ── Auth gate ──────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  // ── Entitlement gate ──────────────────────────────────────────────────
  // v3 slice 5: blocked users (post-grace) get bounced to /journey
  // where the locked screen takes over. Grace users keep access to
  // past content and see the grace banner above the timeline. Active
  // users see no banner.
  const entitlements = await getUserEntitlements(user.id).catch(() => null);
  const journeyState = entitlements?.journeyState ?? null;
  const journeyGraceUntil = entitlements?.journeyGraceUntil ?? null;
  if (!entitlements?.journey) {
    redirect(`/${locale}/journey`);
  }

  // ── Resolve owners — TWO axes (matches /my/journey pattern) ──────────
  // Itzik 2026-05-28 — regression fix from the auto-create-couple change.
  //
  // Before: every subscriber had a couple → preferCoupleOwner returned
  // couple-scoped owner → ownerFilter queried journey_assignments WHERE
  // couple_id = X. But cadence assignments (the per-user content
  // containers shipped 2026-05-24, see auto-assign.ts and the v3 NOTE
  // on owner.ts:51-57) are ALWAYS user-scoped — couple_id is NULL on
  // them by design. Result: a brand-new paying user who'd just done
  // the assessment saw an empty timeline because the query was
  // looking at the wrong column.
  //
  // Fix: mirror /my/journey:540-593 — fetch legacy (program/category/
  // item) assignments against the couple-preferred owner AND cadence
  // assignments against the strict per-user owner, then merge by
  // unlock_at. Both lists feed the same downstream TimelineList.
  // Shared-content gate (spec step 3, shared helper): a deferred partner who
  // hasn't finished their own full assessment is blocked BEFORE the owner's
  // cadence timeline loads below. Standalone page → full-screen gate.
  if ((await partnerAssessmentGateState(user.id)).blocked) {
    return <PartnerAssessmentGate isHe={isHe} />;
  }

  const couple = await getCurrentCoupleContext();
  const legacyOwner = preferCoupleOwner(user.id, couple?.couple_id ?? null);
  const cadenceOwner = await journeyOwnerForUser(user.id);

  // ── Load timeline ─────────────────────────────────────────────────────
  // Pass the viewer's couple_member role so audience-targeted items
  // ('owner'|'partner') are filtered to the right person. Solo users
  // see everything as 'both'. Cadence axis ignores viewerCoupleRole
  // because cadence is per-user.
  const [legacyEntries, cadenceEntries] = await Promise.all([
    getTimelineForOwner({
      owner: legacyOwner,
      viewerUserId: user.id,
      viewerCoupleRole: couple?.role ?? null,
      sourceKinds: ["program", "category", "item"],
    }).catch(() => []),
    getTimelineForOwner({
      owner: cadenceOwner,
      viewerUserId: user.id,
      viewerCoupleRole: null,
      sourceKinds: ["cadence"],
    }).catch(() => []),
  ]);
  // Merge by unlock_at ascending — same as /my/journey:589-593.
  const entries = [...legacyEntries, ...cadenceEntries].sort((a, b) => {
    const ua = new Date(a.scheduled.unlock_at).getTime();
    const ub = new Date(b.scheduled.unlock_at).getTime();
    return ua - ub;
  });

  const counts = countStatuses(entries.map((e) => e.status));
  const progress =
    counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

  // Pick the single "next action" to feature in the hero:
  //   1. the first available entry (the user's immediate next step)
  //   2. else the nearest upcoming locked entry (their motivation)
  //   3. else null (all done → victory card)
  const nextUpEntry: TimelineEntry | null =
    entries.find((e) => e.status === "available") ??
    entries.find((e) => e.status === "locked") ??
    null;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // ── Empty state ───────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <CmsTextProvider rows={cmsRows}>
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative min-h-[100dvh] overflow-hidden text-white"
      >
        {/* Soft aurora glow - indigo / emerald journey palette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(1200px 600px at 15% -10%, rgba(99,102,241,0.28), transparent 60%), radial-gradient(900px 500px at 85% 0%, rgba(16,185,129,0.18), transparent 60%)",
          }}
        />

        <main className="relative mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
            <CmsText
              cmsKey="journeyTimeline.page.yourJourney"
              className="font-semibold text-indigo-100"
            />
          </div>

          <h1 className="mt-5 flex items-center justify-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
            <Compass className="h-9 w-9 text-indigo-300 sm:h-11 sm:w-11" />
            <CmsText cmsKey="journeyTimeline.page.empty.h1" />
          </h1>

          <CmsText
            cmsKey="journeyTimeline.page.empty.lede"
            as="p"
            className="mt-5 max-w-xl text-base text-white/75 sm:text-lg"
          />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* Itzik 2026-05-28: the "גלו את המסע" primary button used to
                point at /journey — the public marketing page — which made
                no sense for a paying user who'd already landed on the
                authed timeline. Now points at /my/journey, the private
                dashboard where the coach card and first-session content
                already render even before journey_assignments populate. */}
            <Link
              href="/my/journey"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
            >
              <CmsText cmsKey="journeyTimeline.page.empty.ctaExplore" />
              <Arrow className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              href="/journey/assessment"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10"
            >
              <CmsText cmsKey="journeyTimeline.page.empty.ctaAssessment" />
            </Link>
          </div>

          <Link
            href="/my"
            className="mt-10 inline-flex items-center gap-1 text-xs font-medium text-white/50 transition hover:text-white/80"
          >
            <Arrow className="h-3 w-3 rotate-180" />
            <CmsText cmsKey="journeyTimeline.page.backToMy" />
          </Link>
        </main>
      </div>
      </CmsTextProvider>
    );
  }

  // ── Populated timeline ────────────────────────────────────────────────
  return (
    <CmsTextProvider rows={cmsRows}>
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] overflow-hidden text-white"
    >
      {/* Ambient layer 1 - the top "aurora" accent that anchors the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] opacity-70 animate-aurora-drift"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(900px 500px at 80% 10%, rgba(16,185,129,0.16), transparent 60%)",
        }}
      />
      {/* Ambient layer 2 - mid-scroll depth: keeps the page feeling alive
          once you leave the hero. Slower breathing motion than layer 1. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[60vh] h-[100vh] opacity-55 animate-aurora-breathe"
        style={{
          background:
            "radial-gradient(900px 500px at 85% 30%, rgba(236,72,153,0.10), transparent 60%), radial-gradient(800px 400px at 10% 60%, rgba(99,102,241,0.14), transparent 60%)",
        }}
      />
      {/* Ambient layer 3 - deep bottom warmth for the trust anchor area */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[60vh] opacity-45"
        style={{
          background:
            "radial-gradient(700px 400px at 50% 100%, rgba(251,191,36,0.10), transparent 60%), radial-gradient(600px 300px at 15% 90%, rgba(16,185,129,0.12), transparent 60%)",
        }}
      />
      {/* Subtle drifting particles for texture on long scrolls */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, white 1px, transparent 1.5px), radial-gradient(circle at 75% 75%, white 1px, transparent 1.5px)",
          backgroundSize: "96px 96px, 160px 160px",
        }}
      />

      <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-14">
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          <CmsText cmsKey="journeyTimeline.page.backToMy" />
        </Link>

        {/* v3 slice 5 - grace banner. Renders nothing when journeyState
            is 'active' or null. */}
        <div className="mt-5">
          <JourneyGraceBanner
            isHe={isHe}
            state={journeyState}
            graceUntil={journeyGraceUntil}
          />
        </div>

        {/* Header - compact on mobile so the hero leads the scroll */}
        <section className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-xs backdrop-blur">
              <MapIcon className="h-3.5 w-3.5 text-indigo-200" />
              <CmsText
                cmsKey="journeyTimeline.page.timelineBadge"
                className="font-semibold text-indigo-100"
              />
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              <Compass className="h-7 w-7 text-indigo-300 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
              <CmsText cmsKey="journeyTimeline.page.yourJourney" />
            </h1>
            <CmsText
              cmsKey="journeyTimeline.page.timelineLede"
              as="p"
              className="mt-2 max-w-2xl text-sm text-white/70 sm:mt-3 sm:text-base"
            />
          </div>

          {/* Progress summary - full width on mobile, right-aligned on desktop.
              Stat labels resolved here via t() so the inner Stat sub-component
              stays a plain string-prop consumer. */}
          <div className="self-start sm:self-end">
            <ProgressSummary
              total={counts.total}
              completed={counts.completed}
              available={counts.available}
              locked={counts.locked}
              progressPct={progress}
              labelDone={t("progress.done")}
              labelOpen={t("progress.open")}
              labelLocked={t("progress.locked")}
              srTemplate={t("progress.srTemplate")}
            />
          </div>
        </section>

        {/* Next up - the visually dominant "do this now" card */}
        <section className="mt-6 sm:mt-8">
          <NextUpHero
            entry={nextUpEntry}
            locale={locale}
            total={counts.total}
            completed={counts.completed}
          />
        </section>

        {/* Timeline list */}
        <section className="mt-10 sm:mt-12">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <CmsText cmsKey="journeyTimeline.page.allChapters" />
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <TimelineList
            entries={entries}
            locale={locale}
            viewerUserId={user.id}
            partnered={(couple?.partner_count ?? 0) >= 2}
          />
        </section>

        {/* Recent activity - the user's own audit trail */}
        <section className="mt-10 sm:mt-12">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <CmsText cmsKey="journeyTimeline.page.recentActivity" />
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <UserRecentActivity userId={user.id} isHe={isHe} />
        </section>

        {/* Trust anchor - quiet but present, reinforcing this is a
            guided, proven service rather than auto-generated content.
            aria-label resolved via t() since the slot is an HTML attribute. */}
        <TrustAnchor ariaLabel={t("trust.ariaLabel")} />
      </main>
    </div>
    </CmsTextProvider>
  );
}

// ------------------------------------------------------------
// TrustAnchor - compact "designed by Itzik Berlav · since 2001"
// footer for journey surfaces. Keeps the reassurance subtle so it
// reads as background authority rather than marketing.
// ------------------------------------------------------------

function TrustAnchor({ ariaLabel }: { ariaLabel: string }) {
  return (
    <aside
      aria-label={ariaLabel}
      className="mt-16 flex flex-col items-center gap-3 border-t border-white/5 pt-10 text-center"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
        <ShieldCheck className="h-3.5 w-3.5" />
        <CmsText cmsKey="journeyTimeline.page.trust.guidance" />
      </div>
      <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-start backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400/85 to-fuchsia-500/85 text-white shadow-inner">
          <Heart className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <CmsText
            cmsKey="journeyTimeline.page.trust.name"
            className="text-sm font-semibold text-white"
          />
          <CmsText
            cmsKey="journeyTimeline.page.trust.title"
            className="text-xs text-white/60"
          />
        </div>
      </div>
      <CmsText
        cmsKey="journeyTimeline.page.trust.body"
        as="p"
        className="mt-1 max-w-md text-xs leading-relaxed text-white/55"
      />
    </aside>
  );
}

// ------------------------------------------------------------
// Progress summary - compact ring + 3 stat pills
// ------------------------------------------------------------

function ProgressSummary({
  total,
  completed,
  available,
  locked,
  progressPct,
  labelDone,
  labelOpen,
  labelLocked,
  srTemplate,
}: {
  total: number;
  completed: number;
  available: number;
  locked: number;
  progressPct: number;
  labelDone: string;
  labelOpen: string;
  labelLocked: string;
  // Template with {completed}/{total} placeholders, filled at render.
  srTemplate: string;
}) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (progressPct / 100) * circ;
  const srText = srTemplate
    .replace("{completed}", String(completed))
    .replace("{total}", String(total));

  return (
    <div className="inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      {/* Ring */}
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="7"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
          {progressPct}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs text-white/75">
        <Stat
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
          value={completed}
          label={labelDone}
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5 text-amber-200" />}
          value={available}
          label={labelOpen}
        />
        <Stat
          icon={<Lock className="h-3.5 w-3.5 text-white/60" />}
          value={locked}
          label={labelLocked}
        />
      </div>
      <div className="sr-only">{srText}</div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-[3.25rem] rounded-lg bg-white/5 px-2 py-1.5">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}
