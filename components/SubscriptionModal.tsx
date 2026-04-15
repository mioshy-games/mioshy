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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Translations ─────────────────────────────────────────────────────────────

const T = {
  he: {
    titleLead:     "לפני שממשיכים",
    titlePaywall:  "הירשמו כדי להמשיך לשחק",
    emailLabel:    "אימייל",
    emailPlaceholder: "you@example.com",
    nameLabel:     "שם (אופציונלי)",
    namePlaceholder: "שמך",
    countryLabel:  "מדינה",
    countryPlaceholder: "בחר מדינה",
    vatNote:       (pct: number) => `כולל מע״מ ${pct}%`,
    saveCta:       "שמור והמשך",
    saving:        "…",
    recommended:   "מומלץ",
    cancelNote:    "ביטול בכל עת בלחיצה אחת.",
    maybeLater:    "אולי אחר כך",
    payBtn:        (currency: string, price: string, note: string) =>
                     `שלם ${currency}${price}${note}`,
    period: {
      weekly:  { label: "שבועי",   note: "/שבוע" },
      monthly: { label: "חודשי",   note: "/חודש" },
      annual:  { label: "שנתי",    note: "/שנה"  },
    },
  },
  en: {
    titleLead:     "Before you continue",
    titlePaywall:  "Subscribe to keep playing",
    emailLabel:    "Email",
    emailPlaceholder: "you@example.com",
    nameLabel:     "Name (optional)",
    namePlaceholder: "Your name",
    countryLabel:  "Country",
    countryPlaceholder: "Select country",
    vatNote:       (pct: number) => `Includes ${pct}% VAT`,
    saveCta:       "Save & continue",
    saving:        "…",
    recommended:   "Recommended",
    cancelNote:    "Cancel anytime with one click.",
    maybeLater:    "Maybe later",
    payBtn:        (currency: string, price: string, note: string) =>
                     `Pay ${currency}${price}${note}`,
    period: {
      weekly:  { label: "Weekly",  note: "/week"  },
      monthly: { label: "Monthly", note: "/month" },
      annual:  { label: "Annual",  note: "/year"  },
    },
  },
} as const;

// ── Country list (bilingual) ──────────────────────────────────────────────────

type CountryOption = { code: string; he: string; en: string };

const COUNTRIES: CountryOption[] = [
  { code: "IL", he: "ישראל",          en: "Israel" },
  { code: "US", he: "ארצות הברית",    en: "United States" },
  { code: "GB", he: "בריטניה",        en: "United Kingdom" },
  { code: "CA", he: "קנדה",           en: "Canada" },
  { code: "AU", he: "אוסטרליה",       en: "Australia" },
  { code: "DE", he: "גרמניה",         en: "Germany" },
  { code: "FR", he: "צרפת",           en: "France" },
  { code: "ES", he: "ספרד",           en: "Spain" },
  { code: "IT", he: "איטליה",         en: "Italy" },
  { code: "NL", he: "הולנד",          en: "Netherlands" },
  { code: "SE", he: "שוודיה",         en: "Sweden" },
  { code: "NO", he: "נורווגיה",       en: "Norway" },
  { code: "DK", he: "דנמרק",          en: "Denmark" },
  { code: "BR", he: "ברזיל",          en: "Brazil" },
  { code: "MX", he: "מקסיקו",         en: "Mexico" },
  { code: "IN", he: "הודו",           en: "India" },
];

// ── Plan prices ───────────────────────────────────────────────────────────────

// Set NEXT_PUBLIC_BILLING_TEST_PRICE=1 in .env.local to charge 1 ₪ / $1 for testing
const TEST_PRICE = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE
  ? String(process.env.NEXT_PUBLIC_BILLING_TEST_PRICE)
  : null;

const PRICES_ILS = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "9",        monthly: "37",       annual: "369" };

