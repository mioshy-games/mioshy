"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { signupAction } from "@/app/actions/auth-actions";
import { joinCoupleByPairCode } from "@/app/actions/between-us-couple";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import { ConsentCheckbox } from "@/components/auth/ConsentCheckbox";
import { safeNext } from "@/lib/auth/safe-next";

type Props = {
  /** Optional ?next=/path to return to after a successful signup.
   *  Same validation rules as LoginForm - same-origin only. */
  next?: string;
  /** Optional partner pair-code arriving via ?code=ABC123 in the URL.
   *  When set, the form shows a "you're joining your partner's
   *  subscription" banner and, on successful signup, auto-redeems the
   *  code via joinCoupleByPairCode before routing to /my. See
   *  app/[locale]/auth/signup/page.tsx for the URL contract. */
  pairCode?: string;
};

export function SignupForm({ next, pairCode }: Props) {
  const router = useRouter();
  const t = useTranslations("auth");
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Normalise the pair code once on mount. Codes are always uppercase
  // 6-char alphanumerics; anything else is treated as "no prefill" so
  // we never feed garbage into joinCoupleByPairCode.
  const normalizedCode = (() => {
    if (!pairCode) return undefined;
    const trimmed = pairCode.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(trimmed) ? trimmed : undefined;
  })();

  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("fullName", fullName);
    fd.set("email",    email);
    fd.set("phone",    phone);
    fd.set("password", password);
    // New in Step C1: marketing consent + locale + source. Locale is
    // derived from the URL via useLocale() rather than asking the user.
    fd.set("marketing_consent", marketingConsent ? "true" : "false");
    fd.set("preferred_language", locale === "en" ? "en" : "he");
    fd.set("source", "signup");

    startTransition(async () => {
      const result = await signupAction(fd);
      if (!result.success) { setError(result.error); return; }

      // Partner-share flow — if the user arrived via a /auth/signup?code=
      // share link, attach them to the inviter's couple immediately so
      // they land on /my already paired. Profile is complete by virtue
      // of the signup form collecting name+email+phone+password, so
      // requireCompleteProfile() inside joinCoupleByPairCode passes.
      // We swallow errors here so a failed auto-pair never blocks the
      // signup — the user can still redeem manually from /my.
      if (normalizedCode) {
        try {
          await joinCoupleByPairCode(normalizedCode);
        } catch (err) {
          console.warn("[signup] auto-pair via ?code= failed", err);
        }
      }

      // Honour caller-supplied next if present and same-origin.
      // Fallback target updated 2026-05-29 from /my → /my/today (go-live
      // of the AppShell). Middleware also catches stragglers hitting /my.
      const target = safeNext(next, "/my/lessons");
      router.push(target);
    });
  }

  // Preserve the next param when the user clicks through to login.
  // Also preserve ?code= so a user who already has an account can sign
  // in and still get auto-paired via the post-login redirect (handled
  // inside LoginForm's own code= prop, which mirrors this one).
  const loginHrefParams = new URLSearchParams();
  if (next) loginHrefParams.set("next", safeNext(next, "/my/lessons"));
  if (normalizedCode) loginHrefParams.set("code", normalizedCode);
  const loginQs = loginHrefParams.toString();
  const loginHref = loginQs ? `/auth?${loginQs}` : "/auth";

  return (
    // 2026-06-02 — framer-motion mount fade dropped. The form should
    // render immediately on first paint, not stagger in after JS hydrates.
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
          {t("signupTagline")}
        </p>
      </div>

      <AuthCard>
        <h1 className="text-[30px] font-bold leading-tight text-white sm:text-[26px]">
          {t("signupTitle")}
        </h1>
        <p className="mt-2 text-[17px] leading-snug text-white/85 sm:mt-1 sm:text-[15px]">
          {t("signupSubtitle")}
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
                  ? "ההרשמה תפתח לך מיד את כל המנוי המשותף — בלי תשלום נוסף."
                  : "Signup will unlock your shared subscription right away — at no extra cost."}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] tracking-[0.32em] text-white">
                {isHe ? "קוד: " : "Code: "}
                <span className="font-bold">{normalizedCode}</span>
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-7 space-y-5 sm:mt-6 sm:space-y-4">
          <AuthField id="signup_name"     label={t("nameLabel")}     value={fullName} onChange={setFullName} autoComplete="name"         required placeholder={t("namePlaceholder")} />
          <AuthField id="signup_email"    label={t("emailLabel")}    type="email" value={email} onChange={setEmail} autoComplete="email"  required placeholder={t("emailPlaceholder")} />
          <AuthField id="signup_phone"    label={t("phoneLabel")}    type="tel"   value={phone} onChange={setPhone} autoComplete="tel"              placeholder={t("phonePlaceholder")} />
          <AuthField id="signup_password" label={t("passwordLabel")} type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={6} placeholder={t("passwordPlaceholder")} />

          <ConsentCheckbox
            id="signup_marketing_consent"
            checked={marketingConsent}
            onChange={setMarketingConsent}
            label={t("consentLabel")}
          />

          {error && (
            <p className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <AuthSubmitButton loading={isPending} label={t("createAccountButton")} loadingLabel={t("creatingAccount")} />
        </form>

        {/* Per Itzik 2026-05-07: terms text was tiny (xs / white/30)
            and the inline links collided with the Hebrew text because
            of missing spaces. Bumped to 14px / white/75 + spacing
            fixed in i18n keys. */}
        <p className="mt-5 text-center text-[14px] leading-[1.6] text-white/75">
          {t("termsPrefix")}
          <Link href="/terms" className="font-medium text-white underline underline-offset-4 hover:text-fuchsia-200">{t("terms")}</Link>
          {t("termsSep")}
          <Link href="/privacy" className="font-medium text-white underline underline-offset-4 hover:text-fuchsia-200">{t("privacy")}</Link>
          {t("termsSuffix")}
        </p>

        <div className="mt-5 text-center text-[15px] text-white/85">
          {t("hasAccount")}{" "}
          <Link href={loginHref} className="text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
            {t("signInLink")}
          </Link>
        </div>
      </AuthCard>
    </div>
  );
}
