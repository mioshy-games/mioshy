"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Sparkles, X } from "lucide-react";
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
import { fetchCmsTextMap } from "@/lib/cms/client-text-map";
import { useTrialOffer } from "@/hooks/useTrialOffer";
import { metaTrack, metaEventId } from "@/lib/analytics/meta-pixel";

// CRM-managed copy for the lead-capture modal (category "marketing",
// migration 135). Read client-side; the `T` strings below stay as the in-code
// defaults / safety net (an empty or missing CMS row falls back to them).
const LEAD_CMS_KEYS = [
  "lead_modal_title", "lead_modal_subtitle",
  "lead_modal_label_name", "lead_modal_ph_name",
  "lead_modal_label_phone", "lead_modal_ph_phone",
  "lead_modal_label_email", "lead_modal_ph_email",
  "lead_modal_label_password", "lead_modal_ph_password", "lead_modal_password_show",
  "lead_modal_consent_marketing",
  "lead_modal_consent_terms_pre", "lead_modal_consent_terms_link",
  "lead_modal_submit",
  "lead_modal_have_account", "lead_modal_login_link",
  "lead_modal_close_aria",
] as const;
// Country picker removed 2026-06-02 (Itzik) — IL-only launch. The
// imports `listCountries / findCountry / type Country` were dropped
// together with the picker UI.

// ── Translations ──────────────────────────────────────────────────────────────

const T = {
  he: {
    titleLead:           "לפני שממשיכים",
    subtitleLead:        "שתי דקות, ואתם בדרך להמשך המשחק",
    titlePaywallSelect:  "בחרו את החבילה שמתאימה לכם",
    subtitlePaywall:     "כל חבילה פותחת את כל המשחקים במיאושי - ביטול בקליק אחד",
    paywallGreeting:     (name: string) => `שלום ${name}`,
    paywallGreetingFallback: "שלום",
    paywallSinglePlanSubtitle: "משחקי זוגות אונליין - ללילה בלתי נשכח, ליום הולדת, ליום נישואין, או סתם כשהילדים סוף סוף ישנים!",
    paywallPriceSuffix:  "/שבוע",
    paywallBilledNote:   "בחיוב חודשי של 36 ₪",
    paywallCancelNote:   "ניתן לעצור בכל עת. ללא התחייבות, ללא דמי ביטול.",
    paywallContinueCta:  "מעבר לתשלום",
    countrySearchPlaceholder: "חיפוש מדינה…",
    countryDetectedLabel: "המדינה שזיהינו",
    countryAllLabel:     "כל המדינות",
    countryNoResults:    "לא נמצאו תוצאות",
    titlePaywallConfirm: "עוד צעד קטן לתשלום",
    subtitleConfirm:     "נאשר את המדינה ואת המע״מ ונעביר לעמוד הסליקה המאובטח",
    fullNameLabel:       "שם מלא",
    fullNamePlaceholder: "שמך המלא",
    mobileLabel:         "טלפון נייד",
    mobilePlaceholder:   "מספר הטלפון שלכם",
    emailLabel:          "אימייל",
    emailPlaceholder:    "you@example.com",
    passwordLabel:       "סיסמה",
    passwordPlaceholder: "לפחות 8 תווים",
    showPwd:             "הצג",
    hidePwd:             "הסתר",
    marketingLabel:      "אני מסכים/ה לקבל עדכונים ומבצעים ממיאושי",
    termsLabel:          "קראתי ואני מאשר/ת את ",
    termsLink:           "תנאי השימוש ומדיניות הפרטיות",
    termsRequired:       "יש לאשר את תנאי השימוש להמשך",
    phoneRequired:       "נא להזין מספר טלפון נייד",
    weakPassword:        "הסיסמה חייבת להכיל לפחות 8 תווים",
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
      // 2026-05-22 — Itzik consolidated to weekly-only pricing. The
      // monthly/annual entries used to exist here; removed so no
      // legacy copy resurfaces. Kept the `weekly` shape so existing
      // call sites continue to compile.
      weekly:  { label: "שבועי", short: "לשבוע",  note: "/שבוע", blurb: "ביטול בכל עת בלחיצה אחת" },
    },
  },
  en: {
    titleLead:           "Before you continue",
    subtitleLead:        "Two minutes, and you're back in the game",
    titlePaywallSelect:  "Pick the plan that fits you",
    subtitlePaywall:     "Every plan unlocks every game on Mioshy - cancel anytime with one click",
    paywallGreeting:     (name: string) => `Hi ${name}`,
    paywallGreetingFallback: "Welcome",
    paywallSinglePlanSubtitle: "Online couples games - for an unforgettable night, a birthday, an anniversary, or simply when the kids are finally asleep!",
    paywallPriceSuffix:  "/week",
    paywallBilledNote:   "Billed $14/month",
    paywallCancelNote:   "Stop any time. No commitment, no cancellation fees.",
    paywallContinueCta:  "Continue to payment",
    countrySearchPlaceholder: "Search country…",
    countryDetectedLabel: "Detected country",
    countryAllLabel:     "All countries",
    countryNoResults:    "No matches",
    titlePaywallConfirm: "One small step to payment",
    subtitleConfirm:     "We'll confirm your country + VAT and send you to the secure checkout",
    fullNameLabel:       "Full name",
    fullNamePlaceholder: "Your full name",
    mobileLabel:         "Mobile",
    mobilePlaceholder:   "Your mobile number",
    emailLabel:          "Email",
    emailPlaceholder:    "you@example.com",
    passwordLabel:       "Password",
    passwordPlaceholder: "At least 8 characters",
    showPwd:             "Show",
    hidePwd:             "Hide",
    marketingLabel:      "I agree to receive updates and offers from Mioshy",
    termsLabel:          "I have read and accept the ",
    termsLink:           "Terms of Service and Privacy Policy",
    termsRequired:       "You must accept the terms to continue",
    phoneRequired:       "Please enter a mobile number",
    weakPassword:        "Password must be at least 8 characters",
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
      // 2026-05-22 — weekly-only pricing (see HE counterpart above).
      weekly:  { label: "Weekly",  short: "/week",  note: "/week",  blurb: "Cancel anytime with one click" },
    },
  },
} as const;

