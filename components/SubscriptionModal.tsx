"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Check, Crown, Infinity as InfinityIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
    subtitleLead:        "שתי דקות, ואתם בדרך להמשך המשחק",
    titlePaywallSelect:  "בחרו את החבילה שמתאימה לכם",
    subtitlePaywall:     "כל חבילה פותחת את כל המשחקים במיאושי - ביטול בקליק אחד",
    titlePaywallConfirm: "עוד צעד קטן לתשלום",
    subtitleConfirm:     "נאשר את המדינה ואת המע״מ ונעביר לעמוד הסליקה המאובטח",
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
    emailExists:         "אימייל זה כבר רשום - בדוק את הסיסמה ונסה שוב",
    countryLabel:        "מדינה",
    countryPlaceholder:  "בחר מדינה",
    vatNote:             (pct: number) => `כולל מע״מ ${pct}%`,
    saveCta:             "המשך למשחק",
    saving:              "רגע…",
    recommended:         "מומלץ",
    bestValue:           "הכי משתלם",
    cancelNote:          "ביטול בכל עת בלחיצה אחת.",
    maybeLater:          "אולי אחר כך",
    continueCta:         "בחירת חבילה זו",
    paymentCta:          "לעמוד התשלום",
    backToPackages:      "חזרה לחבילות",
    close:               "סגירה",
    alreadyMember:       "כבר יש לכם חשבון?",
    signInCta:           "להתחברות",
    features: [
      "משחק חופשי בכל משחקי מיאושי",
      "ביטול בקליק אחד, בכל רגע",
    ],
    period: {
      weekly:  { label: "שבועי", short: "לשבוע",  note: "/שבוע", blurb: "התנסות קצרה ללא התחייבות" },
      monthly: { label: "חודשי", short: "לחודש", note: "/חודש", blurb: "הפופולרי ביותר - משחק חופשי בכל משחק" },
      annual:  { label: "שנתי",  short: "לשנה",  note: "/שנה",  blurb: "החיסכון הכי גדול - ₪30 לחודש בלבד" },
    },
  },
  en: {
    titleLead:           "Before you continue",
    subtitleLead:        "Two minutes, and you're back in the game",
    titlePaywallSelect:  "Pick the plan that fits you",
    subtitlePaywall:     "Every plan unlocks every game on Mioshy - cancel anytime with one click",
    titlePaywallConfirm: "One small step to payment",
    subtitleConfirm:     "We'll confirm your country + VAT and send you to the secure checkout",
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
    emailExists:         "This email is already registered - check your password and try again",
    countryLabel:        "Country",
    countryPlaceholder:  "Select country",
    vatNote:             (pct: number) => `Includes ${pct}% VAT`,
    saveCta:             "Keep playing",
    saving:              "One sec…",
    recommended:         "Recommended",
    bestValue:           "Best value",
    cancelNote:          "Cancel anytime with one click.",
    maybeLater:          "Maybe later",
    continueCta:         "Choose this plan",
    paymentCta:          "Go to checkout",
    backToPackages:      "Back to plans",
    close:               "Close",
    alreadyMember:       "Already have an account?",
    signInCta:           "Sign in",
    features: [
      "Unlimited play across every Mioshy game",
      "Cancel with one click, anytime",
    ],
    period: {
      weekly:  { label: "Weekly",  short: "/week",  note: "/week",  blurb: "A short trial - no commitment" },
      monthly: { label: "Monthly", short: "/month", note: "/month", blurb: "Most popular - unlimited play across every game" },
      annual:  { label: "Annual",  short: "/year",  note: "/year",  blurb: "The biggest saving - just $7 per month" },
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

// ── Plan prices (display only - server resolves the real charge) ─────────────

const TEST_PRICE = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE
  ? String(process.env.NEXT_PUBLIC_BILLING_TEST_PRICE)
  : null;

const PRICES_ILS = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "9", monthly: "37", annual: "369" };

const PRICES_USD = TEST_PRICE
  ? { weekly: TEST_PRICE, monthly: TEST_PRICE, annual: TEST_PRICE }
  : { weekly: "3", monthly: "9", annual: "123" };

type Plan = "weekly" | "monthly" | "annual";

// ── Per-game palette lookup - matches GamePageBackground.SLUG_THEMES ──────────
// Keep this list in sync. Admin overrides via bg_value will cascade naturally
// once we wire the prop through - until then the slug is sufficient.
const SLUG_PALETTES: Record<string, [string, string, string]> = {
  "first-date-spin":     ["#9b00ff", "#ff0099", "#00d4ff"],
  "couple-heart-spin":   ["#ff0050", "#cc0088", "#ff7700"],
  "friends-party-spin":  ["#ffcc00", "#66ff00", "#ff5500"],
  "intimate-sparks-spin":["#0055ff", "#00ddff", "#aa00ff"],
  "couple-renewal-spin": ["#ff9900", "#ff3300", "#ffee00"],
  "better-date-spin":    ["#00ff88", "#00bbff", "#aaff00"],
  "peak-desire-spin":    ["#ff0077", "#cc0033", "#ff44cc"],
  "truth-or-dare":       ["#8800ff", "#dd00ff", "#0099ff"],
  "wheel-of-love":       ["#ff8800", "#ff0044", "#ffdd00"],
  "naughty-or-nice":     ["#0099ff", "#00ffcc", "#ff0099"],
};

const DEFAULT_PALETTE: [string, string, string] = ["#a855f7", "#ec4899", "#3b82f6"];

function resolvePalette(gameSlug?: string): [string, string, string] {
  if (!gameSlug) return DEFAULT_PALETTE;
  return SLUG_PALETTES[gameSlug] ?? DEFAULT_PALETTE;
}

// ── Animated gradient background for the modal ────────────────────────────────

function ModalBackdrop({ palette }: { palette: [string, string, string] }) {
  const [c1, c2, c3] = palette;
  const blobs = [
    { color: c1, size: "80%", x: "20%", y: "30%", dx: 120, dy: 80,  dur: 18, blur: 80,  op: 0.45 },
    { color: c2, size: "70%", x: "75%", y: "60%", dx: 100, dy: 110, dur: 22, blur: 90,  op: 0.40 },
    { color: c3, size: "55%", x: "50%", y: "10%", dx: 80,  dy: 100, dur: 27, blur: 100, op: 0.30 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      {/* Translucent dark wash - lets the page behind show through.
       *  Using rgba with 0.65 alpha instead of a solid color so we get one
       *  unified dark layer that still reveals what's underneath. */}
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{ background: "rgba(5,3,12,0.65)" }}
      />
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y,
            translateX: "-50%",
            translateY: "-50%",
            background: b.color,
            filter: `blur(${b.blur}px)`,
            opacity: b.op,
            willChange: "transform",
          }}
          animate={{
            x: [0, b.dx * (i % 2 === 0 ? 1 : -1), 0],
            y: [0, b.dy, b.dy * -0.5, 0],
          }}
          transition={{ duration: b.dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        />
      ))}
      {/* Scanlines for depth */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 5px)",
        }}
      />
      {/* Soft vignette so text stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, transparent 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}

// ── Plan card (experiential) ──────────────────────────────────────────────────

function PlanCardButton({
  id,
  price,
  currency,
  labels,
  features,
  featured,
  tag,
  accent,
  onSelect,
  busy,
  ctaText,
}: {
  id: Plan;
  price: string;
  currency: string;
  labels: { label: string; note: string; blurb: string };
  features: readonly string[];
  featured?: boolean;
  tag?: string;
  accent: string;
  onSelect: () => void;
  busy: boolean;
  ctaText: string;
}) {
  const icon =
    id === "weekly" ? <Sparkles className="h-5 w-5" /> :
    id === "monthly" ? <InfinityIcon className="h-5 w-5" /> :
    <Crown className="h-5 w-5" />;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={busy}
      aria-label={`${labels.label} ${currency}${price}`}
      className={`group relative flex w-full flex-col items-stretch gap-3 rounded-2xl border p-5 text-start transition-all focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60 ${
        featured
          ? "border-transparent shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]"
          : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
      }`}
      style={
        featured
          ? {
              background:
                `linear-gradient(135deg, ${accent}40 0%, rgba(255,255,255,0.07) 100%)`,
              boxShadow: `0 0 0 1px ${accent}66, 0 20px 60px -20px ${accent}77`,
            }
          : undefined
      }
    >
      {tag && (
        <span
          className="absolute top-3 end-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow"
          style={{ background: accent }}
        >
          {tag}
        </span>
      )}

      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-inner"
          style={{ background: `${accent}33`, color: accent }}
        >
          {icon}
        </span>
        <span className="text-base font-extrabold leading-none text-white">
          {labels.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-black tracking-tight text-white">
          {currency}{price}
        </span>
        <span className="text-sm font-semibold text-white/70">{labels.note}</span>
      </div>

      <p className="text-sm text-white/80">{labels.blurb}</p>

      <ul className="mt-1 space-y-1.5 text-sm text-white/85">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <span
        className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition group-hover:brightness-110"
        style={{ background: accent }}
      >
        {ctaText}
      </span>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionModal({
  open,
  onOpenChange,
  locked,
  userId,
  onRequireAuth,
  mode,
  onLeadSaved,
  gameSlug,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locked: boolean;
  userId: string | null;
  onRequireAuth: () => Promise<string | null>;
  onSubscribed?: () => void;
  mode: "lead" | "paywall";
  onLeadSaved?: (leadId: string, newUserId?: string | null) => void;
  /** Used to pick an animated gradient palette that matches the game theme. */
  gameSlug?: string;
}) {
  const locale   = useLocale() as "he" | "en";
  const t        = T[locale] ?? T.en;
  const isHe     = locale === "he";
  const currency = isHe ? "₪" : "$";
  const palette  = useMemo(() => resolvePalette(gameSlug), [gameSlug]);
  const accent   = palette[0];

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
  const [stage, setStage]             = useState<"select" | "confirm">("select");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset paywall stage whenever the modal is re-opened.
  useEffect(() => {
    if (!open) {
      setStage("select");
      setSelectedPlan(null);
      setError(null);
    }
  }, [open]);

  const PRICES = isHe ? PRICES_ILS : PRICES_USD;

  // Auto-detect country (paywall only, on entering confirm stage)
  useEffect(() => {
    if (mode !== "paywall") return;
    if (stage !== "confirm") return;
    if (countryCode) return;
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
  }, [mode, stage, countryCode]);

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

      // Resolve the real user id - Supabase has a privacy quirk: when the
      // email is already registered, it returns a synthetic `user` object
      // whose `id` is NOT a real row in auth.users (and `identities` is an
      // empty array). Passing that fake id to our leads table triggers the
      // leads_user_id_fkey violation. So:
      //   - on explicit error → fall back to sign-in with the given password
      //   - on synthetic user (identities: []) → also treat as "already exists"
      //   - on real new user → use it as-is
      let uid: string | null = null;

      const looksSynthetic =
        !!signUpData?.user &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0;

      if (signUpError || looksSynthetic) {
        const msg = (signUpError?.message ?? "").toLowerCase();
        const isAlreadyExists =
          looksSynthetic ||
          msg.includes("already") ||
          msg.includes("exists") ||
          msg.includes("registered");

        if (isAlreadyExists) {
          const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({
            email:    email.trim().toLowerCase(),
            password,
          });
          if (siErr || !siData?.user?.id) { setError(t.emailExists); return; }
          uid = siData.user.id;
        } else {
          setError(signUpError?.message ?? (isHe ? "שגיאה בהרשמה" : "Sign-up error"));
          return;
        }
      } else {
        uid = signUpData?.user?.id ?? null;
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
      const json = await res.json().catch(() => ({ success: false, code: "NETWORK_ERROR" }));
      if (!json.success) {
        const codeMsg: Record<string, { he: string; en: string }> = {
          UNAUTHORIZED:          { he: "אנא התחברו תחילה ונסו שוב.",                          en: "Please sign in and try again." },
          INVALID_PLAN:          { he: "תוכנית לא חוקית. בחרו תוכנית אחרת.",                   en: "Invalid plan. Please pick another." },
          MISSING_EMAIL:         { he: "חסר אימייל בחשבון. פנו לתמיכה.",                       en: "Account has no email. Please contact support." },
          MISSING_CARDCOM_ENV:   { he: "שער התשלומים אינו מוגדר. פנו לתמיכה.",                  en: "Payment gateway not configured. Please contact support." },
          DB_ERROR:              { he: "שגיאה ביצירת תשלום. נסו שוב בעוד רגע.",                en: "Could not create payment. Please try again in a moment." },
          CARDCOM_NETWORK_ERROR: { he: "שער התשלומים אינו זמין כרגע. נסו שוב.",                 en: "Payment gateway unreachable. Please try again." },
          CARDCOM_REJECTED:      { he: "שער התשלומים דחה את הבקשה. נסו כרטיס אחר או פנו לתמיכה.", en: "Payment gateway rejected the request. Try another card or contact support." },
          NETWORK_ERROR:         { he: "שגיאת רשת. בדקו את החיבור שלכם.",                     en: "Network error. Please check your connection." },
        };
        const c = typeof json.code === "string" ? json.code : "";
        const pick = codeMsg[c];
        setError(
          pick
            ? (isHe ? pick.he : pick.en)
            : json.message ?? (isHe ? "שגיאה בפתיחת עמוד תשלום" : "Failed to open payment page"),
        );
        return;
      }
      if (!json.redirect_url) {
        setError(isHe ? "התקבלה תגובה ריקה משער התשלומים. נסו שוב." : "Empty response from payment gateway. Please try again.");
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

  const headerTitle =
    mode === "lead"
      ? t.titleLead
      : stage === "confirm"
        ? t.titlePaywallConfirm
        : t.titlePaywallSelect;

  const headerSubtitle =
    mode === "lead"
      ? t.subtitleLead
      : stage === "confirm"
        ? t.subtitleConfirm
        : t.subtitlePaywall;

  return (
    <Dialog open={open} onOpenChange={(v) => (locked ? null : onOpenChange(v))}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-white/10 bg-transparent p-0 text-white shadow-2xl sm:max-w-lg md:max-w-3xl lg:max-w-4xl"
      >
        {/* Animated gradient backdrop */}
        <ModalBackdrop palette={palette} />

        {/* Custom close button - logical-end (RTL: visual left, LTR: visual right) */}
        {!locked && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t.close}
            className="absolute top-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative z-0 max-h-[85vh] overflow-y-auto px-5 pb-6 pt-7 sm:px-7">
          <DialogHeader
            className={`items-start gap-1.5 text-start ${
              mode === "lead" ? "mx-auto w-full max-w-sm" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow"
                style={{ background: accent }}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <DialogTitle className="text-xl font-extrabold leading-tight sm:text-2xl">
                {headerTitle}
              </DialogTitle>
            </div>
            <p className="max-w-prose text-sm text-white/75">{headerSubtitle}</p>
          </DialogHeader>

          {mode === "lead" ? (
            /* ── Lead registration ──────────────────────────────────────── */
            /* Single translucent layer - no inner card chrome. The form sits
             * directly on the modal's one dark-translucent backdrop so the
             * game page behind bleeds through and the colours wash through. */
            <div className="mx-auto mt-5 flex w-full max-w-sm flex-col gap-4">
              <div className="grid gap-1.5">
                <Label className="text-sm font-semibold text-white/90">{t.fullNameLabel}</Label>
                <Input
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-sm font-semibold text-white/90">{t.emailLabel}</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-sm font-semibold text-white/90">{t.passwordLabel}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className={`border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40 ${isHe ? "pl-14" : "pr-14"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={`absolute inset-y-0 flex items-center px-3 text-xs font-semibold text-white/70 hover:text-white ${isHe ? "left-0" : "right-0"}`}
                  >
                    {showPassword ? t.hidePwd : t.showPwd}
                  </button>
                </div>
              </div>

              {/* Marketing consent - bare row, no background chrome */}
              <label className="flex cursor-pointer items-start gap-2.5 py-0.5">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                  style={{ accentColor: accent }}
                />
                <span className="text-sm leading-snug text-white/90">
                  {t.marketingLabel}
                </span>
              </label>

              {/* Terms - bare row, no background chrome */}
              <label className="flex cursor-pointer items-start gap-2.5 py-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ accentColor: accent }}
                />
                <span className="text-sm leading-snug text-white/90">
                  {t.termsLabel}
                  <a
                    href={isHe ? "/he/terms" : "/en/terms"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: accent }}
                  >
                    {t.termsLink}
                  </a>
                </span>
              </label>

              {error && (
                <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-400/40">
                  {error}
                </p>
              )}

              <Button
                className="min-h-[52px] w-full rounded-full text-base font-bold text-white shadow-lg"
                disabled={busy || !leadFormValid}
                onClick={() => void saveLead()}
                style={{
                  background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                }}
              >
                {busy ? t.saving : t.saveCta}
              </Button>

              {/* Already-a-member shortcut - takes the user to the sign-in flow */}
              <p className="text-center text-xs text-white/70">
                {t.alreadyMember}{" "}
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    void onRequireAuth();
                  }}
                  disabled={busy}
                  className="font-semibold underline underline-offset-4 transition hover:text-white disabled:opacity-60"
                  style={{ color: accent }}
                >
                  {t.signInCta}
                </button>
              </p>
            </div>
          ) : stage === "select" ? (
            /* ── Paywall step 1: experiential package picker ────────────── */
            <div className="mt-5 flex flex-col gap-4">
              {error && (
                <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-400/40">
                  {error}
                </p>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <PlanCardButton
                  id="weekly"
                  price={PRICES.weekly}
                  currency={currency}
                  labels={t.period.weekly}
                  features={t.features}
                  accent={palette[2]}
                  busy={busy}
                  ctaText={t.continueCta}
                  onSelect={() => {
                    setSelectedPlan("weekly");
                    setStage("confirm");
                  }}
                />
                <PlanCardButton
                  id="monthly"
                  price={PRICES.monthly}
                  currency={currency}
                  labels={t.period.monthly}
                  features={t.features}
                  featured
                  tag={t.recommended}
                  accent={palette[0]}
                  busy={busy}
                  ctaText={t.continueCta}
                  onSelect={() => {
                    setSelectedPlan("monthly");
                    setStage("confirm");
                  }}
                />
                <PlanCardButton
                  id="annual"
                  price={PRICES.annual}
                  currency={currency}
                  labels={t.period.annual}
                  features={t.features}
                  tag={t.bestValue}
                  accent={palette[1]}
                  busy={busy}
                  ctaText={t.continueCta}
                  onSelect={() => {
                    setSelectedPlan("annual");
                    setStage("confirm");
                  }}
                />
              </div>

              <p className="mt-1 text-center text-xs text-white/60">{t.cancelNote}</p>
            </div>
          ) : (
            /* ── Paywall step 2: confirm country + go to checkout ────────── */
            <div className="mt-5 flex flex-col gap-4">
              {selectedPlan && (
                <div
                  className="rounded-2xl border border-white/15 p-4"
                  style={{
                    background:
                      `linear-gradient(135deg, ${accent}26 0%, rgba(255,255,255,0.05) 100%)`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        {t.recommended === T[locale].recommended && selectedPlan === "monthly"
                          ? t.recommended
                          : selectedPlan === "annual"
                            ? t.bestValue
                            : t.period[selectedPlan].label}
                      </p>
                      <p className="mt-0.5 text-base font-bold text-white">
                        {t.period[selectedPlan].label}
                      </p>
                    </div>
                    <div className="text-end">
                      <div className="text-2xl font-black text-white">
                        {currency}{PRICES[selectedPlan]}
                      </div>
                      <div className="text-xs font-semibold text-white/70">
                        {t.period[selectedPlan].note}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label className="text-sm font-semibold text-white/90">{t.countryLabel}</Label>
                <Select
                  value={countryCode}
                  onValueChange={(v) => {
                    const code  = String(v ?? "");
                    const match = COUNTRIES.find((c) => c.code === code);
                    setCountryCode(code);
                    setCountryName(match ? match.en : code === "ZZ" ? "Other" : "");
                  }}
                >
                  <SelectTrigger className="w-full border-white/15 bg-white/10 text-white">
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
                <p className="text-xs text-white/70">{t.vatNote(vatRatePercent)}</p>
              )}

              {TEST_PRICE && (
                <p className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30">
                  {isHe ? `🧪 מצב בדיקה - מחיר: ${currency}${TEST_PRICE}` : `🧪 Test mode - price: ${currency}${TEST_PRICE}`}
                </p>
              )}

              {error && (
                <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-400/40">
                  {error}
                </p>
              )}

              <Button
                className="min-h-[52px] w-full rounded-full text-base font-bold text-white shadow-lg"
                disabled={busy || !selectedPlan}
                onClick={() => selectedPlan && void startPayment(selectedPlan)}
                style={{
                  background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                }}
              >
                {busy ? t.saving : t.paymentCta}
              </Button>

              <button
                type="button"
                onClick={() => setStage("select")}
                className="mx-auto text-xs font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline"
              >
                ← {t.backToPackages}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
