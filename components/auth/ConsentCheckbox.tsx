"use client";

/**
 * Marketing-consent checkbox used by both the standalone /auth/signup
 * page and the in-game RegistrationModal popup.
 *
 * Unchecked by default — Israeli Communications Act §30A requires
 * explicit opt-in for marketing email. The checkbox does NOT block
 * submission; the user can sign up without ticking it and just won't
 * be added to Brevo's marketing lists.
 *
 * Styled with a native input so we don't pull in another Radix dep
 * (the project has switch/dialog/select but no checkbox primitive).
 * The checkmark is drawn via SVG inside the box when checked.
 */
export function ConsentCheckbox({
  id,
  checked,
  onChange,
  label,
  dir,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Optional override; defaults to inheriting from the surrounding form */
  dir?: "ltr" | "rtl";
}) {
  return (
    // Itzik 2026-06-02: hint line ("ניתן לבטל בכל עת") dropped — it was
    // duplicated visually and the unsubscribe assurance lives in the
    // terms link directly below the form anyway.
    <div dir={dir}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 select-none"
      >
        <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/25 bg-white/5 transition checked:border-fuchsia-400 checked:bg-fuchsia-500/80 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          />
          {/* Checkmark — visible only when the input is :checked */}
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100"
          >
            <path
              d="M2 7.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[14px] leading-[1.45] text-white/85">
          {label}
        </span>
      </label>
    </div>
  );
}
