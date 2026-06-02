"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { loginAction, type LoginErrorCode } from "@/app/actions/auth-actions";
import { joinCoupleByPairCode } from "@/app/actions/between-us-couple";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import { safeNext } from "@/lib/auth/safe-next";

type Props = {
  /** True when redirected here after session invalidation. */
  kicked?: boolean;
  /** Optional ?next=/path to return to after a successful login. Validated
   *  to be a same-origin path before use. Falls back to /my. */
  next?: string;
  /** Optional partner pair-code arriving via ?code=ABC123. Mirrors the
   *  SignupForm contract: on successful login we auto-redeem the code
   *  so the user lands on /my already paired. See app/[locale]/auth/
   *  page.tsx for the URL contract. */
  pairCode?: string;
};

export function LoginForm({ kicked = false, next, pairCode }: Props) {
  const router = useRouter();
  const t = useTranslations("auth");
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";
  const [isPending, startTransition] = useTransition();
  // 2026-06-01 — error now carries a structured code so we can pick a
  // friendly message and decide whether to show a "sign up instead"
  // CTA below the box. The raw server message is kept for fallback.
  const [error, setError] = useState<
    { code: LoginErrorCode; raw: string } | null
  >(null);

  // Same normalisation rule as SignupForm — invalid code → undefined.
  const normalizedCode = (() => {
    if (!pairCode) return undefined;
    const trimmed = pairCode.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(trimmed) ? trimmed : undefined;
  })();

  // Controlled state (AuthField needs value+onChange)
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email",    email);
    fd.set("password", password);
    startTransition(async () => {
      const result = await loginAction(fd);
      if (!result.success) {
        setError({ code: result.code, raw: result.error });
        return;
      }
      // Admins always land on the dashboard regardless of `next` - we
      // don't want a marketing-page next= silently demoting an admin.
      if (result.isAdmin) {
        window.location.assign("/dashboard");
        return;
      }

      // Partner-share flow — if the user arrived via /auth?code=, try
      // to auto-pair to the inviter's couple. We swallow errors here
      // so a failed pair never blocks the login — most likely culprit
      // is profile_incomplete, in which case the user can finish
      // their profile from /my and redeem manually.
      if (normalizedCode) {
        try {
          await joinCoupleByPairCode(normalizedCode);
        } catch (err) {
          console.warn("[login] auto-pair via ?code= failed", err);
        }
      }

      // Honour caller-supplied next if present and same-origin.
      // Fallback target updated 2026-05-29 from /my → /my/today (go-live
      // of the AppShell). Middleware also catches stragglers hitting /my.
      const target = safeNext(next, "/my/lessons");
      router.push(target);
    });
  }

  // Preserve the next param + ?code= when the user clicks through to
  // signup so neither piece of context is lost mid-funnel.
  const signupParams = new URLSearchParams();
  if (next) signupParams.set("next", safeNext(next, "/my/lessons"));
  if (normalizedCode) signupParams.set("code", normalizedCode);
  const signupQs = signupParams.toString();
  const signupHref = signupQs ? `/auth/signup?${signupQs}` : "/auth/signup";

  return (
    // 2026-06-02 — framer-motion mount fade dropped. Form renders on
    // first paint instead of after hydrate.
    <div className="w-full max-w-[min(92vw,460px)] sm:max-w-md">
      <div className="mb-10 flex flex-col items-center text-center sm:mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mioshy-white.svg"
          alt="Mioshy"
          width={171}
          height={81}
          className="h-16 w-auto drop-shadow-lg sm:h-16"
        />
        <p className="mt-4 text-[17px] text-white/75 sm:mt-3 sm:text-[15px]">
          {t("loginTagline")}
        </p>
      </div>

      {kicked && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          🔒 You were signed out because your account was accessed on another device.
        </div>
      )}

      <AuthCard>
        <h1 className="text-[30px] font-bold leading-tight text-white sm:text-[26px]">
          {t("loginTitle")}
        </h1>
        <p className="mt-2 text-[17px] leading-snug text-white/85 sm:mt-1 sm:text-[15px]">
          {t("loginSubtitle")}
        </p>

        {normalizedCode ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-fuchsia-300/40 bg-fuchsia-500/15 px-4 py-3 text-[14px] leading-[1.55] text-fuchsia-50">
            <Heart className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-200" />
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {isHe
                  ? "מצטרפ/ת לבן/בת הזוג"
                  : "Joining your partner"}
              </p>
              <p className="mt-0.5 text-fuchsia-100/85">
                {isHe
                  ? "אחרי הכניסה לחשבון נחבר אתכם אוטומטית למנוי המשותף."
                  : "After login we'll connect you to the shared subscription automatically."}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] tracking-[0.32em] text-white">
                {isHe ? "קוד: " : "Code: "}
                <span className="font-bold">{normalizedCode}</span>
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5 sm:mt-6 sm:space-y-4">
          <AuthField id="login_email"    label={t("emailLabel")}    type="email"    value={email}    onChange={setEmail}    autoComplete="email"            required placeholder={t("emailPlaceholder")} />
          <AuthField id="login_password" label={t("passwordLabel")} type="password" value={password} onChange={setPassword} autoComplete="current-password" required placeholder="••••••••" />

          {error && (
            <div className="space-y-2 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
              {/* 2026-06-02 — was motion.div, dropped for perf. */}
              <p className="m-0 font-medium">
                {(() => {
                  switch (error.code) {
                    case "MISSING_FIELDS":
                      return isHe
                        ? "אנא מלאו אימייל וסיסמה."
                        : "Please fill in both email and password.";
                    case "INVALID_CREDENTIALS":
                      return isHe
                        ? "לא מצאנו חשבון עם הפרטים האלה. אולי הכתובת או הסיסמה שגויות — או שעדיין לא נרשמתם."
                        : "We couldn't find an account with these details. The email or password may be wrong — or you haven't signed up yet.";
                    case "EMAIL_NOT_CONFIRMED":
                      return isHe
                        ? "הכתובת עדיין לא אומתה. בדקו את תיבת המייל לקבלת קישור האימות."
                        : "Your email hasn't been confirmed yet. Check your inbox for the verification link.";
                    case "RATE_LIMITED":
                      return isHe
                        ? "ניסיונות יתר על המידה. נסו שוב בעוד דקה."
                        : "Too many attempts. Please wait a minute and try again.";
                    case "GENERIC":
                    default:
                      return isHe
                        ? "משהו השתבש בכניסה. נסו שוב בעוד רגע."
                        : "Something went wrong during sign-in. Please try again in a moment.";
                  }
                })()}
              </p>
              {/* Sign-up CTA — surfaces only when the most likely cause
                  is "no account yet". Keeps the box quiet for the rate-
                  limit / not-confirmed branches where signing up again
                  would make things worse. */}
              {error.code === "INVALID_CREDENTIALS" ? (
                <Link
                  href={signupHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/30 px-3 py-1.5 text-[13px] font-bold text-white transition hover:bg-rose-500/50"
                >
                  {isHe ? "להירשם עם המייל הזה" : "Sign up with this email"}
                </Link>
              ) : null}
            </div>
          )}

          <AuthSubmitButton loading={isPending} label={t("signInButton")} loadingLabel={t("signingIn")} />
        </form>

        {/* Forgot-password link per Itzik 2026-05-07. Routes to a
            dedicated /auth/forgot page that sends a reset link to
            the user's email via Supabase auth.resetPasswordForEmail. */}
        <div className="mt-4 text-center">
          <Link
            href="/auth/forgot"
            className="text-[14px] font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>

        <div className="mt-5 text-center text-[15px] text-white/85">
          {t("noAccount")}{" "}
          <Link href={signupHref} className="font-semibold text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
            {t("createFree")}
          </Link>
        </div>
      </AuthCard>
    </div>
  );
}
