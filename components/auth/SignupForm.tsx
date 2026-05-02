"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { signupAction } from "@/app/actions/auth-actions";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import { safeNext } from "@/lib/auth/safe-next";

type Props = {
  /** Optional ?next=/path to return to after a successful signup.
   *  Same validation rules as LoginForm - same-origin only. */
  next?: string;
};

export function SignupForm({ next }: Props) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("fullName", fullName);
    fd.set("email",    email);
    fd.set("phone",    phone);
    fd.set("password", password);

    startTransition(async () => {
      const result = await signupAction(fd);
      if (!result.success) { setError(result.error); return; }
      // Honour caller-supplied next if present and same-origin.
      const target = safeNext(next, "/my");
      router.push(target);
    });
  }

  // Preserve the next param when the user clicks through to login.
  const loginHref = next
    ? `/auth?next=${encodeURIComponent(safeNext(next, "/my"))}`
    : "/auth";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="mb-8 text-center">
        <span className="text-4xl font-black tracking-tight text-white drop-shadow-lg">mioshy</span>
        <p className="mt-2 text-sm text-white/60">{t("signupTagline")}</p>
      </div>

      <AuthCard>
        <h1 className="text-2xl font-bold text-white">{t("signupTitle")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("signupSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthField id="signup_name"     label={t("nameLabel")}     value={fullName} onChange={setFullName} autoComplete="name"         required placeholder={t("namePlaceholder")} />
          <AuthField id="signup_email"    label={t("emailLabel")}    type="email" value={email} onChange={setEmail} autoComplete="email"  required placeholder={t("emailPlaceholder")} />
          <AuthField id="signup_phone"    label={t("phoneLabel")}    type="tel"   value={phone} onChange={setPhone} autoComplete="tel"    optional  placeholder={t("phonePlaceholder")} />
          <AuthField id="signup_password" label={t("passwordLabel")} type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={6} placeholder={t("passwordPlaceholder")} />

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <AuthSubmitButton loading={isPending} label={t("createAccountButton")} loadingLabel={t("creatingAccount")} />
        </form>

        <p className="mt-4 text-center text-xs text-white/30">
          {t("termsPrefix")}
          <Link href="/terms" className="underline underline-offset-4 hover:text-white/60">{t("terms")}</Link>
          {t("termsSep")}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white/60">{t("privacy")}</Link>
          {t("termsSuffix")}
        </p>

        <div className="mt-4 text-center text-sm text-white/50">
          {t("hasAccount")}{" "}
          <Link href={loginHref} className="text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
            {t("signInLink")}
          </Link>
        </div>
      </AuthCard>
    </motion.div>
  );
}
