"use client";

import { Reveal } from "./Reveal";

export function Section({
  id,
  children,
  eyebrow,
  title,
  subtitle,
  variant = "a",
}: {
  id?: string;
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  variant?: "a" | "b";
}) {
  const bg =
    variant === "a"
      ? "bg-[var(--mio-surface-a)]"
      : "bg-[var(--mio-surface-b)]";

  return (
    <section id={id} className={`relative py-16 sm:py-24 ${bg}`}>
      <div className="mx-auto max-w-6xl px-4">
        {(eyebrow || title || subtitle) && (
          <div className="mx-auto max-w-3xl text-center">
            {eyebrow ? (
              <Reveal>
                <p className="mb-4 inline-flex rounded-full border border-purple-500/20 bg-[var(--mio-card)] px-4 py-1 text-sm font-semibold tracking-wide text-white/80 backdrop-blur-md">
                  {eyebrow}
                </p>
              </Reveal>
            ) : null}
            {title ? (
              <Reveal delay={0.02}>
                <h2 className="font-heading text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {title}
                </h2>
              </Reveal>
            ) : null}
            {subtitle ? (
              <Reveal delay={0.05}>
                <p className="mt-4 text-pretty text-lg text-white/75 sm:text-xl">
                  {subtitle}
                </p>
              </Reveal>
            ) : null}
          </div>
        )}

        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
