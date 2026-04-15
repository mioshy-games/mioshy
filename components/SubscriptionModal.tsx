"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Translations ──────────────────────────────────────────────────────────────

const T = {
  he: {
    titleLead:           "לפני שממשיכים",
    titlePaywall:        "הירשמו כדי להמשיך לשחק",
    fullNameLabel:       "שם מלא",
    fullNamePlaceholder: "שמך המלא",
    emailLabel:          "אימייל",
    emailPlaceholder:    "you@example.com",
    passwordLabel:       "סיסמה",
    passwordPlaceholder: "לפחות 6 תווים",
    showPwd:             "הצג",
    hidePwd:             "הסתר",
    marketingLabel:      "אני מסכים/ה לקבל עדכונים ומבצעים ממיאושי",
    termsLabel:          "קראתי ואני מאשר/ת את ",
    termsLink:           "תנאי השימוש ומדיניות הפרטיות",
    termsRequired:       "יש לאשר את תנאי השימוש להמשך",
    weakPassword:        "הסיסמה חייבת להכיל לפחות 6 תווים",
    emailExists:         "אימייל זה כבר רשום — בדוק את הסיסמה ונסה שוב",
    countryLabel:        "מדינה",
    countryPlaceholder:  "בחר מדינה",
    vatNote:             (pct: number) => `כולל מע״מ ${pct}%`,
    saveCta:             "המשך",
    saving:              "…",
    recommended:         "מומלץ",
    cancelNote:          "ביטול בכל עת בלחיצה אחת.",
    maybeLater:          "אולי אחר כך",
    payBtn:              (currency: string, price: string, note: string) =>
                           `שלם ${currency}${price}${note}`,
    period: {
      weekly:  { label: "שבועי", note: "/שבוע"  },
      monthly: { label: "חודשי", note: "/חודש"  },
      annual:  { label: "שנתי",  note: "/שנה"   },
    },
  },
  en: {
    titleLead:           "Before you continue",
    titlePaywall:        "Subscribe to keep playing",
    fullNameLabel:       "Full name",
    fullNamePlaceholder: "Your full name",
    emailLabel:          "Email",
    emailPlaceholder:    "you@example.com",
    passwordLabel:       "Password",
    passwordPlaceholder: "At least 6 characters",
    showPwd:             "Show",
    hidePwd:             "Hide",
    marketingLabel:      "I agree to receive updates and offers from Mioshy",
    termsLabel:          "I have read and accept the ",
    termsLink:           "Terms of Service and Privacy Policy",
    termsRequired:       "You must accept the terms to continue",
    weakPassword:        "Password must be at least 6 characters",
    emailExists:         "This email is already registered — check your password and try again",
    countryLabel:        "Country",
    countryPlaceholder:  "Select country",
    vatNote:             (pct: number) => `Includes ${pct}% VAT`,
    saveCta:             "Continue",
    saving:              "…",
    recommended:         "Recommended",
    cancelNote:          "Cancel anytime with one click.",
    maybeLater:          "Maybe later",
    payBtn:              (currency: string, price: string, note: string) =>
                           `Pay ${currency}${price}${note}`,
    period: {
      weekly:  { label: "Weekly",  note: "/week"  },
      monthly: { label: "Monthly", note: "/month" },
      annual:  { label: "Annual",  note: "/year"  },
    },
  },
} as const;

// ── Country list ──────────────────────────────────────────────────────────────

type CountryOption = { code: string; he: string; en: string };
const COUNTRIES: CountryOption[] = [
  { code: "IL", he: "ישראל",       en: "Israel"         },
  { code: "US", he: "ארצות הברית", en: "United States"  },
  { code: "GB", he: "בריטניה",     en: "United Kingdom" },
  { code: "CA", he: "קנדה",        en: "Canada"         },
  { code: "AU", he: "אוסטרליה",    en: "Australia"      },
  { code: "DE", he: "גרמניה",      en: "Germany"        },
  { code: "FR", he: "צרפת",        en: "France"         },
  { code: "ES", he: "ספרד",        en: "Spain"          },
  { code: "IT", he: "איטליה",      en: "Italy"          },
  { code: "NL", he: "הולנד",       en: "Netherlands"    },
  { code: "SE", he: "שוודיה",      en: "Sweden"         },
  { code: "NO", he: "נורווגיה",    en: "Norway"         },
  { code: "DK", he: "דנמרק",       en: "Denmark"        },
  { code: "BR", he: "ברזיל",       en: "Brazil"         },
  { code: "MX", he: "מקסיקו",      en: "Mexico"         },
  { code: "IN", he: "הודו",        en: "India"          },
];

