"use client";

/**
 * JourneyAssessmentIntro
 * ─────────────────────────────────────────────────────────
 * Layer-1 pre-assessment commitment screen.
 *
 * One screen, three blocks:
 *   1. Duration / scope card ("10 min × 4 weeks")
 *   2. Privacy line ("each of you answers separately")
 *   3. Pact commitment + I'm-in button
 *
 * Self-contained. Only side effect: POSTs `recordPactCommitment`
 * on click, then navigates to the questionnaire.
 *
 * Sprint 4 #3 Phase 2A migration — 13 keys under
 * journeyAssessment.intro.*. The `dir`/icon-colour decisions stay
 * locale-driven; only user-visible strings moved to CMS.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordPactCommitment } from "@/app/actions/journey-pact";
import { toast } from "sonner";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  isHe: boolean;
  locale: string;
}

export function JourneyAssessmentIntro({ isHe, locale }: Props) {
  const router = useRouter();
  const [committing, setCommitting] = useState(false);

  // Strings used in a non-DOM context (toast, busy-state Button child).
  const ctaBusyLabel = useCmsText("journeyAssessment.intro.ctaBusy").text;
  const saveErrorMsg = useCmsText("journeyAssessment.intro.saveError").text;

  const onCommit = async () => {
    setCommitting(true);
    const res = await recordPactCommitment({});
    if (!res.ok) {
      setCommitting(false);
      toast.error(saveErrorMsg);
      return;
    }
    // No toast on success — the page transition is the confirmation.
    router.push(`/${locale}/journey/assessment`);
  };

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-7 px-5 pb-16 pt-10 text-white sm:gap-9 sm:pt-14"
    >
      {/* Soft halo behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #B83C4D 0%, transparent 70%)",
        }}
      />

      <header className="relative space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B83C4D]/40 bg-[#B83C4D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]">
          <Sparkles className="h-3 w-3" />
          <CmsText cmsKey="journeyAssessment.intro.eyebrow" />
        </span>
        <CmsText
          cmsKey="journeyAssessment.intro.title"
          as="h1"
          className="font-heading text-[32px] font-extrabold leading-tight sm:text-[40px]"
        />
        <CmsText
          cmsKey="journeyAssessment.intro.subtitle"
          as="p"
          className="max-w-prose text-[16px] leading-[1.65] text-white/75"
        />
      </header>

      {/* Duration card */}
      <section className="relative flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#FAF6F7]"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
          }}
        >
          <Clock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <CmsText
            cmsKey="journeyAssessment.intro.durationTitle"
            as="h2"
            className="font-heading text-[18px] font-bold leading-tight text-white"
          />
          <CmsText
            cmsKey="journeyAssessment.intro.durationBody"
            as="p"
            className="mt-1 text-[14px] leading-[1.55] text-white/70"
          />
        </div>
      </section>

      {/* Privacy card */}
      <section className="relative flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-100"
          style={{ background: "rgba(16,185,129,0.18)" }}
        >
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <CmsText
            cmsKey="journeyAssessment.intro.privacyTitle"
            as="h2"
            className="font-heading text-[18px] font-bold leading-tight text-white"
          />
          <CmsText
            cmsKey="journeyAssessment.intro.privacyBody"
            as="p"
            className="mt-1 text-[14px] leading-[1.55] text-white/70"
          />
        </div>
      </section>

      {/* Pact commitment — the conversion moment */}
      <section
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
          <CmsText
            cmsKey="journeyAssessment.intro.pactHeader"
            as="h2"
            className="font-heading text-[22px] font-extrabold leading-tight text-white sm:text-[26px]"
          />
          <CmsText
            cmsKey="journeyAssessment.intro.pactBody"
            as="p"
            className="mt-2 max-w-prose text-[16px] leading-[1.6] text-white/80"
          />
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/journey`)}
              className="text-[14px] text-white/55 underline-offset-4 hover:text-white/80 hover:underline"
              disabled={committing}
            >
              <CmsText cmsKey="journeyAssessment.intro.backLink" />
            </button>
            <Button
              type="button"
              onClick={() => void onCommit()}
              disabled={committing}
              className="min-h-[54px] rounded-full px-8 text-[16px] font-bold"
              style={{
                background:
                  "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
                boxShadow: "0 16px 36px -12px rgba(184,60,77,0.55)",
              }}
            >
              {committing ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" />
                  {ctaBusyLabel}
                </>
              ) : (
                <CmsText cmsKey="journeyAssessment.intro.cta" />
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
