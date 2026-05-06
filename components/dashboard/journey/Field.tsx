import { Label } from "@/components/ui/label";
import { HintIcon } from "@/components/ui/hint-icon";
import type { HintTopic } from "@/lib/journey-content/hint-catalog";

/**
 * Compact form field helper used across every Journey admin form.
 * Mirrors the pattern established in between-us/CategoryForm.
 *
 * `hintTopic` opens a Hebrew clinical-tone popover from the hint
 * catalog (PR2 of the expert-onboarding guide). When set, the inline
 * `hint` text is suppressed - the popover replaces it.
 */
export function Field({
  label,
  hint,
  hintTopic,
  className,
  children,
}: {
  label: string;
  hint?: string;
  hintTopic?: HintTopic;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <Label className="text-xs">{label}</Label>
          {hintTopic ? <HintIcon topic={hintTopic} /> : null}
        </span>
        {hint && !hintTopic ? (
          <span className="text-muted-foreground text-[10px]">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card space-y-4 rounded-lg border p-5">
      <header className="flex flex-col gap-1 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
