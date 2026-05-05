/**
 * LegalPageShell — shared layout for /terms, /refund-policy, /privacy
 * and /accessibility.
 *
 * Reads its content from a structured payload so each page can stay a
 * thin wrapper around a single `useTranslations` namespace + `t.raw`
 * call. Keeps headings semantic (h1 → h2 → h3 → h4) and uses Tailwind
 * logical properties (`text-start`, `ps-`, `pe-`) so it works in both
 * RTL (he) and LTR (en) without per-locale overrides.
 *
 * Visual direction matches the rest of the site: deep midnight base,
 * faint accent gradient at the top of the hero so legal pages feel
 * part of the product instead of a stripped-down legal annex. The body
 * is intentionally low-style — generous line-height + comfortable
 * measure (max-w-3xl ≈ 65ch) so people can actually read.
 */

import type { ReactNode } from "react";

export type LegalSection = {
  /** Section heading (h2). */
  heading: string;
  /**
   * Section body. A plain string renders as a single <p>; an array
   * renders one <p> per item (paragraphs separated by spacing).
   */
  body: string | string[];
  /** Optional sub-sections with their own h3. */
  subsections?: LegalSubsection[];
  /** Optional bullet list rendered after the body. */
  list?: string[];
};

export type LegalSubsection = {
  heading: string;
  body: string | string[];
  list?: string[];
};

export function LegalPageShell({
  locale,
  title,
  lastUpdatedLabel,
  lastUpdated,
  intro,
  sections,
  footer,
}: {
  locale: "he" | "en";
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  /** Optional lede paragraph(s) under the title. */
  intro?: string | string[];
  sections: LegalSection[];
  /** Optional footer block (e.g. company contact details). */
  footer?: ReactNode;
}) {
  const isHe = locale === "he";
  const introParas = intro
    ? Array.isArray(intro)
      ? intro
      : [intro]
    : [];

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative isolate min-h-[100dvh] overflow-hidden text-white"
    >
      {/* Base midnight + soft top aurora to match the rest of the site */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#070b18_0%,#0a0e22_38%,#070411_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[55vh]"
        style={{
          background:
            "radial-gradient(900px 460px at 14% 0%, rgba(168,85,247,0.18), transparent 60%), " +
            "radial-gradient(800px 420px at 86% 8%, rgba(236,72,153,0.14), transparent 62%)",
        }}
      />

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-14 sm:px-6 sm:pt-20">
        {/* Title block */}
        <header className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {lastUpdatedLabel}{" "}
            <time className="text-white/65">{lastUpdated}</time>
          </p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {introParas.length > 0 ? (
            <div className="mt-5 space-y-3 text-base leading-relaxed text-white/75">
              {introParas.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
        </header>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s, i) => (
            <section key={i} className="scroll-mt-24">
              <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
                {s.heading}
              </h2>
              <BodyBlock body={s.body} />
              {s.list && s.list.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1.5 ps-6 text-[15px] leading-relaxed text-white/75 marker:text-white/40">
                  {s.list.map((it, k) => (
                    <li key={k}>{it}</li>
                  ))}
                </ul>
              ) : null}
              {s.subsections && s.subsections.length > 0 ? (
                <div className="mt-5 space-y-5 ps-2 sm:ps-4">
                  {s.subsections.map((ss, j) => (
                    <div key={j}>
                      <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                        {ss.heading}
                      </h3>
                      <BodyBlock body={ss.body} small />
                      {ss.list && ss.list.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 ps-6 text-[15px] leading-relaxed text-white/75 marker:text-white/40">
                          {ss.list.map((it, k) => (
                            <li key={k}>{it}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>

        {footer ? (
          <div className="mt-14 border-t border-white/10 pt-8 text-sm leading-relaxed text-white/60">
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function BodyBlock({
  body,
  small = false,
}: {
  body: string | string[];
  small?: boolean;
}) {
  const paras = Array.isArray(body) ? body : [body];
  if (paras.length === 0) return null;
  return (
    <div
      className={`space-y-3 leading-relaxed ${
        small ? "mt-2 text-[15px] text-white/72" : "mt-3 text-base text-white/78"
      }`}
    >
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
