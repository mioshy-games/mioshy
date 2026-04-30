"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { loginAction } from "@/app/actions/auth-actions";
import { AuthField, AuthSubmitButton, AuthCard } from "@/components/ui/auth-field";
import { safeNext } from "@/lib/auth/safe-next";

type Props = {
  /** True when redirected here after session invalidation. */
  kicked?: boolean;
  /** Optional ?next=/path to return to after a successful login. Validated
   *  to be a same-origin path before use. Falls back to /products. */
  next?: string;
};

export function LoginForm({ kicked = false, next }: Props) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [isPending, startTransition] = useTransition();
  const [error,     setError]        = useState<string | null>(null);

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
      if (!result.success) { setError(result.error); return; }
      // Admins always land on the dashboard regardless of `next` - we
      // don't want a marketing-page next= silently demoting an admin.
      if (result.isAdmin) {
        window.location.assign("/dashboard");
        return;
      }
      // Honour caller-supplied next if present and same-origin.
      const target = safeNext(next, "/products");
      router.push(target);
    });
  }

  // Preserve the next param when the user clicks through to signup so the
  // funnel doesn't lose track of where they were trying to go.
  const signupHref = next
    ? `/auth/signup?next=${encodeURIComponent(safeNext(next, "/products"))}`
    : "/auth/signup";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="mb-8 text-center">
        <span className="text-4xl font-black tracking-tight text-white drop-shadow-lg">mioshy</span>
        <p className="mt-2 text-sm text-white/60">{t("loginTagline")}</p>
      </div>

      {kicked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          🔒 You were signed out because your account was accessed on another device.
        </motion.div>
      )}

      <AuthCard>
        <h1 className="text-2xl font-bold text-white">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthField id="login_email"    label={t("emailLabel")}    type="email"    value={email}    onChange={setEmail}    autoComplete="email"            required placeholder={t("emailPlaceholder")} />
          <AuthField id="login_password" label={t("passwordLabel")} type="password" value={password} onChange={setPassword} autoComplete="current-password" required placeholder="••••••••" />

          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </motion.p>
          )}

          <AuthSubmitButton loading={isPending} label={t("signInButton")} loadingLabel={t("signingIn")} />
        </form>

        <div className="mt-6 text-center text-sm text-white/50">
          {t("noAccount")}{" "}
          <Link href={signupHref} className="text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
            {t("createFree")}
          </Link>
        </div>
      </AuthCard>
    </motion.div>
  );
}
