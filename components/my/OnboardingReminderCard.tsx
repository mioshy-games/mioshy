"use client";

/**
 * components/my/OnboardingReminderCard.tsx
 *
 * The body of the /my/setup landing (work-order 2026-06-15, part C — revised).
 *
 * Concept: NON-BLOCKING landing shown only while the user's assessment is still
 * pending. The ASSESSMENT is the single thing that matters — finishing it is
 * what makes this landing go away. Connecting a partner is NEVER mandatory and
 * never affects whether the page appears; it is presented per `partnerMode`:
 *   · "task"     — journey buyer: a recommended (optional) invite step.
 *   · "optional" — bought another product: an optional recommendation.
 *   · "disabled" — no purchase: a visible but greyed, inert row.
 *
 * Composition (we REUSE, never rebuild): <PartnerShareCard> for the invite and
 * <RedeemCodeButton> for "got a code?". Copy is CMS-configurable via useCmsText
 * under `myHub.onboarding.*` with inline he/en fallbacks.
 */

import { Link } from "@/navigation";
import { useLocale } from "next-intl";
import { Check, Sparkles, ArrowLeft, ArrowRight, Users } from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";
import { PartnerShareCard } from "@/components/between-us/PartnerShareCard";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import type { PartnerInviteMode } from "@/lib/journey/setup-landing";

// Logo gold → deep amber, shared with the journey/assessment surfaces.
const GOLD_GRADIENT = "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)";

/** useCmsText with an inline fallback when the key is blank/unseeded. */
function cmsOr(text: string, fallback: string): string {
  return text && text.trim().length > 0 ? text : fallback;
}

