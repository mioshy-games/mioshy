"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { Check } from "lucide-react";
import { saveProfileDetails } from "@/app/[locale]/account/profile/actions";

export function ProfileDetailsForm({
  isHe,
  defaultName,
  defaultMobile,
  defaultWhatsappOptIn = false,
  highlightMissing,
  nextHref,
}: {
  isHe: boolean;
  defaultName: string;
  defaultMobile: string;
  /** Current WhatsApp consent, so the checkbox reflects existing state. */
  defaultWhatsappOptIn?: boolean;
  highlightMissing: { full_name: boolean; mobile: boolean };
  /**
   * If provided, we redirect there after a successful save. If not
   * provided (e.g. when the caller also needs to set a password), we
   * stay on the page and let the user finish the other form(s).
   */
  nextHref?: string;
}) {
  const router = useRouter();
  const t = useTranslations("account.whatsappOptIn");
  const [fullName, setFullName] = useState(defaultName);
  const [mobile, setMobile] = useState(defaultMobile);
  const [whatsappOptIn, setWhatsappOptIn] = useState(defaultWhatsappOptIn);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    start(async () => {
      const res = await saveProfileDetails({
        full_name: fullName,
        mobile,
        whatsapp_opt_in: whatsappOptIn,
      });
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

  const labelNote = (flag: boolean) =>
    flag ? (
      <span className="ms-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-200">
        {isHe ? "חסר" : "Missing"}
      </span>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white/85">
          {isHe ? "שם מלא" : "Full name"}
          {labelNote(highlightMissing.full_name)}
        </label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={pending}
          required
          minLength={2}
          className="mt-1.5 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none disabled:opacity-60"
          placeholder={isHe ? "השם המלא שלכם" : "Your full name"}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-white/85">
          {isHe ? "טלפון נייד" : "Mobile"}
          {labelNote(highlightMissing.mobile)}
        </label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          dir="ltr"
          disabled={pending}
          required
          className="mt-1.5 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-fuchsia-300 focus:outline-none disabled:opacity-60"
          placeholder="+972 50 000 0000"
          inputMode="tel"
          autoComplete="tel"
        />
      </div>

      {/* WhatsApp opt-in (stage 2). Copy lives in i18n (account.whatsappOptIn)
          so it can change without a deploy. Mobile-first layout; additive. */}
      <label className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3">
        <input
          type="checkbox"
          checked={whatsappOptIn}
          onChange={(e) => setWhatsappOptIn(e.target.checked)}
          disabled={pending}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 accent-fuchsia-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
        />
        <span className="text-sm text-white/85">
          {t("label")}
          <span className="mt-0.5 block text-xs text-white/55">{t("hint")}</span>
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-100">
          <Check className="h-4 w-4" />
          {isHe ? "נשמר בהצלחה" : "Saved"}
          {nextHref ? (isHe ? " - ממשיכים…" : " - continuing…") : ""}
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
            ? "שמירה והמשך"
            : "Save & continue"}
      </button>
    </form>
  );
}
