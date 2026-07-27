"use client";

/**
 * components/marathon/MarathonForm.tsx (G2)
 *
 * Lead-capture form for the free 7-day couples marathon (/[locale]/marathon).
 * Posts to the EXISTING /api/leads/upsert (extended for phone + source) with
 * source='marathon-7day'. Reuses the shared lead infra (RLS, rate-limit,
 * dedupe by email+device_id).
 *
 * CONSENT (site rule, Itzik 2026-07-27): terms are MANDATORY, marketing consent
 * is OPTIONAL and never pre-checked, and the real choice is what gets sent —
 * both in the ONE approved wording, resolved server-side by getOtpConsentCopy()
 * and passed in as `consent` (identical text to the signup screen; edit it once
 * at /admin/content, page "journey", keys journeyAssessment.inlineAuth.*).
 * The marathon content itself is the service the visitor asked for, so it is
 * not gated on the marketing box.
 *
 * Other copy is CMS-keyed under marathon.* (he+en) via useCmsText; legal links
 * point at the real /terms + /privacy routes. Submit is disabled until phone +
 * email + terms are valid. On success the form swaps to a confirmation panel.
 */

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import { Check } from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";

const GRAD_SUBMIT = "linear-gradient(90deg,#f0abfc,#d946ef 55%,#a21caf)";
const GRAD_FREE = "linear-gradient(135deg,#34d399,#10b981)";