const PRICES_USD = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "3",        monthly: "9",        annual: "123" };

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = "weekly" | "monthly" | "annual";
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
  onLeadSaved?: (leadId: string) => void;
}) {
  const locale = useLocale() as "he" | "en";
  const t      = T[locale] ?? T.en;
  const isHe   = locale === "he";
  const currency = isHe ? "₪" : "$";

  const [leadId, setLeadId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("mioshy:lead_id_v1");
  });
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRICES = isHe ? PRICES_ILS : PRICES_USD;

  const plans: PlanCard[] = useMemo(() => [
    { id: "weekly",  price: PRICES.weekly  },
    { id: "monthly", price: PRICES.monthly, recommended: true },
    { id: "annual",  price: PRICES.annual  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isHe]);

  // Auto-detect country
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const j = (await res.json()) as { country?: string; country_name?: string };
        if (cancelled) return;
        const code = (j.country ?? "").toUpperCase();
        const nm   = j.country_name ?? "";
        if (code) { setCountryCode(code); setCountryName(nm); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const vatRatePercent = countryCode === "IL" ? 18 : 0;

  // ── Save / upsert lead ────────────────────────────────────────────────────
  async function upsertLead(): Promise<string | null> {
    setError(null);
    const deviceId = getOrCreateDeviceId();

    const res = await fetch("/api/leads/upsert", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email:            email.trim().toLowerCase(),
        name:             name.trim() || null,
        language:         locale,
        device_id:        deviceId,
        country_code:     countryCode || null,
        country_name:     countryName || null,
        vat_rate_percent: vatRatePercent,
      }),
    });

    const json = await res.json().catch(() => ({ success: false, message: "Network error" }));

    if (!json.success) {
      setError(json.message ?? "שגיאה בשמירת הפרטים");
      return null;
    }

    const lid = String(json.lead_id);
    setLeadId(lid);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mioshy:lead_id_v1", lid);
    }
    onLeadSaved?.(lid);
    return lid;
  }

  async function saveLead() {
    setBusy(true);
    try {
      await upsertLead();
    } finally {
      setBusy(false);
    }
  }

  // ── Start payment ─────────────────────────────────────────────────────────
  async function startPayment(plan: Plan) {
    setError(null);
    setBusy(true);
    try {
      // 1. Ensure lead exists (upsert — no failure on duplicate)
      const lid = leadId ?? (await upsertLead());
      if (!lid) return;

      // 2. Ensure authenticated
      const uid = userId ?? (await onRequireAuth());
      if (!uid) {
        setError(isHe ? "אנא השלם את יצירת החשבון ונסה שוב." : "Please finish creating your account, then try again.");
        return;
      }

      // 3. Create Cardcom checkout session
      const res = await fetch("/api/billing/checkout/create", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email:            email.trim().toLowerCase(),
          name:             name.trim() || null,
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
        setError(json.message ?? (isHe ? "שגיאה בפתיחת עמוד תשלום" : "Failed to start payment"));
        return;
      }

      // 4. Redirect to Cardcom
      window.location.href = json.redirect_url;

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isHe ? "שגיאה בפתיחת תשלום" : "Failed to start payment"));
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => (locked ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "lead" ? t.titleLead : t.titlePaywall}
          </DialogTitle>
        </DialogHeader>

        {/* Form */}
        <div className="grid gap-4 rounded-2xl border border-purple-500/20 bg-[var(--mio-card)] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t.emailLabel}</Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                dir="ltr"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t.nameLabel}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t.countryLabel}</Label>
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

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        {/* CTA area */}
        {mode === "lead" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              className="min-h-[44px]"
              variant="default"
              disabled={busy || !email.trim()}
              onClick={() => void saveLead()}
            >
              {busy ? t.saving : t.saveCta}
            </Button>
          </div>
        ) : (
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
                      <span className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-200">
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
                    disabled={busy || !email.trim()}
                    onClick={() => void startPayment(p.id)}
                  >
                    {busy ? t.saving : t.payBtn(currency, p.price, period.note)}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={locked}>
            {t.maybeLater}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