// ── Plan prices ───────────────────────────────────────────────────────────────

const TEST_PRICE = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE
  ? String(process.env.NEXT_PUBLIC_BILLING_TEST_PRICE)
  : null;

const PRICES_ILS = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "9", monthly: "37", annual: "369" };

const PRICES_USD = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "3", monthly: "9", annual: "123" };

type Plan     = "weekly" | "monthly" | "annual";
type PlanCard = { id: Plan; price: string; recommended?: boolean };

// ── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionModal({
  open,
  onOpenChange,
  locked,
  userId,
  onRequireAuth,
  mode,
  onLeadSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locked: boolean;
  userId: string | null;
  onRequireAuth: () => Promise<string | null>;
  onSubscribed?: () => void;
  mode: "lead" | "paywall";
  onLeadSaved?: (leadId: string, newUserId?: string | null) => void;
}) {
  const locale   = useLocale() as "he" | "en";
  const t        = T[locale] ?? T.en;
  const isHe     = locale === "he";
  const currency = isHe ? "₪" : "$";

  const [leadId, setLeadId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("mioshy:lead_id_v1");
  });

  // lead-mode fields
  const [fullName,         setFullName]         = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [showPassword,     setShowPassword]     = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted,    setTermsAccepted]    = useState(false);

  // paywall-mode fields
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRICES = isHe ? PRICES_ILS : PRICES_USD;

  const plans: PlanCard[] = useMemo(
    () => [
      { id: "weekly",  price: PRICES.weekly  },
      { id: "monthly", price: PRICES.monthly, recommended: true },
      { id: "annual",  price: PRICES.annual  },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHe],
  );

  // Auto-detect country (paywall only)
  useEffect(() => {
    if (mode !== "paywall") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const j = (await res.json()) as { country?: string; country_name?: string };
        if (cancelled) return;
        const code = (j.country ?? "").toUpperCase();
        if (code) { setCountryCode(code); setCountryName(j.country_name ?? ""); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const vatRatePercent = countryCode === "IL" ? 18 : 0;

  const leadFormValid =
    fullName.trim().length >= 2 &&
    email.trim().includes("@") &&
    password.length >= 6 &&
    termsAccepted;

  // ── Upsert lead row ────────────────────────────────────────────────────────
  async function upsertLead(uid: string | null): Promise<string | null> {
    const deviceId = getOrCreateDeviceId();
    const res = await fetch("/api/leads/upsert", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email:             email.trim().toLowerCase(),
        full_name:         fullName.trim() || null,
        name:              fullName.trim() || null,
        language:          locale,
        device_id:         deviceId,
        country_code:      countryCode || null,
        country_name:      countryName || null,
        vat_rate_percent:  vatRatePercent,
        marketing_consent: marketingConsent,
        terms_accepted:    termsAccepted,
        terms_accepted_at: new Date().toISOString(),
        user_id:           uid,
      }),
    });
    const json = await res.json().catch(() => ({ success: false, message: "Network error" }));
    if (!json.success) {
      setError(json.message ?? (isHe ? "שגיאה בשמירת הפרטים" : "Failed to save details"));
      return null;
    }
    const lid = String(json.lead_id);
    setLeadId(lid);
    if (typeof window !== "undefined") window.localStorage.setItem("mioshy:lead_id_v1", lid);
    return lid;
  }

  // ── Lead mode: create account + save lead ─────────────────────────────────
  async function saveLead() {
    if (!termsAccepted) { setError(t.termsRequired); return; }
    if (password.length < 6) { setError(t.weakPassword); return; }
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();

      // Create Supabase account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email:   email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      let uid: string | null = signUpData?.user?.id ?? null;

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already") || msg.includes("exists")) {
          // Try sign-in
          const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({
            email:    email.trim().toLowerCase(),
            password,
          });
          if (siErr) { setError(t.emailExists); return; }
          uid = siData?.user?.id ?? null;
        } else {
          setError(signUpError.message);
          return;
        }
      }

      const lid = await upsertLead(uid);
      if (!lid) return;
      onLeadSaved?.(lid, uid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isHe ? "שגיאה" : "Error"));
    } finally {
      setBusy(false);
    }
  }

  // ── Paywall: start Cardcom payment ────────────────────────────────────────
  async function startPayment(plan: Plan) {
    setError(null);
    setBusy(true);
    try {
      const lid = leadId ?? (await upsertLead(userId));
      if (!lid) return;

      const uid = userId ?? (await onRequireAuth());
      if (!uid) {
        setError(isHe ? "אנא השלם את יצירת החשבון ונסה שוב." : "Please finish creating your account and try again.");
        return;
      }

      const res = await fetch("/api/billing/checkout/create", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          country_code:     countryCode || null,
          language:         locale,
          is_israeli:       countryCode === "IL",
          vat_rate_percent: vatRatePercent,
          lead_id:          lid,
        }),
      });
      const json = await res.json().catch(() => ({ success: false, message: "תגובה לא תקינה" }));
      if (!json.success) {
        setError(json.message ?? (isHe ? "שגיאה בפתיחת עמוד תשלום" : "Failed to open payment page"));
        return;
      }
      window.location.href = json.redirect_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isHe ? "שגיאה" : "Error"));
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => (locked ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {mode === "lead" ? t.titleLead : t.titlePaywall}
          </DialogTitle>
        </DialogHeader>

        {mode === "lead" ? (
          /* ── Registration form ──────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            {/* Full name */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">{t.fullNameLabel}</Label>
              <Input
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.fullNamePlaceholder}
              />
            </div>

            {/* Email */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">{t.emailLabel}</Label>
              <Input
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
              />
            </div>

            {/* Password */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-semibold">{t.passwordLabel}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className={isHe ? "pl-14" : "pr-14"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={`absolute inset-y-0 flex items-center px-3 text-xs text-white/60 hover:text-white ${isHe ? "left-0" : "right-0"}`}
                >
                  {showPassword ? t.hidePwd : t.showPwd}
                </button>
              </div>
            </div>

            {/* Marketing consent */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500"
              />
              <span className="text-sm leading-snug text-white/80">
                {t.marketingLabel}
              </span>
            </label>

            {/* Terms */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500"
              />
              <span className="text-sm leading-snug text-white/80">
                {t.termsLabel}
                <a
                  href={isHe ? "/he/terms" : "/en/terms"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.termsLink}
                </a>
              </span>
            </label>

            {error && (
              <p className="rounded-md bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-300">
                {error}
              </p>
            )}

            <Button
              className="min-h-[48px] w-full text-base font-bold"
              disabled={busy || !leadFormValid}
              onClick={() => void saveLead()}
            >
              {busy ? t.saving : t.saveCta}
            </Button>
          </div>
        ) : (
          /* ── Subscription plans ─────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label className="text-sm">{t.countryLabel}</Label>
              <Select
                value={countryCode}
                onValueChange={(v) => {
                  const code  = String(v ?? "");
                  const match = COUNTRIES.find((c) => c.code === code);
                  setCountryCode(code);
                  setCountryName(match ? match.en : code === "ZZ" ? "Other" : "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.countryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {isHe ? c.he : c.en}
                    </SelectItem>
                  ))}
                  <SelectItem value="ZZ">{isHe ? "אחר" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vatRatePercent > 0 && (
              <p className="text-xs text-white/60">{t.vatNote(vatRatePercent)}</p>
            )}

            {TEST_PRICE && (
              <p className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300">
                {isHe ? `🧪 מצב בדיקה — מחיר: ${currency}${TEST_PRICE}` : `🧪 Test mode — price: ${currency}${TEST_PRICE}`}
              </p>
            )}

            {error && (
              <p className="rounded-md bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-300">
                {error}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((p) => {
                const period = t.period[p.id];
                return (
                  <div
                    key={p.id}
                    className={
                      p.recommended
                        ? "rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-4"
                        : "rounded-2xl border p-4"
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold">{period.label}</div>
                      {p.recommended && (
                        <span className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-xs font-semibold text-fuchsia-200">
                          {t.recommended}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">
                      {currency}{p.price}
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">
                        {period.note}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t.cancelNote}</p>
                    <Button
                      className="mt-4 min-h-[44px] w-full"
                      variant={p.recommended ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => void startPayment(p.id)}
                    >
                      {busy ? t.saving : t.payBtn(currency, p.price, period.note)}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          {!locked && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/50 hover:text-white"
            >
              {t.maybeLater}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
