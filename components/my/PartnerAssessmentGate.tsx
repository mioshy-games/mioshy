import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { CmsText } from "@/components/cms/CmsText";

/**
 * PartnerAssessmentGate — journey shared-content spec, step 3.
 *
 * Full-screen BLOCK shown on /my/journey when the viewer is a PARTNER who is
 * deferred to the subscription owner's chapter queue (step 1 resolver) but has
 * NOT completed their OWN full assessment yet (journeys.status !== 'complete').
 * It blocks the shared content entirely — it does not merely offer — and routes
 * to /journey/assessment with a warm explanation of WHY the assessment matters,
 * rather than a dry redirect. Copy is CMS-driven (myJourney.partnerGate*) so it
 * follows the page's existing CmsText pattern and stays editable without a
 * deploy. owner / solo never see this (their resolver returns self).
 */
export function PartnerAssessmentGate({ isHe }: { isHe: boolean }) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center bg-[#0b0a12] px-4 py-16"
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center backdrop-blur sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ClipboardCheck className="h-7 w-7 text-[#FCCA65]" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <CmsText cmsKey="myJourney.partnerGateTitle" />
        </h1>
        <CmsText
          cmsKey="myJourney.partnerGateBody"
          as="p"
          className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base"
        />
        <Link
          href="/journey/assessment"
          className="mt-7 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-black transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)" }}
        >
          <CmsText cmsKey="myJourney.partnerGateCta" />
          <Arrow className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
