"use client";

/**
 * PasswordRequirements — live password-rule indicator (Itzik 2026-07-04).
 *
 * We enforce ONLY a minimum length: min 8 in the signup actions (Supabase's own
 * floor is 6). No composition rules anywhere. Per NIST 800-63B (length over
 * composition) and Itzik's decision, the indicator shows EXACTLY the one rule
 * that is actually enforced, and never a rule that isn't.
 *
 * States (updates as the user types):
 *   • pending — gray, before the rule is met.
 *   • met     — green check, once the rule is met.
 *   • error   — red, after a failed submit while still unmet (`error` prop).
 *
 * variant: "light" (funnel signup, cream background) | "dark" (auth pages).
 * Mobile-first, 18px, no exclamation marks.
 */

export const PASSWORD_MIN_LENGTH = 8;

export function passwordTooShort(pw: string): boolean {
  return pw.length < PASSWORD_MIN_LENGTH;
}

/** Specific submit error (never a generic "invalid password"). */
export const passwordShortError = (isHe: boolean): string =>
  isHe
    ? `הסיסמה קצרה מדי, צריך לפחות ${PASSWORD_MIN_LENGTH} תווים`
    : `Password is too short, at least ${PASSWORD_MIN_LENGTH} characters needed`;

export function PasswordRequirements({
  value,
  error = false,
  variant = "dark",
  isHe = true,
}: {
  value: string;
  /** True after a failed submit — an unmet rule turns red. */
  error?: boolean;
  variant?: "light" | "dark";
  isHe?: boolean;
}) {
  const met = value.length >= PASSWORD_MIN_LENGTH;
  const state: "met" | "error" | "pending" = met ? "met" : error ? "error" : "pending";

  const pendingText = variant === "light" ? "#9c8b91" : "rgba(255,255,255,0.5)";
  const pendingRing = variant === "light" ? "#d9cdbf" : "rgba(255,255,255,0.3)";
  const color =
    state === "met" ? "#16a34a" : state === "error" ? "#dc2626" : pendingText;
  const ring = state === "pending" ? pendingRing : color;

  const label = isHe ? `לפחות ${PASSWORD_MIN_LENGTH} תווים` : `At least ${PASSWORD_MIN_LENGTH} characters`;

  return (
    <ul
      aria-live="polite"
      style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}
    >
      <li
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "18px",
          fontWeight: 600,
          lineHeight: 1.4,
          color,
        }}
      >
        <span
          aria-hidden
          style={{
            flex: "none",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: state === "met" ? "none" : `2px solid ${ring}`,
            background: state === "met" ? "#16a34a" : "transparent",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          {state === "met" ? "✓" : ""}
        </span>
        <span>{label}</span>
      </li>
    </ul>
  );
}
