"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/navigation";
import { Check } from "lucide-react";
import { setAccountPassword } from "@/app/[locale]/account/profile/actions";

export function SetPasswordForm({
  isHe,
  nextHref,
}: {
  isHe: boolean;
  nextHref?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (password.length < 6) {
      setError(
        isHe ? "הסיסמה חייבת להיות באורך 6 תווים לפחות" : "Password must be at least 6 characters",
      );
      return;
    }
    if (password !== confirm) {
      setError(isHe ? "הסיסמאות אינן תואמות" : "Passwords do not match");
      return;
    }
    start(async () => {
      const res = await setAccountPassword(password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      if (nextHref) {
        setTimeout(() => router.push(nextHref), 650);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white/85">
          {isHe ? "סיסמה חדשה" : "New password"}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          minLength={6}
          required
          autoComplete="new-password"
          dir="ltr"
          className="mt-1.5 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-white/85">
          {isHe ? "אישור סיסמה" : "Confirm password"}
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          minLength={6}
          required
          autoComplete="new-password"
          dir="ltr"
          className="mt-1.5 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none disabled:opacity-60"
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-100">
          <Check className="h-4 w-4" />
          {isHe ? "הסיסמה הוגדרה" : "Password set"}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-fuchsia-700 shadow transition hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? isHe
            ? "שומרים…"
            : "Saving…"
          : isHe
            ? "שמירת סיסמה"
            : "Save password"}
      </button>
    </form>
  );
}
