"use client";

/**
 * components/my/OnboardingReminderCard.tsx
 *
 * Consolidated, NON-BLOCKING onboarding reminder shown at the top of /my for a
 * logged-in subscriber until they complete TWO items:
 *   1. Connect their partner   (couple partner_count >= 2)
 *   2. Complete the full assessment   (!isFullAssessmentPending)
 *
 * Each item shows a ✓ when done; a small "X מתוך 2 הושלם" progress line sits
 * under the header. The card auto-hides per-user when BOTH are done (the PAGE
 * decides visibility — see `showOnboarding` in app/[locale]/my/page.tsx — so
 * the per-user assessment read stays server-side / RLS-safe).
 *
 * Composition (we REUSE, never rebuild):
 *   - item-1 invite body  → <PartnerShareCard>      (code / copy / WhatsApp / QR
 *                            + "how it works"), CMS keys `myHub.share.*`.
 *   - partner "got a code?" → <RedeemCodeButton>     (opens the redeem dialog →
 *                            joinCoupleByPairCode).
 *   - item-2 CTA          → <Link href="/journey/assessment"> (same target as
 *                            the former CompleteFullAssessmentCard).
 *
 * This card REPLACES the two previously-scattered cards on /my (the standalone
 * PartnerShareCard top banner + CompleteFullAssessmentCard). It gates NOTHING —
 * pillars/lessons and all content stay fully open.
 *
 * Copy is CMS-configurable via useCmsText under `myHub.onboarding.*` (seeded in
 * messages/{he,en}.json). Each string keeps an inline he/en fallback, matching
 * the PartnerShareCard convention, so a blanked/unseeded key never renders raw.
 */