// ── Plan prices (display only - server resolves the real charge) ─────────────

const TEST_PRICE = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE
  ? String(process.env.NEXT_PUBLIC_BILLING_TEST_PRICE)
  : null;

// 2026-05-22 — weekly-only pricing (monthly + annual removed).
const PRICES_ILS = TEST_PRICE
  ? { weekly: TEST_PRICE }
  : { weekly: "9" };

const PRICES_USD = TEST_PRICE
  ? { weekly: TEST_PRICE }
  : { weekly: "3" };

type Plan = "weekly";

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

// PlanCardButton (3-plan picker) was removed 2026-05-06 when the paywall
// was redesigned to a single-plan flow. The SinglePlanPaywall component
// at the bottom of this file replaces it. If you ever need the 3-plan
// variant again, restore from git history before that date.

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
  const [mobile,           setMobile]           = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [showPassword,     setShowPassword]     = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted,    setTermsAccepted]    = useState(false);

  // paywall-mode fields
  // Itzik 2026-06-02: launching IL-only. Country picker removed from
  // the paywall UI. We hardcode IL so VAT (18%) + checkout payloads
  // continue to flow correctly without asking the user. If/when we
  // open to other markets, re-introduce the picker from git history.
  // `stage` (select / confirm) was also removed 2026-06-02 — the
  // confirm UI is long gone and clicks jump straight to Cardcom.
  const countryCode = "IL";
  const countryName = "Israel";

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A3: this is the GAMES paywall. When a trial is enabled for games, the CTA
  // swaps to the 7-day trial (token+J2, no charge) via create-trial.
  const trial = useTrialOffer({ product: "games", coaching: false, isHe, plan: "monthly" });

  // CRM copy for lead mode. `lt(key, fallback)` returns the CMS value when
  // present and non-blank, else the in-code default — so a blank/missing row
  // never renders an empty label/placeholder (trap 2).
  const [cmsLead, setCmsLead] = useState<Record<string, string>>({});
  const lt = (key: string, fallback: string) => cmsLead[key] ?? fallback;
  useEffect(() => {
    if (!open || mode !== "lead") return;
    let cancelled = false;
    void fetchCmsTextMap(LEAD_CMS_KEYS as unknown as string[], isHe ? "he" : "en").then(
      (m) => { if (!cancelled) setCmsLead(m); },
    );
    return () => { cancelled = true; };
  }, [open, mode, isHe]);

  // ── Single-plan paywall extras (2026-05-06 Itzik redesign) ──────────────
  // Greeting: shows "שלום {full_name}" once the user is authenticated. We
  // fetch the name from auth.users.user_metadata.full_name (the same key
  // RegistrationModal saves) the first time the paywall opens.
  const [userFullName, setUserFullName] = useState<string | null>(null);
  // Country picker state removed 2026-06-02 (Itzik). countryCode is
  // hardcoded to "IL" in the parent state declaration above.

  // Reset transient state whenever the modal is re-opened.
  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  // Fetch the authenticated user's full name when entering paywall mode.
  // We read auth.users.user_metadata.full_name - RegistrationModal +
  // SubscriptionModal's lead flow both save the name there at signup. If
  // the user reached the paywall some other way (no full_name in metadata),
  // we fall back to paywallGreetingFallback ("שלום").
  useEffect(() => {
    if (mode !== "paywall") return;
    if (!open) return;
    if (userFullName) return;
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = (user?.user_metadata ?? {}) as { full_name?: string };
      const fromMeta = meta.full_name?.trim() ?? "";
      if (fromMeta) setUserFullName(fromMeta);
    })();
    return () => { cancelled = true; };
  }, [mode, open, userFullName]);

  // IP geolookup removed — IL-only launch. The server-side checkout
  // route (lib/geo-from-request.ts) still uses the request IP as the
  // authoritative source for billing geo; the modal no longer asks.

  const PRICES = isHe ? PRICES_ILS : PRICES_USD;

  // Auto-detect country useEffect removed 2026-06-02 — IL is hardcoded.
  // setCountryCode / setCountryName are no longer called, so the
  // setters are kept only because TS destructured them from useState.

  const vatRatePercent = countryCode === "IL" ? 18 : 0;

  const leadFormValid =
    fullName.trim().length >= 2 &&
    mobile.trim().length > 0 &&
    email.trim().includes("@") &&
    password.length >= 8 &&
    termsAccepted;

  // ── Upsert lead row ────────────────────────────────────────────────────────
  async function upsertLead(uid: string | null): Promise<string | null> {
    const deviceId = getOrCreateDeviceId();

    // Resolve email: form input (lead mode) → auth user (paywall mode).
    // In paywall mode the `email` state is empty because there's no input
    // field; without this fallback /api/leads/upsert rejects with 400
    // "Invalid email" the first time a logged-in user picks a plan.
    let resolvedEmail = email.trim().toLowerCase();
    if (!resolvedEmail || !resolvedEmail.includes("@")) {
      try {
        const supa = createBrowserSupabaseClient();
        const { data: { user } } = await supa.auth.getUser();
        if (user?.email) resolvedEmail = user.email.trim().toLowerCase();
      } catch { /* ignore */ }
    }

    if (!resolvedEmail || !resolvedEmail.includes("@")) {
      setError(isHe
        ? "לא ניתן לזהות אימייל. התחבר/י מחדש ונסה/י שוב."
        : "Could not resolve your email. Please sign in again and retry.");
      return null;
    }

    const res = await fetch("/api/leads/upsert", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email:             resolvedEmail,
        full_name:         fullName.trim() || null,
        name:              fullName.trim() || null,
        phone:             mobile.trim() || null,
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
    if (!mobile.trim()) { setError(t.phoneRequired); return; }
    if (password.length < 8) { setError(t.weakPassword); return; }
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();

      // Create Supabase account
      // The "mobile" UI field maps to `phone` everywhere downstream (same as
      // RegistrationModal → profiles.phone / leads.phone). This modal never
      // wrote to `profiles`, so we stash phone in auth metadata alongside
      // full_name and also send it to /api/leads/upsert (leads.phone, below).
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email:   email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim(), phone: mobile.trim() } },
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

      // Diagnostic: when /api/billing/checkout/create returns UNAUTHORIZED,
      // we want to know whether the BROWSER even has a live Supabase session
      // at this moment. Logs only an 8-char id prefix and a masked email -
      // never a full identifier or token.
      try {
        const supa = createBrowserSupabaseClient();
        const { data: { user: liveUser }, error: liveErr } = await supa.auth.getUser();
        console.log("[checkout:CLIENT_DEBUG]", {
          prop_userId_present: Boolean(userId),
          prop_userId8: typeof userId === "string" ? userId.slice(0, 8) : null,
          live_user_present: Boolean(liveUser),
          live_user_id8: liveUser?.id?.slice(0, 8) ?? null,
          live_user_email_masked: liveUser?.email
            ? `${liveUser.email.slice(0, 3)}…@${liveUser.email.split("@")[1] ?? ""}`
            : null,
          auth_error: liveErr?.message ?? null,
        });
      } catch (e) {
        console.warn("[checkout:CLIENT_DEBUG] threw", e instanceof Error ? e.message : e);
      }

      // A3: swap to the trial endpoint when a games trial is enabled. The
      // create-trial route reads product/plan/coaching + server geo; the extra
      // advisory fields below are harmless (ignored there).
      const endpoint = trial.enabled
        ? "/api/billing/checkout/create-trial"
        : "/api/billing/checkout/create";
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // This modal is the GAMES paywall (TruthOrDare / Snakes), so it MUST
          // send product:"games". Without it checkout defaulted product to
          // "journey" (see route); since journey weekly is disabled, that
          // resolved to journey monthly (67 ₪) instead of games weekly (9 ₪) —
          // a real mischarge plus the wrong pillar entitlement. coaching is
          // irrelevant for games (the server forces it false for non-journey).
          product:          "games",
          // Games bills MONTHLY (36 ₪). The "9 ₪ / week" shown on the card and
          // in this modal is a display framing only; the real charge cadence is
          // resolved server-side from the plan we send here. (Itzik 2026-07-06,
          // aligning charge to the "billed monthly ₪36" promise.)
          plan:             "monthly",
          coaching:         false,
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
      // Meta InitiateCheckout (browser) — dedupes with the CAPI event via the
      // shared session-derived event_id. Skip the test-user bypass. No-op
      // without the pixel. Never throws.
      if (json.checkout_session_id && !json.test_user_bypass) {
        metaTrack(
          "InitiateCheckout",
          {
            currency: countryCode === "IL" ? "ILS" : "USD",
            content_name: trial.enabled ? "games:trial" : `subscription:${plan}`,
          },
          metaEventId.checkout(json.checkout_session_id as string),
        );
      }
      window.location.href = json.redirect_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isHe ? "שגיאה" : "Error"));
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Confirm stage was removed - clicking a plan jumps straight to Cardcom,
  // so the title/subtitle only need lead vs paywall-select copy.
  const headerTitle = mode === "lead" ? lt("lead_modal_title", t.titleLead) : t.titlePaywallSelect;
  const headerSubtitle = mode === "lead" ? lt("lead_modal_subtitle", t.subtitleLead) : t.subtitlePaywall;

  // Paywall mode is a single-plan checkout - the SinglePlanPaywall
  // subcomponent supplies its own headline (greeting), so we hide the
  // generic DialogHeader for that mode and shrink the dialog to a sane
  // single-column width. Lead mode keeps its existing wider modal layout.
  const isPaywall = mode === "paywall";

  return (
    <Dialog open={open} onOpenChange={(v) => (locked ? null : onOpenChange(v))}>
      <DialogContent
        showCloseButton={false}
        className={`overflow-hidden border-white/10 bg-transparent p-0 text-white shadow-2xl ${
          isPaywall
            ? "sm:max-w-md"
            : "sm:max-w-lg md:max-w-3xl lg:max-w-4xl"
        }`}
      >
        {/* Animated gradient backdrop */}
        <ModalBackdrop palette={palette} />

        {/* Custom close button - logical-end (RTL: visual left, LTR: visual right) */}
        {!locked && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={lt("lead_modal_close_aria", t.close)}
            className="absolute top-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative z-0 max-h-[85vh] overflow-y-auto px-5 pb-6 pt-7 sm:px-7">
          {/* DialogTitle is required by the dialog primitive for a11y but
              hidden visually in paywall mode - the SinglePlanPaywall
              renders its own greeting headline. */}
          {isPaywall ? (
            <DialogTitle className="sr-only">
              {userFullName ? t.paywallGreeting(userFullName) : t.paywallGreetingFallback}
            </DialogTitle>
          ) : (
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
          )}

          {mode === "lead" ? (
            /* ── Lead registration ──────────────────────────────────────── */
            /* Single translucent layer - no inner card chrome. The form sits
             * directly on the modal's one dark-translucent backdrop so the
             * game page behind bleeds through and the colours wash through. */
            <div className="mx-auto mt-5 flex w-full max-w-sm flex-col gap-4">
              <div className="grid gap-1.5">
                <Label className="text-[18px] font-semibold text-white/90 sm:text-sm">{lt("lead_modal_label_name", t.fullNameLabel)}</Label>
                <Input
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={lt("lead_modal_ph_name", t.fullNamePlaceholder)}
                  className="min-h-[52px] border-white/15 bg-white/10 text-[17px] text-white placeholder:text-white/40 focus-visible:ring-white/40 sm:min-h-[50px] sm:text-base"
                />
              </div>

              {/* Mobile — QA 2026-06-17: required for every signup (Itzik). Maps
                  to `phone` in leads.phone + auth metadata (see saveLead). */}
              <div className="grid gap-1.5">
                <Label className="text-[18px] font-semibold text-white/90 sm:text-sm">{lt("lead_modal_label_phone", t.mobileLabel)}</Label>
                <Input
                  type="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={lt("lead_modal_ph_phone", t.mobilePlaceholder)}
                  className="min-h-[52px] border-white/15 bg-white/10 text-[17px] text-white placeholder:text-white/40 focus-visible:ring-white/40 sm:min-h-[50px] sm:text-base"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[18px] font-semibold text-white/90 sm:text-sm">{lt("lead_modal_label_email", t.emailLabel)}</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lt("lead_modal_ph_email", t.emailPlaceholder)}
                  className="min-h-[52px] border-white/15 bg-white/10 text-[17px] text-white placeholder:text-white/40 focus-visible:ring-white/40 sm:min-h-[50px] sm:text-base"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[18px] font-semibold text-white/90 sm:text-sm">{lt("lead_modal_label_password", t.passwordLabel)}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lt("lead_modal_ph_password", t.passwordPlaceholder)}
                    className={`min-h-[52px] border-white/15 bg-white/10 text-[17px] text-white placeholder:text-white/40 focus-visible:ring-white/40 sm:min-h-[50px] sm:text-base ${isHe ? "pl-14" : "pr-14"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={`absolute inset-y-0 flex items-center px-3 text-xs font-semibold text-white/70 hover:text-white ${isHe ? "left-0" : "right-0"}`}
                  >
                    {showPassword ? t.hidePwd : lt("lead_modal_password_show", t.showPwd)}
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
                  {lt("lead_modal_consent_marketing", t.marketingLabel)}
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
                  {/* Trap 1: NO markup in a CMS string — the <a> lives here in
                      JSX; only the link TEXT is a separate CMS key. The explicit
                      space guarantees separation regardless of the CMS value. */}
                  {lt("lead_modal_consent_terms_pre", t.termsLabel)}{" "}
                  <a
                    href={isHe ? "/he/terms" : "/en/terms"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: accent }}
                  >
                    {lt("lead_modal_consent_terms_link", t.termsLink)}
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
                {busy ? t.saving : lt("lead_modal_submit", t.saveCta)}
              </Button>

              {/* Already-a-member shortcut - takes the user to the sign-in flow */}
              <p className="text-center text-xs text-white/70">
                {lt("lead_modal_have_account", t.alreadyMember)}{" "}
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
                  {lt("lead_modal_login_link", t.signInCta)}
                </button>
              </p>
            </div>
          ) : (
            /* ── Paywall: single-plan checkout (2026-05-06 Itzik redesign)
             *   • Greeting: "שלום {full_name}" so the user knows we
             *     remember them.
             *   • One price: 9₪/week (single weekly plan).
             *   • Country combobox with search, IP-detected country
             *     pinned to the top.
             *   • One CTA → Cardcom. After success, /billing/success
             *     polls and routes the user back to play.
             */
            <SinglePlanPaywall
              error={error}
              busy={busy}
              currency={currency}
              price={PRICES.weekly}
              palette={palette}
              accent={accent}
              t={t}
              locale={locale}
              userFullName={userFullName}
              onPay={() => void startPayment("weekly")}
              trialEnabled={trial.enabled}
              trialCtaLabel={trial.ctaLabel}
              trialDisclosure={trial.disclosure}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── SinglePlanPaywall (2026-05-06 Itzik) ─────────────────────────────────
//
// One-plan checkout: greeting + 9₪/week price + searchable country picker +
// single CTA → Cardcom. Replaces the prior 3-plan PlanCardButton grid.
//
// The component receives state from the parent so the parent stays the
// single owner of `countryCode` (still consumed by `startPayment` /
// `upsertLead` exactly as before).
function SinglePlanPaywall({
  error,
  busy,
  currency,
  price,
  palette,
  accent,
  t,
  locale,
  userFullName,
  onPay,
  trialEnabled = false,
  trialCtaLabel,
  trialDisclosure,
}: {
  error: string | null;
  busy: boolean;
  currency: string;
  price: string;
  palette: [string, string, string];
  accent: string;
  // Loose typing - the modal owns the canonical translations object and
  // we only read a known subset here. Avoids a separate exported type.
  t: {
    paywallGreeting: (name: string) => string;
    paywallGreetingFallback: string;
    paywallSinglePlanSubtitle: string;
    paywallPriceSuffix: string;
    paywallBilledNote: string;
    paywallCancelNote: string;
    paywallContinueCta: string;
    saving: string;
  };
  locale: "he" | "en";
  userFullName: string | null;
  onPay: () => void;
  // A3: trial offer (games). When enabled the CTA + disclosure swap.
  trialEnabled?: boolean;
  trialCtaLabel?: string;
  trialDisclosure?: string | null;
}) {
  const isHe = locale === "he";
  const greeting = userFullName
    ? t.paywallGreeting(userFullName)
    : t.paywallGreetingFallback;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 pt-2 sm:pt-3">
      {error && (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 ring-1 ring-rose-400/40">
          {error}
        </p>
      )}

      {/* ── Hero greeting - centred, this IS the title for paywall mode ── */}
      <header className="flex flex-col items-center gap-2.5 text-center">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}
          aria-hidden
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <h3 className="font-heading text-2xl font-extrabold leading-tight text-white sm:text-[28px]">
          {greeting}
        </h3>
        {/* Itzik 2026-06-02: subtitle bumped — white + larger so it
            reads as part of the pitch, not muted micro-copy. */}
        <p className="max-w-[34ch] text-[17px] leading-[1.4] font-semibold text-white">
          {t.paywallSinglePlanSubtitle}
        </p>
      </header>

      {/* ── Price hero - single bold price card ──────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] px-6 py-6 text-center"
        style={{
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 60px -28px ${accent}aa`,
        }}
      >
        {/* glow halo behind the price */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-12 top-0 h-24 rounded-full opacity-50 blur-3xl"
          style={{ background: accent }}
        />
        <div className="relative flex items-baseline justify-center gap-1">
          {/* Itzik 2026-06-02: currency symbol shrunk to match the
              suffix size so the eye lands on the number. */}
          <span className="text-base font-semibold text-white/70">
            {currency}
          </span>
          <span className="text-6xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {price}
          </span>
          <span className="text-base font-semibold text-white/70">
            {t.paywallPriceSuffix}
          </span>
        </div>
        {/* C2.4: subtle transparency line — display stays weekly, actual
            charge is monthly. */}
        <p className="relative mt-1 text-xs text-white/55">{t.paywallBilledNote}</p>
        <p className="relative mt-2 text-sm text-white/70">{t.paywallCancelNote}</p>
      </div>

      {/* Country picker removed 2026-06-02 (Itzik): IL-only launch.
          Country is hardcoded to IL in the parent so VAT + checkout
          payloads continue to flow correctly. */}

      {/* CTA */}
      <Button
        className="min-h-[54px] w-full rounded-full text-base font-extrabold text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] transition hover:brightness-110 disabled:opacity-50"
        disabled={busy}
        onClick={onPay}
        style={{
          background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
        }}
      >
        {busy
          ? t.saving
          : trialEnabled && trialCtaLabel
            ? trialCtaLabel
            : t.paywallContinueCta}
      </Button>

      {/* A3: trial disclosure — "after 7 days you'll be charged ₪X · cancel" */}
      {trialEnabled && trialDisclosure ? (
        <p className="-mt-1 text-center text-xs text-white/70">{trialDisclosure}</p>
      ) : null}

      {/* Trust line - secure-payment / Cardcom / SSL hint. Kept as plain
          text (no icons/logos) to avoid leaking vendor names into the UI;
          the user can read the full terms before paying. */}
      <p className="-mt-1 text-center text-xs text-white/55">
        {isHe
          ? "תשלום מאובטח · ביטול בקליק אחד מהחשבון שלכם"
          : "Secure payment · Cancel from your account in one click"}
      </p>
    </div>
  );
}

// CountryRow component removed 2026-06-02 along with the country
// picker. Restore from git history if/when we re-introduce
// multi-market support.
