/**
 * JourneyFirstSession
 * ─────────────────────────────────────────────────────────
 * Layer-1 single-purpose landing screen for a user's FIRST visit
 * to /my/journey after purchase.
 *
 * Replaces the full dashboard (rail, desk, activity, channel, etc.)
 * with one block whose only job is: get the user to tap into the
 * day-1 item.
 *
 * Why a separate screen?
 *   • The dashboard has 6 stacked surfaces — overwhelming on day 1.
 *   • The user just paid; they need immediate momentum on a single
 *     achievable next step.
 *   • The activation moment (open first item → post response →
 *     read expert reply) is the highest-leverage event in the
 *     entire product. We isolate it.
 *
 * Server-rendered. The first-time flag flips on the item-detail page
 * the moment the user opens it (markFirstSessionCompleted), so on
 * the second visit /my/journey naturally falls through to the
 * regular dashboard.
 */

import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Sparkles, Lock } from "lucide-react";

interface ExpertPersona {
  displayName: string;
  shortBio?: string | null;
  avatarUrl?: string | null;
}

interface FirstItem {
  scheduledId: string;
  title: string;
  bodySnippet: string | null;
  categoryName: string | null;
}

interface Props {
  isHe: boolean;
  /** Day-1 unlocked item — null when materialisation hasn't completed yet. */
  firstItem: FirstItem | null;
  /** Assigned expert's persona — null when no coach is paired yet (rare). */
  expertPersona: ExpertPersona | null;
}

export function JourneyFirstSession({
  isHe,
  firstItem,
  expertPersona,
}: Props) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // No first item materialised yet — render the "preparing your program"
  // fallback. This usually means the cardcom webhook is in-flight; the
  // user will see the real screen on next refresh (typically <60s).
  if (!firstItem) {
    return (
      <FirstSessionShell isHe={isHe}>
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/70">
            <Lock className="h-3 w-3" />
            {isHe ? "התוכנית שלכם בבנייה" : "Building your program"}
          </span>
          <h1 className="mt-3 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
            {isHe ? "כמעט מוכן" : "Almost ready"}
          </h1>
          <p className="mt-3 text-[15px] text-white/65">
            {isHe
              ? "תרעננו את הדף בעוד דקה — הצעד הראשון יחכה לכם כאן."
              : "Refresh in a minute — your first step will be waiting here."}
          </p>
        </div>
      </FirstSessionShell>
    );
  }

  return (
    <FirstSessionShell isHe={isHe}>
      <article
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
        style={{
          borderColor: "rgba(184,60,77,0.45)",
          background:
            "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
          boxShadow: "0 30px 80px -28px rgba(184,60,77,0.5)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "#B83C4D" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B83C4D]/40 bg-[#B83C4D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]">
            <Sparkles className="h-3 w-3" />
            {isHe ? "ברוכים הבאים" : "Welcome"}
          </span>

          <h1 className="mt-4 font-heading text-[30px] font-extrabold leading-tight text-white sm:text-[36px]">
            {isHe ? "הצעד הראשון" : "Step one"}
          </h1>

          {firstItem.categoryName ? (
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-white/55">
              {firstItem.categoryName}
            </p>
          ) : null}

          <h2 className="mt-3 font-heading text-[22px] font-bold leading-snug text-white sm:text-[24px]">
            {firstItem.title}
          </h2>

          {firstItem.bodySnippet ? (
            <p className="mt-3 line-clamp-3 text-[15px] leading-[1.6] text-white/75">
              {firstItem.bodySnippet}
            </p>
          ) : null}

          <Link
            href={`/journey/timeline/${firstItem.scheduledId}`}
            className="group mt-6 inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-bold text-white transition hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 18px 40px -12px rgba(184,60,77,0.55)",
            }}
          >
            {isHe ? "להתחיל" : "Begin"}
            <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" />
          </Link>
        </div>
      </article>

      {/* Expert intro — small, warm, sets the relationship up
          before the user even reads the item body. */}
      {expertPersona ? (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
          {expertPersona.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={expertPersona.avatarUrl}
              alt={expertPersona.displayName}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-bold text-[#FAF6F7]"
              style={{
                background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              }}
            >
              {expertPersona.displayName.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-white/55">
              {isHe ? "המאמן/ת שלכם" : "Your coach"}
            </p>
            <p className="mt-0.5 text-[16px] font-bold text-white">
              {expertPersona.displayName}
            </p>
            {expertPersona.shortBio ? (
              <p className="mt-1 text-[14px] leading-[1.55] text-white/70">
                {expertPersona.shortBio}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </FirstSessionShell>
  );
}

function FirstSessionShell({
  isHe,
  children,
}: {
  isHe: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-6 px-5 pb-16 pt-10 text-white sm:gap-8 sm:pt-14"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #B83C4D 0%, transparent 70%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