function cmsOr(text: string, fallback: string) {
  return text && text.trim().length > 0 ? text : fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MarathonForm({ consent: consentCopy }: { consent: OtpConsentCopy }) {
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";

  // ── CMS copy ────────────────────────────────────────────────────────────
  const c = {
    chip: cmsOr(useCmsText("marathon.chip").text, isHe ? "מרתון זוגי · מתנהל בוואטסאפ" : "Couples marathon · runs on WhatsApp"),
    title: cmsOr(useCmsText("marathon.title").text, isHe ? "מרתון זוגי 7 ימים —" : "A 7-day couples marathon —"),
    titleFree: cmsOr(useCmsText("marathon.titleFree").text, isHe ? "חינם" : "Free"),
    body: cmsOr(useCmsText("marathon.body").text, ""),
    nameLabel: cmsOr(useCmsText("marathon.nameLabel").text, isHe ? "שם" : "Name"),
    nameOptional: cmsOr(useCmsText("marathon.nameOptional").text, isHe ? "(לא חובה)" : "(optional)"),
    namePlaceholder: cmsOr(useCmsText("marathon.namePlaceholder").text, isHe ? "איך לפנות אליכם?" : "What should we call you?"),
    phoneLabel: cmsOr(useCmsText("marathon.phoneLabel").text, isHe ? "טלפון נייד" : "Mobile phone"),
    phoneHint: cmsOr(useCmsText("marathon.phoneHint").text, isHe ? "— לשליחת המרתון בוואטסאפ" : "— to send the marathon on WhatsApp"),
    phonePlaceholder: cmsOr(useCmsText("marathon.phonePlaceholder").text, "05X-XXXXXXX"),
    emailLabel: cmsOr(useCmsText("marathon.emailLabel").text, isHe ? "אימייל" : "Email"),
    emailPlaceholder: cmsOr(useCmsText("marathon.emailPlaceholder").text, "you@example.com"),
    submit: cmsOr(useCmsText("marathon.submit").text, isHe ? "הצטרפות למרתון" : "Join the marathon"),
    submitting: cmsOr(useCmsText("marathon.submitting").text, isHe ? "רושמים אתכם…" : "Signing you up…"),
    reassure: cmsOr(useCmsText("marathon.reassure").text, isHe ? "חינם לגמרי · בלי התחייבות · אפשר לבטל בכל רגע" : "Completely free · no commitment · cancel anytime"),
    errorGeneric: cmsOr(useCmsText("marathon.errorGeneric").text, isHe ? "משהו השתבש. נסו שוב בעוד רגע." : "Something went wrong. Please try again in a moment."),
    successTitle: cmsOr(useCmsText("marathon.successTitle").text, isHe ? "נרשמתם למרתון! 🎉" : "You're in! 🎉"),
    successBody: cmsOr(useCmsText("marathon.successBody").text, isHe ? "נעדכן אתכם בוואטסאפ מתי מתחילים." : "We'll message you on WhatsApp when it starts."),
  };

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Marketing consent: optional, never pre-checked. Terms: mandatory.
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = useMemo(
    () => phone.trim().length >= 6 && EMAIL_RE.test(email.trim()) && terms,
    [phone, email, terms],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          full_name: name.trim() || null,
          phone: phone.trim(),
          source: "marathon-7day",
          language: locale,
          device_id: getOrCreateDeviceId(),
          marketing_consent: marketing,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || c.errorGeneric);
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError(c.errorGeneric);
      setBusy(false);
    }
  }

  // ── Success panel ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div
        className="rounded-[26px] border p-8 text-center"
        style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(16,185,129,0.10)" }}
        role="status"
        aria-live="polite"
      >
        <div
          className="mx-auto mb-4 flex h-[62px] w-[62px] items-center justify-center rounded-full text-[#06281d]"
          style={{ background: GRAD_FREE }}
          aria-hidden
        >
          <Check className="h-8 w-8" />
        </div>
        <h2 className="text-[26px] font-black text-white">{c.successTitle}</h2>
        <p className="mt-2 text-[19px] leading-snug text-white/75">{c.successBody}</p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-[26px] border p-6 sm:p-7 backdrop-blur"
      style={{
        borderColor: "rgba(217,70,239,0.30)",
        background:
          "linear-gradient(160deg,rgba(217,70,239,0.14),rgba(124,58,237,0.10) 55%,rgba(225,29,72,0.12))",
        boxShadow: "0 30px 70px -28px rgba(217,70,239,0.5)",
      }}
    >
      <span
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px] font-bold"
        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#bbf7d0" }}
      >
        <span className="inline-block h-4 w-4 rounded" style={{ background: "#22c55e" }} aria-hidden />
        {c.chip}
      </span>

      <h1 className="mt-3.5 text-[33px] font-black leading-tight text-white">
        {c.title} <span style={{ color: "#10b981" }}>{c.titleFree}</span>
      </h1>
      {c.body ? <p className="mt-3.5 text-[20px] leading-relaxed text-white/75">{c.body}</p> : null}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5" noValidate>
        {/* Name (optional) */}
        <div>
          <label htmlFor="m-name" className="mb-1.5 block text-[18px] font-semibold text-white">
            {c.nameLabel} <span className="text-[15px] font-normal text-white/45">{c.nameOptional}</span>
          </label>
          <input
            id="m-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={c.namePlaceholder}
            className="min-h-[54px] w-full rounded-[14px] border border-white/20 bg-white/[0.07] px-4 text-[20px] text-white outline-none transition placeholder:text-white/40 focus:border-fuchsia-400/60 focus:bg-white/10"
          />
        </div>

        {/* Phone* */}
        <div>
          <label htmlFor="m-phone" className="mb-1.5 block text-[18px] font-semibold text-white">
            {c.phoneLabel} <span className="text-rose-300">*</span>{" "}
            <span className="text-[15px] font-normal text-white/45">{c.phoneHint}</span>
          </label>
          <input
            id="m-phone"
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={c.phonePlaceholder}
            dir="ltr"
            className="min-h-[54px] w-full rounded-[14px] border border-white/20 bg-white/[0.07] px-4 text-right text-[20px] text-white outline-none transition placeholder:text-white/40 focus:border-fuchsia-400/60 focus:bg-white/10"
          />
        </div>

        {/* Email* */}
        <div>
          <label htmlFor="m-email" className="mb-1.5 block text-[18px] font-semibold text-white">
            {c.emailLabel} <span className="text-rose-300">*</span>
          </label>
          <input
            id="m-email"
            type="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.emailPlaceholder}
            dir="ltr"
            className="min-h-[54px] w-full rounded-[14px] border border-white/20 bg-white/[0.07] px-4 text-right text-[20px] text-white outline-none transition placeholder:text-white/40 focus:border-fuchsia-400/60 focus:bg-white/10"
          />
        </div>

        {/* Terms* — mandatory, approved wording, real /terms + /privacy links */}
        <label className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 text-[17px] leading-snug text-white/75">
          <input
            type="checkbox"
            required
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-500"
          />
          <span>
            {consentCopy.termsPrefix}
            <Link href="/terms" className="font-medium text-fuchsia-200 underline underline-offset-4 hover:text-white">
              {consentCopy.termsLink}
            </Link>
            {consentCopy.termsAnd}
            <Link href="/privacy" className="font-medium text-fuchsia-200 underline underline-offset-4 hover:text-white">
              {consentCopy.privacyLink}
            </Link>
            {consentCopy.termsSuffix} <span className="text-rose-300">*</span>
          </span>
        </label>

        {/* Marketing consent — OPTIONAL, not pre-checked, approved wording */}
        <label className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 text-[17px] leading-snug text-white/75">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-500"
          />
          <span>{consentCopy.marketingConsent}</span>
        </label>

        {error ? (
          <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-center text-[16px] text-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-1.5 min-h-[58px] rounded-full text-[21px] font-black text-[#1a0b14] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: GRAD_SUBMIT, boxShadow: "0 18px 40px -14px rgba(217,70,239,0.6)" }}
        >
          {busy ? c.submitting : c.submit}
        </button>
        <p className="mt-3 text-center text-[16px] text-white/55">{c.reassure}</p>
      </form>
    </div>
  );
}