import { Link } from "@/navigation";
import { useLocale } from "next-intl";
import { Check, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";
import { PartnerShareCard } from "@/components/between-us/PartnerShareCard";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";

// Logo gold → deep amber, shared with the journey/assessment surfaces
// (AnalysisSummary). Used for the ✓ ticks, progress fill and item-2 CTA so the
// reminder reads as "gold-on-fuchsia".
const GOLD_GRADIENT = "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)";

/** useCmsText with an inline fallback when the key is blank/unseeded. */
function cmsOr(text: string, fallback: string): string {
  return text && text.trim().length > 0 ? text : fallback;
}

export function OnboardingReminderCard({
  pairCode,
  partnerConnected,
  fullAssessmentPending,
}: {
  /** The couple's pair_code — needed by the invite widget. */
  pairCode: string | null;
  /** item-1 ✓ : the partner has joined (couple partner_count >= 2). */
  partnerConnected: boolean;
  /** item-2 driver : true while this user's full assessment is still pending. */
  fullAssessmentPending: boolean;
}) {
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const item1Done = partnerConnected;
  const item2Done = !fullAssessmentPending;
  const doneCount = (item1Done ? 1 : 0) + (item2Done ? 1 : 0);

  // ── CMS copy (myHub.onboarding.*) ──────────────────────────────────────────
  const titleText = useCmsText("myHub.onboarding.title").text;
  const subtitleText = useCmsText("myHub.onboarding.subtitle").text;
  const progressTpl = useCmsText("myHub.onboarding.progress").text;
  const footerText = useCmsText("myHub.onboarding.footer").text;

  const item1Title = useCmsText("myHub.onboarding.item1.title").text;
  const item1Desc = useCmsText("myHub.onboarding.item1.desc").text;
  const item1DoneLabel = useCmsText("myHub.onboarding.item1.doneLabel").text;
  const item1DoneDesc = useCmsText("myHub.onboarding.item1.doneDesc").text;
  const item1EntryQ = useCmsText("myHub.onboarding.item1.entryQ").text;
  const item1EntryBody = useCmsText("myHub.onboarding.item1.entryBody").text;
  const item1EntryCta = useCmsText("myHub.onboarding.item1.entryCta").text;

  const item2Title = useCmsText("myHub.onboarding.item2.title").text;
  const item2Desc = useCmsText("myHub.onboarding.item2.desc").text;
  const item2DoneLabel = useCmsText("myHub.onboarding.item2.doneLabel").text;
  const item2DoneDesc = useCmsText("myHub.onboarding.item2.doneDesc").text;
  const item2Cta = useCmsText("myHub.onboarding.item2.cta").text;

  const progressLabel = cmsOr(
    progressTpl,
    isHe ? "{done} מתוך 2 הושלם" : "{done} of 2 done",
  ).replace("{done}", String(doneCount));

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      data-cms-key="myHub.onboarding.card"
      className="relative rounded-3xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-rose-500/15 p-6 backdrop-blur"
      style={{ boxShadow: "0 24px 60px -24px rgba(217,70,239,0.45)" }}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl"
          style={{ background: GOLD_GRADIENT, boxShadow: "0 10px 26px -8px rgba(252,202,101,0.6)" }}
          aria-hidden
        >
          <Sparkles className="h-6 w-6 text-[#1a1014]" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-[25px] font-extrabold leading-tight text-white"
            data-cms-key="myHub.onboarding.title"
          >
            {cmsOr(titleText, isHe ? "עוד שני צעדים קטנים — וזה מוכן" : "Two small steps — and you're set")}
          </h2>
          <p
            className="mt-1 text-[20px] leading-snug text-white/75"
            data-cms-key="myHub.onboarding.subtitle"
          >
            {cmsOr(
              subtitleText,
              isHe
                ? "שני צעדים קטנים נשארו, ואז המסע המלא נפתח לפניכם."
                : "Two small steps remain, and then your full journey opens.",
            )}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-5 flex items-center gap-3">
        <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(doneCount / 2) * 100}%`, background: GOLD_GRADIENT }}
          />
        </div>
        <span
          className="shrink-0 whitespace-nowrap text-[18px] text-white/70"
          data-cms-key="myHub.onboarding.progress"
        >
          {progressLabel}
        </span>
      </div>

      {/* ── Item 1 — connect partner ──────────────────────────────────────── */}
      <ChecklistItem
        index={1}
        done={item1Done}
        title={cmsOr(item1Title, isHe ? "חברו את בן/בת הזוג" : "Connect your partner")}
        desc={cmsOr(
          item1Desc,
          isHe
            ? "שתפו את הקוד — וברגע שהם יצטרפו, תקבלו תמונה זוגית מלאה."
            : "Share the code — once they join, you get the full couple picture.",
        )}
        doneLabel={cmsOr(item1DoneLabel, isHe ? "הושלם ✓" : "Done ✓")}
        doneDesc={cmsOr(item1DoneDesc, isHe ? "בן/בת הזוג מחוברים — נהדר!" : "Your partner is connected — great!")}
      >
        {/* invite body — reuses PartnerShareCard + RedeemCodeButton */}
        {pairCode ? <PartnerShareCard pairCode={pairCode} /> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-white/15 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold text-white" data-cms-key="myHub.onboarding.item1.entryQ">
              {cmsOr(item1EntryQ, isHe ? "קיבלתם קוד מבן/בת הזוג?" : "Got a code from your partner?")}
            </p>
            <p className="mt-0.5 text-[16px] leading-snug text-white/65" data-cms-key="myHub.onboarding.item1.entryBody">
              {cmsOr(
                item1EntryBody,
                isHe
                  ? "הזינו אותו כדי להתחבר ולפתוח את הגישה המשותפת שלכם."
                  : "Enter it to connect and unlock your shared access.",
              )}
            </p>
          </div>
          <RedeemCodeButton
            isHe={isHe}
            variant="pill"
            label={cmsOr(item1EntryCta, isHe ? "הזנת קוד" : "Enter code")}
          />
        </div>
      </ChecklistItem>

      {/* ── Item 2 — complete full assessment ─────────────────────────────── */}
      <ChecklistItem
        index={2}
        done={item2Done}
        title={cmsOr(item2Title, isHe ? "השלימו את האבחון המלא" : "Complete your full assessment")}
        desc={cmsOr(
          item2Desc,
          isHe
            ? "עוד כ-2 דקות — לתמונה מדויקת יותר ולצעדים שמותאמים בדיוק אליכם."
            : "About 2 more minutes — for a sharper picture and steps tailored to you.",
        )}
        doneLabel={cmsOr(item2DoneLabel, isHe ? "הושלם ✓" : "Done ✓")}
        doneDesc={cmsOr(item2DoneDesc, isHe ? "האבחון המלא הושלם — מצוין!" : "Full assessment complete — excellent!")}
      >
        <Link
          href="/journey/assessment"
          className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[20px] font-extrabold text-[#1a1014] transition hover:brightness-110"
          style={{ background: GOLD_GRADIENT, boxShadow: "0 14px 30px -12px rgba(252,202,101,0.6)" }}
          data-cms-key="myHub.onboarding.item2.cta"
        >
          {cmsOr(item2Cta, isHe ? "המשך לאבחון" : "Continue to assessment")}
          <Arrow className="h-5 w-5" />
        </Link>
      </ChecklistItem>

      {/* Footer — sets the non-blocking expectation */}
      <p
        className="mt-4 text-center text-[18px] leading-snug text-white/65"
        data-cms-key="myHub.onboarding.footer"
      >
        {cmsOr(
          footerText,
          isHe
            ? "ברגע ששני הצעדים יושלמו, נמשיך יחד אל המסע."
            : "Once both steps are done, we'll continue together into your journey.",
        )}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One checklist row: gold ✓ tick when done (collapsed to a confirmation line),
// numbered tick + `children` (the action body) when not.
// ─────────────────────────────────────────────────────────────────────────────
function ChecklistItem({
  index,
  done,
  title,
  desc,
  doneLabel,
  doneDesc,
  children,
}: {
  index: number;
  done: boolean;
  title: string;
  desc: string;
  doneLabel: string;
  doneDesc: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-[18px] ${
        done
          ? "border-[rgba(252,202,101,0.5)] bg-[rgba(252,202,101,0.08)]"
          : "border-white/12 bg-white/5"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold"
          style={
            done
              ? { background: GOLD_GRADIENT, color: "#1a1014", boxShadow: "0 6px 16px -6px rgba(252,202,101,0.7)" }
              : { border: "2px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.72)" }
          }
          aria-hidden
        >
          {done ? <Check className="h-5 w-5" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-bold leading-tight text-white">
            {title}
            {done ? (
              <span className="ms-2 text-[18px] font-semibold text-[#FCCA65]">{doneLabel}</span>
            ) : null}
          </p>
          <p className="mt-1 text-[19px] leading-snug text-white/70">
            {done ? doneDesc : desc}
          </p>
          {done ? null : children}
        </div>
      </div>
    </div>
  );
}
