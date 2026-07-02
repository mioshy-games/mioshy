"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listCountries, findCountry, type Country } from "@/lib/countries";
import { useTrialOffer } from "@/hooks/useTrialOffer";

/**
 * PricingCheckout
 * ──────────────────────────────────────────────────────────────
 * Two-stage CTA for the Journey pillar:
 *
 *   1. Click → opens a confirmation popup (same UX as the wheels'
 *      SubscriptionModal): greeting, price, IP-detected country
 *      pinned to the top of a searchable picker, and one CTA.
 *   2. Confirm → POSTs to /api/billing/checkout/create and
 *      redirects to the Cardcom hosted checkout URL.
 *
 * Why a popup at all when the server is the source of truth for
 * country/VAT?
 *   - Visual consistency with the wheel flow (Itzik request #43).
 *   - Lets the user *see* their country and VAT before paying, so
 *     there are no "wait, why am I being charged USD?" surprises.
 *   - The chosen country is sent advisory-only — the server still
 *     trusts the Vercel edge headers (lib/geo-from-request.ts).
 *
 * Auth: 401 from the server pushes the user to /auth/signup with a
 * `next` query param so they bounce right back to /pricing.
 */
export function PricingCheckout({
  isHe,
  product,
  plan,
  ctaLabel,
  tax_note_he,
  tax_note_en,
}: {
  isHe: boolean;
  product: "journey" | "games" | "adults";
  // 2026-05-22 — subscriptions are weekly-only. The prop is kept so the
  // surface that mounts this component still expresses intent, but the
  // only legal value is "weekly". Server validates and rejects others.
  plan: "weekly";
  ctaLabel: string;
  tax_note_he: string;
  tax_note_en: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A3: content-only trial for this pillar (adults resolves to disabled). When
  // enabled the CTA + checkout swap to the 7-day trial flow.
  const trial = useTrialOffer({ product, coaching: false, isHe, plan });

  // Country state — IP-detected on dialog open, but the user can change it.
  const [countryCode, setCountryCode] = useState("");
  const [detectedCountry, setDetectedCountry] = useState<Country | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Reset transient picker state whenever the dialog closes so the next
  // open is fresh (and we don't show a stale "no results" message).
  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      setPickerQuery("");
      setError(null);
    }
  }, [open]);

  // IP geo lookup once when the dialog opens. Same endpoint as the
  // SubscriptionModal so the experience is identical across pillars.
  useEffect(() => {
    if (!open) return;
    if (countryCode) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const j = (await res.json()) as { country?: string };
        if (cancelled) return;
        const code = (j.country ?? "").toUpperCase();
        if (!code) return;
        const found = findCountry(code);
        if (found) {
          setCountryCode(found.code);
          setDetectedCountry(found);
        } else {
          setCountryCode(code);
        }
      } catch {
        /* swallow — server geo will still work */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, countryCode]);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const endpoint = trial.enabled
        ? "/api/billing/checkout/create-trial"
        : "/api/billing/checkout/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product,
          plan,
          purchase_type: "subscription",
          return_path: "/my",
          // Advisory only — server ultimately trusts Vercel edge geo.
          country_code: countryCode || null,
          is_israeli: countryCode === "IL",
          language: isHe ? "he" : "en",
          // Entry surface → content-only price. Explicit false because journey
          // checkout defaults coaching to TRUE; the server ignores this for
          // non-journey products. With-coaching is chosen on the results paywall.
          coaching: false,
        }),
      });

      if (res.status === 401) {
        const next = encodeURIComponent("/pricing");
        router.push(`/auth/signup?next=${next}`);
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const code = data?.code as string | undefined;
        if (code === "GEO_UNKNOWN") {
          setError(
            isHe
              ? "לא הצלחנו לזהות את המדינה שלכם. כתבו אלינו לתמיכה ונשלים ידנית."
              : "We couldn't determine your country. Please contact support and we'll complete the order manually.",
          );
        } else {
          setError(
            isHe
              ? "משהו לא הסתדר. נסו שוב בעוד רגע."
              : "Something went wrong. Please try again in a moment.",
          );
        }
        setLoading(false);
        return;
      }

      const url = data?.redirect_url as string | undefined;
      if (!url) {
        setError(
          isHe
            ? "לא קיבלנו כתובת תשלום מהשרת. נסו שוב."
            : "We didn't receive a payment URL from the server. Please try again.",
        );
        setLoading(false);
        return;
      }
      window.location.assign(url);
    } catch (err) {
      console.error("[PricingCheckout] checkout failed", err);
      setError(
        isHe
          ? "התרחשה שגיאת רשת. נסו שוב."
          : "Network error. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mt-10">
      {/* Trigger button — opens the country confirmation popup */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex w-full min-h-[60px] items-center justify-center gap-3 rounded-full bg-[#170E14] px-8 text-[18px] font-semibold text-white shadow-[0_18px_40px_-12px_rgba(184,60,77,0.45)] transition hover:bg-[#B83C4D] hover:shadow-[0_22px_50px_-12px_rgba(184,60,77,0.6)]"
      >
        {trial.enabled ? trial.ctaLabel : ctaLabel}
        <span
          aria-hidden
          className={`inline-block transition-transform group-hover:translate-x-[-3px] ${
            isHe ? "" : "rotate-180"
          }`}
        >
          ←
        </span>
      </button>

      <p className="mt-4 text-center text-[14px] text-[#7A6A75]">
        {trial.enabled && trial.disclosure ? trial.disclosure : isHe ? tax_note_he : tax_note_en}
      </p>

      {/* Country confirmation dialog */}
      <CountryConfirmDialog
        isHe={isHe}
        open={open}
        onOpenChange={setOpen}
        loading={loading}
        error={error}
        countryCode={countryCode}
        setCountryCode={setCountryCode}
        detectedCountry={detectedCountry}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        pickerQuery={pickerQuery}
        setPickerQuery={setPickerQuery}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Country confirmation dialog — mirrors SubscriptionModal's
// SinglePlanPaywall but stripped down for the journey marketing flow.
// ─────────────────────────────────────────────────────────────────────

function CountryConfirmDialog({
  isHe,
  open,
  onOpenChange,
  loading,
  error,
  countryCode,
  setCountryCode,
  detectedCountry,
  pickerOpen,
  setPickerOpen,
  pickerQuery,
  setPickerQuery,
  onConfirm,
}: {
  isHe: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  countryCode: string;
  setCountryCode: (v: string) => void;
  detectedCountry: Country | null;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  pickerQuery: string;
  setPickerQuery: (v: string) => void;
  onConfirm: () => void;
}) {
  const locale: "he" | "en" = isHe ? "he" : "en";
  const selected = useMemo<Country | null>(() => {
    if (!countryCode) return null;
    return findCountry(countryCode);
  }, [countryCode]);

  const { pinned, rest } = useMemo(
    () =>
      listCountries({
        locale,
        pinTopCode: detectedCountry?.code ?? null,
        query: pickerQuery,
      }),
    [locale, detectedCountry, pickerQuery],
  );

  const onPick = (c: Country) => {
    setCountryCode(c.code);
    setPickerOpen(false);
    setPickerQuery("");
  };

  const selectedDisplay = selected
    ? isHe
      ? selected.he
      : selected.en
    : isHe
      ? "בחר מדינה"
      : "Select country";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-white/10 bg-[#0E0810] p-0 text-white shadow-2xl sm:max-w-md"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute top-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative max-h-[85vh] overflow-y-auto px-6 pb-6 pt-7 sm:px-7">
          <DialogHeader className="items-center gap-2 text-center">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #B83C4D, #6C2E40)",
              }}
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <DialogTitle className="font-heading text-2xl font-extrabold leading-tight text-white sm:text-[26px]">
              {isHe ? "עוד צעד קטן" : "One small step"}
            </DialogTitle>
            <p className="max-w-[30ch] text-sm leading-snug text-white/70">
              {isHe
                ? "נאשר את המדינה ואת המע״מ ונעביר לעמוד הסליקה המאובטח."
                : "We'll confirm your country + VAT and send you to the secure checkout."}
            </p>
          </DialogHeader>

          {error ? (
            <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-400/40">
              {error}
            </p>
          ) : null}

          {/* Country picker */}
          <div className="relative mt-5 grid gap-1.5">
            <Label className="text-sm font-semibold text-white/90">
              {isHe ? "מדינה" : "Country"}
            </Label>
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className={`flex h-12 items-center justify-between rounded-xl border bg-white/5 px-4 text-start text-sm text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 ${
                pickerOpen ? "border-white/30 bg-white/10" : "border-white/15"
              }`}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
            >
              <span className="flex items-center gap-2">
                {selected ? (
                  <span
                    className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-white/70"
                    aria-hidden
                  >
                    {selected.code}
                  </span>
                ) : null}
                <span className={selected ? "text-white" : "text-white/40"}>
                  {selectedDisplay}
                </span>
              </span>
              <span className="text-white/50">{pickerOpen ? "▴" : "▾"}</span>
            </button>

            {pickerOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setPickerOpen(false)}
                />
                <div
                  className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-[rgba(8,4,16,0.97)] shadow-2xl"
                  role="listbox"
                >
                  <div className="border-b border-white/10 p-2">
                    <Input
                      autoFocus
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      placeholder={
                        isHe ? "חיפוש מדינה…" : "Search country…"
                      }
                      className="h-9 border-white/15 bg-white/10 text-sm text-white placeholder:text-white/40 focus-visible:ring-white/40"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {pinned ? (
                      <>
                        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                          {isHe ? "המדינה שזיהינו" : "Detected country"}
                        </div>
                        <CountryRow
                          country={pinned}
                          selected={selected?.code === pinned.code}
                          isHe={isHe}
                          onClick={() => onPick(pinned)}
                        />
                        {rest.length > 0 ? (
                          <>
                            <div className="my-1 h-px bg-white/10" />
                            <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                              {isHe ? "כל המדינות" : "All countries"}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {rest.length === 0 && !pinned ? (
                      <div className="px-3 py-6 text-center text-sm text-white/55">
                        {isHe ? "לא נמצאו תוצאות" : "No matches"}
                      </div>
                    ) : (
                      rest.map((c) => (
                        <CountryRow
                          key={c.code}
                          country={c}
                          selected={selected?.code === c.code}
                          isHe={isHe}
                          onClick={() => onPick(c)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* VAT note — surfaces the implication of the chosen country
              so the user sees what they're agreeing to before clicking. */}
          <p className="mt-3 text-center text-xs text-white/55">
            {countryCode === "IL"
              ? isHe
                ? "המחיר כולל מע״מ 18%"
                : "Price includes 18% VAT"
              : isHe
                ? "פטור ממע״מ - יצוא"
                : "VAT-exempt — export"}
          </p>

          <Button
            className="mt-5 min-h-[54px] w-full rounded-full text-base font-extrabold text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] transition hover:brightness-110 disabled:opacity-50"
            disabled={loading || !countryCode}
            onClick={onConfirm}
            style={{
              background:
                "linear-gradient(135deg, #B83C4D, #6C2E40)",
            }}
          >
            {loading
              ? isHe
                ? "מעבירים אתכם לתשלום…"
                : "Taking you to checkout…"
              : isHe
                ? "מעבר לתשלום"
                : "Continue to payment"}
          </Button>

          <p className="mt-3 text-center text-xs text-white/55">
            {isHe
              ? "תשלום מאובטח · ביטול בקליק אחד מהחשבון שלכם"
              : "Secure payment · Cancel from your account in one click"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CountryRow({
  country,
  selected,
  isHe,
  onClick,
}: {
  country: Country;
  selected: boolean;
  isHe: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition hover:bg-white/10 ${
        selected ? "bg-white/10" : ""
      }`}
      role="option"
      aria-selected={selected}
    >
      <span className="text-white">{isHe ? country.he : country.en}</span>
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-[#B83C4D]" />
      ) : (
        <span className="text-xs font-semibold tracking-wider text-white/40">
          {country.code}
        </span>
      )}
    </button>
  );
}