export function OnboardingReminderCard({
  pairCode,
  partnerConnected,
  partnerMode,
}: {
  /** The couple's pair_code — needed by the invite widget. */
  pairCode: string | null;
  /** The partner has joined (couple partner_count >= 2). */
  partnerConnected: boolean;
  /** How to present the partner-invite row. Never a blocking task. */
  partnerMode: PartnerInviteMode;
}) {
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // ── CMS copy (myHub.onboarding.*) ──────────────────────────────────────────
  const titleText = useCmsText("myHub.onboarding.title").text;
  const subtitleText = useCmsText("myHub.onboarding.subtitle").text;
  const footerText = useCmsText("myHub.onboarding.footer").text;

  const item1Title = useCmsText("myHub.onboarding.item1.title").text;
  const item1Desc = useCmsText("myHub.onboarding.item1.desc").text;
  const item1DoneLabel = useCmsText("myHub.onboarding.item1.doneLabel").text;
  const item1DoneDesc = useCmsText("myHub.onboarding.item1.doneDesc").text;
  const item1EntryQ = useCmsText("myHub.onboarding.item1.entryQ").text;
  const item1EntryBody = useCmsText("myHub.onboarding.item1.entryBody").text;
  const item1EntryCta = useCmsText("myHub.onboarding.item1.entryCta").text;
  const item1OptionalTag = useCmsText("myHub.onboarding.item1.optionalTag").text;
  const item1OptionalDesc = useCmsText("myHub.onboarding.item1.optionalDesc").text;
  const item1DisabledDesc = useCmsText("myHub.onboarding.item1.disabledDesc").text;

  const item2Title = useCmsText("myHub.onboarding.item2.title").text;
  const item2Desc = useCmsText("myHub.onboarding.item2.desc").text;
  const item2Cta = useCmsText("myHub.onboarding.item2.cta").text;

  const partnerTitle = cmsOr(
    item1Title,
    isHe ? "צרפו את בן/בת הזוג" : "Connect your partner",
  );

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
            {cmsOr(titleText, isHe ? "צעד אחרון לפני שמתחילים" : "One last step before we begin")}
          </h2>
          <p
            className="mt-1 text-[20px] leading-snug text-white/75"
            data-cms-key="myHub.onboarding.subtitle"
          >
            {cmsOr(
              subtitleText,
              isHe
                ? "נשאר להשלים את האבחון — וכל המסע ייפתח לפניכם."
                : "Just the assessment left — and your whole journey opens.",
            )}
          </p>
        </div>
      </div>

      {/* ── Primary: complete the assessment ─────────────────────────────── */}
      <div className="mt-5 rounded-2xl border border-[rgba(252,202,101,0.45)] bg-[rgba(252,202,101,0.08)] p-[18px]">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
            style={{ background: GOLD_GRADIENT, color: "#1a1014", boxShadow: "0 6px 16px -6px rgba(252,202,101,0.7)" }}
            aria-hidden
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-bold leading-tight text-white" data-cms-key="myHub.onboarding.item2.title">
              {cmsOr(item2Title, isHe ? "השלימו את האבחון המלא" : "Complete your full assessment")}
            </p>
            <p className="mt-1 text-[19px] leading-snug text-white/70" data-cms-key="myHub.onboarding.item2.desc">
              {cmsOr(
                item2Desc,
                isHe
                  ? "עוד כ-2 דקות — לתמונה מדויקת יותר ולצעדים שמותאמים בדיוק אליכם."
                  : "About 2 more minutes — for a sharper picture and steps tailored to you.",
              )}
            </p>
            <Link
              href="/journey/assessment"
              className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[20px] font-extrabold text-[#1a1014] transition hover:brightness-110"
              style={{ background: GOLD_GRADIENT, boxShadow: "0 14px 30px -12px rgba(252,202,101,0.6)" }}
              data-cms-key="myHub.onboarding.item2.cta"
            >
              {cmsOr(item2Cta, isHe ? "המשך לאבחון" : "Continue to assessment")}
              <Arrow className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Secondary: connect a partner — NEVER mandatory ───────────────────
          Presentation depends on `partnerMode`; none of it affects whether
          this landing appears (only the assessment above does). */}
      {partnerMode === "disabled" ? (
        // No purchase yet → visible but greyed and inert.
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-[18px] opacity-60">
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-white/20 text-white/40"
              aria-hidden
            >
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-bold leading-tight text-white/60">{partnerTitle}</p>
              <p className="mt-1 text-[19px] leading-snug text-white/45" data-cms-key="myHub.onboarding.item1.disabledDesc">
                {cmsOr(
                  item1DisabledDesc,
                  isHe
                    ? "זמין כשתצטרפו לליווי — אז תוכלו לצרף את בן/בת הזוג לתמונה משותפת."
                    : "Available once you join the program — then you can add your partner for a shared picture.",
                )}
              </p>
            </div>
          </div>
        </div>
      ) : partnerConnected ? (
        // Already paired → quiet confirmation.
        <div className="mt-4 rounded-2xl border border-[rgba(252,202,101,0.5)] bg-[rgba(252,202,101,0.08)] p-[18px]">
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
              style={{ background: GOLD_GRADIENT, color: "#1a1014" }}
              aria-hidden
            >
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-bold leading-tight text-white">
                {partnerTitle}
                <span className="ms-2 text-[18px] font-semibold text-[#FCCA65]">
                  {cmsOr(item1DoneLabel, isHe ? "הושלם ✓" : "Done ✓")}
                </span>
              </p>
              <p className="mt-1 text-[19px] leading-snug text-white/70" data-cms-key="myHub.onboarding.item1.doneDesc">
                {cmsOr(item1DoneDesc, isHe ? "בן/בת הזוג מחוברים — נהדר!" : "Your partner is connected — great!")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        // "task" (journey) or "optional" (other product) → actionable invite,
        // framed as recommended, not required.
        <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-[18px]">
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-white/72"
              aria-hidden
            >
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-bold leading-tight text-white">
                {partnerTitle}
                <span className="ms-2 rounded-full bg-white/10 px-2 py-0.5 text-[14px] font-semibold text-white/70">
                  {cmsOr(item1OptionalTag, isHe ? "לא חובה" : "Optional")}
                </span>
              </p>
              <p className="mt-1 text-[19px] leading-snug text-white/70">
                {partnerMode === "optional"
                  ? cmsOr(
                      item1OptionalDesc,
                      isHe
                        ? "אפשר לצרף את בן/בת הזוג ולגלות יחד עוד על הזוגיות שלכם."
                        : "You can add your partner and discover more about your relationship together.",
                    )
                  : cmsOr(
                      item1Desc,
                      isHe
                        ? "שתפו את הקוד — וברגע שהם יצטרפו, תקבלו תמונה זוגית מלאה."
                        : "Share the code — once they join, you get the full couple picture.",
                    )}
              </p>

              {pairCode ? (
                <div className="mt-3">
                  <PartnerShareCard pairCode={pairCode} />
                </div>
              ) : null}

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
            </div>
          </div>
        </div>
      )}

      {/* Footer — sets the non-blocking expectation */}
      <p
        className="mt-4 text-center text-[18px] leading-snug text-white/65"
        data-cms-key="myHub.onboarding.footer"
      >
        {cmsOr(
          footerText,
          isHe
            ? "אפשר להמשיך לכל מקום בכל רגע — העמוד הזה ילווה אתכם עד שתשלימו את האבחון."
            : "Feel free to go anywhere anytime — this page stays with you until the assessment is done.",
        )}
      </p>
    </div>
  );
}
