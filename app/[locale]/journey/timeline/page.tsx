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
import { preferCoupleOwner } from "@/lib/journey-content/owner";
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
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "מסע זוגי · הציר שלכם" : "Journey · Your timeline"}`,
    description: isHe
      ? "המסלול האישי שלכם - פרקים שנפתחים בקצב שלכם, תרגולים ותובנות."
      : "Your personal path - chapters that open at your pace, exercises and insights.",
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

  // ── Resolve owner (solo user OR their couple) ─────────────────────────
  const couple = await getCurrentCoupleContext();
  const owner = preferCoupleOwner(user.id, couple?.couple_id ?? null);

  // ── Load timeline ─────────────────────────────────────────────────────
  // Pass the viewer's couple_member role so audience-targeted items
  // ('owner'|'partner') are filtered to the right person. Solo users
  // see everything as 'both'.
  const entries = await getTimelineForOwner({
    owner,
    viewerUserId: user.id,
    viewerCoupleRole: couple?.role ?? null,
  }).catch(() => []);

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
            <span className="font-semibold text-indigo-100">
              {isHe ? "המסע שלכם" : "Your journey"}
            </span>
          </div>

          <h1 className="mt-5 flex items-center justify-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
            <Compass className="h-9 w-9 text-indigo-300 sm:h-11 sm:w-11" />
            {isHe ? "הציר שלכם עדיין ריק" : "Your timeline is still empty"}
          </h1>

          <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
            {isHe
              ? "לאחר שתצטרפו למסלול, פרקים אישיים ייפתחו כאן בקצב שלכם - תרגולים, שיחות וטקסי שבוע."
              : "Once you join a program, personal chapters will open here at your own pace - exercises, conversations, and weekly rituals."}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/journey"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
            >
              {isHe ? "גלו את המסע" : "Explore the Journey"}
              <Arrow className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              href="/journey/assessment"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10"
            >
              {isHe ? "התחילו באבחון של 5 דק׳" : "Start with the 5-min assessment"}
            </Link>
          </div>

          <Link
            href="/my"
            className="mt-10 inline-flex items-center gap-1 text-xs font-medium text-white/50 transition hover:text-white/80"
          >
            <Arrow className="h-3 w-3 rotate-180" />
            {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
          </Link>
        </main>
      </div>
    );
  }

  // ── Populated timeline ────────────────────────────────────────────────
  return (
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
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        {/* v3 slice 5 — grace banner. Renders nothing when journeyState
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
              <span className="font-semibold text-indigo-100">
                {isHe ? "ציר המסע" : "Journey timeline"}
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              <Compass className="h-7 w-7 text-indigo-300 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
              {isHe ? "המסע שלכם" : "Your journey"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:mt-3 sm:text-base">
              {isHe
                ? "כל פרק נפתח בזמן שלו. כשהגיע התור - היכנסו, תרגלו וענו יחד."
                : "Each chapter opens on its own time. When it's ready - step in, reflect, and practice together."}
            </p>
          </div>

          {/* Progress summary - full width on mobile, right-aligned on desktop */}
          <div className="self-start sm:self-end">
            <ProgressSummary
              isHe={isHe}
              total={counts.total}
              completed={counts.completed}
              available={counts.available}
              locked={counts.locked}
              progressPct={progress}
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
            <span>{isHe ? "כל הפרקים" : "All chapters"}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <TimelineList
            entries={entries}
            locale={locale}
            viewerUserId={user.id}
            partnered={(couple?.partner_count ?? 0) >= 2}
          />
        </section>

        {/* Recent activity — the user's own audit trail */}
        <section className="mt-10 sm:mt-12">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <span>{isHe ? "ההיסטוריה שלכם" : "Recent activity"}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <UserRecentActivity userId={user.id} isHe={isHe} />
        </section>

        {/* Trust anchor - quiet but present, reinforcing this is a
            guided, proven service rather than auto-generated content. */}
        <TrustAnchor isHe={isHe} />
      </main>
    </div>
  );
}

// ------------------------------------------------------------
// TrustAnchor - compact "designed by Itzik Berlav · since 2001"
// footer for journey surfaces. Keeps the reassurance subtle so it
// reads as background authority rather than marketing.
// ------------------------------------------------------------

function TrustAnchor({ isHe }: { isHe: boolean }) {
  return (
    <aside
      aria-label={isHe ? "עוגן אמון" : "Trust anchor"}
      className="mt-16 flex flex-col items-center gap-3 border-t border-white/5 pt-10 text-center"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
        <ShieldCheck className="h-3.5 w-3.5" />
        {isHe ? "ליווי מקצועי מאז 2001" : "Trusted guidance since 2001"}
      </div>
      <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-start backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400/85 to-fuchsia-500/85 text-white shadow-inner">
          <Heart className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">
            {isHe ? "איציק ברלב" : "Itzik Berlav"}
          </span>
          <span className="text-xs text-white/60">
            {isHe
              ? "מומחה ליחסים זוגיים · ליווי זוגות למעלה מ-25 שנה"
              : "Couples specialist · Over 25 years coaching relationships"}
          </span>
        </div>
      </div>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-white/55">
        {isHe
          ? "כל פרק במסע נבנה על בסיס אלפי שיחות עם זוגות אמיתיים - לא תוכן גנרי, אלא צעדים שעובדים."
          : "Every chapter is built on thousands of real couples' conversations - not generic content, but steps that actually work."}
      </p>
    </aside>
  );
}

// ------------------------------------------------------------
// Progress summary - compact ring + 3 stat pills
// ------------------------------------------------------------

function ProgressSummary({
  isHe,
  total,
  completed,
  available,
  locked,
  progressPct,
}: {
  isHe: boolean;
  total: number;
  completed: number;
  available: number;
  locked: number;
  progressPct: number;
}) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (progressPct / 100) * circ;

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
          label={isHe ? "הושלמו" : "Done"}
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5 text-amber-200" />}
          value={available}
          label={isHe ? "פתוחים" : "Open"}
        />
        <Stat
          icon={<Lock className="h-3.5 w-3.5 text-white/60" />}
          value={locked}
          label={isHe ? "נעולים" : "Locked"}
        />
      </div>
      <div className="sr-only">
        {isHe
          ? `התקדמות: ${completed} מתוך ${total}`
          : `Progress: ${completed} of ${total}`}
      </div>
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
