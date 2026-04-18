"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Link, useRouter } from "@/navigation";
import { signupAction } from "@/app/actions/auth-actions";

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await signupAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/products");
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
          mioshy
        </span>
        <p className="mt-2 text-sm text-white/60">Your couples game experience starts here.</p>
      </div>

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
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="mt-1 text-sm text-white/50">Free — no card required</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            id="fullName" label="Full name" type="text" name="fullName"
            placeholder="Your name" autoComplete="name" required
          />
          <Field
            id="email" label="Email" type="email" name="email"
            placeholder="you@example.com" autoComplete="email" required
          />
          <Field
            id="phone" label="Phone (optional)" type="tel" name="phone"
            placeholder="+972 50 000 0000" autoComplete="tel"
          />

          {/* Password with show/hide toggle */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest text-white/40">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/25 transition focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <SubmitButton loading={isPending} />
        </form>

        <p className="mt-4 text-center text-xs text-white/30">
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-white/60">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white/60">
            Privacy Policy
          </Link>.
        </p>

        <div className="mt-4 text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/auth" className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

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

function SubmitButton({ loading }: { loading: boolean }) {
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
          Creating account…
        </span>
      ) : (
        "Create account →"
      )}
    </button>
  );
}
