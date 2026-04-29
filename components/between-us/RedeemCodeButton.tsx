"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/navigation";
import { joinCoupleByPairCode } from "@/app/actions/between-us-couple";
import { KeyRound, X } from "lucide-react";

type Variant = "pill" | "ghost" | "primary";

export function RedeemCodeButton({
  isHe,
  variant = "ghost",
  label,
  className,
  /**
   * Optional path to send the user to after they successfully redeem a
   * code. Defaults to /my (the global hub) but a game page can pass
   * `/adults/[slug]/play` so partners who join from a game page land
   * directly inside that game's play surface.
   */
  redirectTo,
  /**
   * Optional path used for the same `next=` param passed to /auth and
   * /account/profile when the redeem flow needs to bounce through
   * sign-in or profile completion first. Defaults to redirectTo, which
   * defaults to /my.
   */
  authNext,
}: {
  isHe: boolean;
  variant?: Variant;
  label?: string;
  className?: string;
  redirectTo?: string;
  authNext?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolvedLabel = label ?? (isHe ? "הזנת קוד" : "Redeem code");
  const finalRedirect = redirectTo ?? "/my";
  const finalAuthNext = authNext ?? finalRedirect;

  const base =
    "inline-flex items-center gap-1.5 text-sm font-medium transition";
  const styles: Record<Variant, string> = {
    pill: "rounded-full border border-white/25 bg-white/10 px-4 py-2 text-white hover:bg-white/20",
    ghost: "text-white/85 hover:text-white",
    primary:
      "rounded-full bg-fuchsia-500 px-5 py-2 text-white shadow hover:bg-fuchsia-400",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} ${styles[variant]} ${className ?? ""}`}
      >
        <KeyRound className="h-4 w-4" />
        {resolvedLabel}
      </button>
      {open ? (
        <RedeemDialog
          isHe={isHe}
          onClose={() => setOpen(false)}
          redirectTo={finalRedirect}
          authNext={finalAuthNext}
        />
      ) : null}
    </>
  );
}

function RedeemDialog({
  isHe,
  onClose,
  redirectTo,
  authNext,
}: {
  isHe: boolean;
  onClose: () => void;
  redirectTo: string;
  authNext: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError(isHe ? "הקוד חייב להיות בן 6 תווים" : "Code must be 6 characters");
      return;
    }
    start(async () => {
      const res = await joinCoupleByPairCode(normalized);
      if (!res.ok) {
        if (res.error === "profile_incomplete") {
          onClose();
          router.push(
            `/account/profile?reason=profile_incomplete&next=${encodeURIComponent(
              authNext,
            )}`,
          );
          return;
        }
        if (res.error === "login_required") {
          onClose();
          router.push(`/auth?next=${encodeURIComponent(authNext)}`);
          return;
        }
        setError(res.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        onClose();
        // Redirect to the caller-provided destination — defaults to /my
        // when used in account/global contexts; game-page callers pass
        // /adults/[slug]/play so the partner lands inside the game.
        router.push(redirectTo);
      }, 900);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      dir={isHe ? "rtl" : "ltr"}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900 via-fuchsia-900 to-rose-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-3 top-3 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
          <KeyRound className="h-3.5 w-3.5 text-fuchsia-200" />
          <span>{isHe ? "צימוד זוגי" : "Couple pairing"}</span>
        </div>
        <h3 className="mt-3 text-2xl font-bold">
          {isHe ? "הזינו את קוד הצימוד" : "Enter your pair code"}
        </h3>
        <p className="mt-2 text-sm text-white/75">
          {isHe
            ? "הקוד שקיבלתם מבן/בת הזוג יחבר אתכם לחלל הזוגי ויפתח את כל המשחקים שרכשתם יחד."
            : "The code your partner shared will connect you to their couple space and unlock every game you two own."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={isHe ? "ABC123" : "ABC123"}
            maxLength={6}
            disabled={pending || success}
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white placeholder-white/30 focus:border-fuchsia-300 focus:outline-none disabled:opacity-50"
          />
          {error ? (
            <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
              {isHe ? "צומדתם בהצלחה — מעבר למיאושי שלי…" : "Paired! Taking you to My Mioshy…"}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || success || code.trim().length !== 6}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-fuchsia-700 shadow transition hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? isHe
                ? "מצמדים…"
                : "Pairing…"
              : isHe
                ? "צימוד"
                : "Pair with partner"}
          </button>
        </form>
      </div>
    </div>
  );
}
