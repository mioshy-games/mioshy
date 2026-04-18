"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase";

export function AuthForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "error" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  async function redirectAfterAuthenticatedSession(supabase: ReturnType<
    typeof createBrowserSupabaseClient
  >) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFeedback({ text: t("confirmEmail"), tone: "info" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      window.location.assign("/dashboard");
      return;
    }

    setFeedback({ text: t("signedInNonAdmin"), tone: "info" });
    router.push("/");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!configured) {
      setFeedback({ text: t("missingEnv"), tone: "error" });
      return;
    }
    const supabase = createBrowserSupabaseClient();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await redirectAfterAuthenticatedSession(supabase);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      if (!data.session) {
        setFeedback({ text: t("confirmEmail"), tone: "info" });
        return;
      }

      await redirectAfterAuthenticatedSession(supabase);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : "Error",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur">
      <h1 className="text-center text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-center text-sm text-white/70">{t("subtitle")}</p>

      {!configured ? (
        <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {t("missingEnv")}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-white/90"
          >
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-white/90"
          >
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !configured}
          className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 py-3 font-semibold text-white shadow-lg shadow-fuchsia-900/30 disabled:opacity-50"
        >
          {loading ? "…" : mode === "signin" ? t("signIn") : t("signUp")}
        </button>
      </form>

      <button
        type="button"
        onClick={() =>
          setMode((m) => (m === "signin" ? "signup" : "signin"))
        }
        className="mt-4 w-full text-center text-sm text-fuchsia-200 underline-offset-4 hover:underline"
      >
        {mode === "signin" ? t("toggleToSignUp") : t("toggleToSignIn")}
      </button>

      {feedback ? (
        <p
          className={
            feedback.tone === "info"
              ? "mt-4 text-center text-sm text-amber-100"
              : "mt-4 text-center text-sm text-rose-200"
          }
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
