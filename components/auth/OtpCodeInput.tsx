"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

/**
 * OtpCodeInput — 6 single-digit boxes for the email OTP flow (mockup screen 2).
 *
 * - `autoComplete="one-time-code"` + `inputMode="numeric"` → iOS/Android OTP
 *   autofill fills the boxes straight from the SMS/email code.
 * - Auto-advances on type, backspace jumps to the previous box, and pasting a
 *   6-digit code distributes across all boxes.
 * - Controlled: `value` is the concatenated string (≤ 6 digits); `onChange`
 *   fires the new string; `onComplete` fires once all 6 are filled.
 *
 * RTL note: the code itself is LTR (a number), so the row is `dir="ltr"`.
 */
export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  theme = "light",
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  theme?: "light" | "dark";
}) {
  const dark = theme === "dark";
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const emit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  const setAt = (i: number, digit: string) => {
    const arr = value.padEnd(6, " ").slice(0, 6).split("");
    arr[i] = digit;
    emit(arr.join("").replace(/\s/g, ""));
  };

  const handleInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    // If more than one char arrived (fast typing / partial autofill), spread it.
    if (d.length > 1) {
      emit((value + d).replace(/\D/g, "").slice(0, 6));
      const target = Math.min(5, (value.replace(/\D/g, "").length + d.length) - 1);
      refs.current[target]?.focus();
      return;
    }
    setAt(i, d);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i].trim()) {
        setAt(i, "");
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, "");
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    emit(pasted);
    refs.current[Math.min(5, pasted.length - 1)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 8, direction: "ltr", justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={d.trim()}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`ספרה ${i + 1}`}
          style={{
            width: 44,
            height: 54,
            border: `1.5px solid ${d.trim() ? "#D6409F" : dark ? "rgba(255,255,255,0.15)" : "#ece2d4"}`,
            boxShadow: d.trim() ? "0 0 0 3px rgba(214,64,159,.12)" : "none",
            background: dark ? "rgba(255,255,255,0.05)" : "#fff",
            borderRadius: 12,
            textAlign: "center",
            fontFamily: 'var(--font-frank-ruhl), "Frank Ruhl Libre", serif',
            fontWeight: 900,
            fontSize: 24,
            color: dark ? "#fff" : "#2E2622",
            outline: "none",
          }}
        />
      ))}
    </div>
  );
}
