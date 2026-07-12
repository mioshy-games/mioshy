import Link from "next/link";
import { CmsText } from "@/components/cms/CmsText";

/**
 * WeeklyProgramSection — "הליווי השבועי שלכם" (journeyHub.weekly.*). Extracted
 * from app/[locale]/journey/page.tsx so the marketing hub and the assessment
 * results page share ONE source (no duplication). The CTA target is
 * parameterised: the hub passes its primaryHref; the results page passes
 * "#ar-price" to scroll to the plans.
 */
export function WeeklyProgramSection({
  ctaHref,
  hideCta = false,
}: {
  ctaHref: string;
  /** Hide the bottom CTA (results-page instance); the marketing hub keeps it. */
  hideCta?: boolean;
}) {
  return (
    <section id="weekly" className="relative overflow-hidden bg-white px-4 pb-6 pt-[55px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: "radial-gradient(900px 500px at 50% -10%, rgba(252,202,101,0.08), transparent 50%)" }}
      />
      <div className="relative mx-auto max-w-[640px]">
        <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.28em] text-[#170E14]">
          <span className="h-[7px] w-[7px] rounded-sm bg-[#FCCA65] shadow-[0_0_0_3px_rgba(252,202,101,0.18)]" />
          <CmsText cmsKey="journeyHub.weekly.eyebrow" />
        </span>

        <h2
          className="mt-4 text-[34px] leading-[1.12] tracking-[-0.02em] text-[#170E14] sm:text-[40px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
        >
          <CmsText cmsKey="journeyHub.weekly.title" as="span" />{" "}
          <CmsText
            cmsKey="journeyHub.weekly.titleAccent"
            as="span"
            className="bg-[linear-gradient(110deg,#F43F5E_0%,#EC4899_45%,#A855F7_100%)] bg-clip-text text-transparent"
          />
        </h2>

        <CmsText
          cmsKey="journeyHub.weekly.lede"
          as="p"
          className="mt-5 text-[19px] leading-[1.6] text-[#170E14]"
        />

        <div className="mt-8 flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex items-start gap-4 py-7 ${i > 0 ? "border-t border-fuchsia-400/25" : ""}`}
            >
              <span
                className="min-w-[54px] shrink-0 bg-[linear-gradient(110deg,#F43F5E_0%,#EC4899_45%,#A855F7_100%)] bg-clip-text text-center text-[54px] leading-none tracking-[-0.02em] text-transparent"
                style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
              >
                0{i + 1}
              </span>
              <div>
                <CmsText
                  cmsKey={`journeyHub.weekly.cats.${i}.h`}
                  as="h3"
                  className="text-[23px] leading-[1.1] text-[#170E14]"
                  style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
                />
                <CmsText
                  cmsKey={`journeyHub.weekly.cats.${i}.p`}
                  as="p"
                  className="mt-1.5 text-[17px] leading-[1.45] text-[#170E14]/70"
                />
              </div>
            </div>
          ))}
        </div>

        {!hideCta ? (
          <div className="mt-10">
            <Link
              href={ctaHref}
              className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full px-8 text-[17px] font-semibold text-white shadow-xl shadow-fuchsia-500/25 transition hover:brightness-110 sm:w-auto"
              style={{ background: "linear-gradient(110deg,#F43F5E 0%,#EC4899 45%,#A855F7 100%)" }}
            >
              <CmsText cmsKey="journeyHub.weekly.cta" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
