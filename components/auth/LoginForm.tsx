"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Link, useRouter } from "@/navigation";
import { loginAction } from "@/app/actions/auth-actions";

type Props = {
  kicked?: boolean; // true when redirected here after session invalidation
};

export function LoginForm({ kicked = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Redirect
      if (result.isAdmin) {
        window.location.assign("/dashboard");
      } else {
        router.push("/products");
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      {/* Logo / brand */}
      <div className="mb-8 text-center">
        <span className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
          mioshy
        </span>
        <p className="mt-2 text-sm text-white/60">Play together. Grow together.</p>
      </div>

      {/* Kicked banner */}
      {kicked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          🔒 You were signed out because your account was accessed on another device.
        </motion.div>
      )}

      {/* Card */}
      <div
        className="rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/50">Sign in to continue playing</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field id="email" label="Email" type="email" name="email" placeholder="you@example.com" autoComplete="email" required />
          <Field id="password" label="Password" type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <SubmitButton loading={isPending} label="Sign in" />
        </form>

        <div className="mt-6 text-center text-sm text-white/50">
          No account?{" "}
          <Link href="/auth/signup" className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-4">
            Create one free
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Field({
  id, label, type, name, placeholder, autoComplete, required,
}: {
  id: string; label: string; type: string; name: string;
  placeholder: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest text-white/40">
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25 transition focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
      />
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 py-3.5 text-base font-bold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Signing in…
        </span>
      ) : (
        label
      )}
    </button>
  );
}
