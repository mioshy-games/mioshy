/**
 * Quick-assessment offer — shared client helpers (Itzik 2026-06-18).
 *
 * Copy lives in the CRM (cms_texts, category "marketing", public-readable) so
 * it's editable without a deploy; we read it directly client-side and fall back
 * to the seeded defaults below only if a row is missing/blank. Eligibility and
 * suppression rules keep the offer from ever spamming.
 */

import posthog from "posthog-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getOrCreateDeviceId } from "@/lib/device-id";

export type OfferTrigger = "ingame" | "login" | "return24h" | "browse2min" | "exitintent";

/** PostHog `trigger` property name per offer trigger (for conversion-per-trigger). */
export const PH_TRIGGER: Record<OfferTrigger, string> = {
  ingame: "ingame_spin6",
  login: "after_login",
  return24h: "return_24h",
  browse2min: "browse_2min",
  exitintent: "exit_intent",
};
export type OfferTexts = { title: string; body: string; cta: string; dismiss: string };

/** Seeded in migration 134 too — kept here as the last-resort safety net. */
const DEFAULTS: Record<"he" | "en", Record<OfferTrigger, OfferTexts>> = {
  he: {
    ingame: {
      title: "סקרנים לדעת מה באמת קורה ביניכם?",
      body: "11 שאלות קצרות, ואתם מקבלים תמונה אישית של הזוגיות שלכם - ולאן היא יכולה להמשיך.",
      cta: "קחו את האבחון",
      dismiss: "אחר כך",
    },
    login: {
      title: "טוב לראות אתכם שוב",
      body: "פחות משלוש דקות, ואתם יודעים איפה הזוגיות שלכם עומדת היום - עם המלצות אישיות שלכם בלבד.",
      cta: "מתחילים באבחון",
      dismiss: "בפעם אחרת",
    },
    return24h: {
      title: "חזרתם - בואו נעמיק קצת",
      body: "האבחון המהיר מחכה לכם: 11 שאלות, והכיוון לזוגיות טובה יותר נפתח.",
      cta: "לאבחון",
      dismiss: "לא עכשיו",
    },
    browse2min: {
      title: "כבר כמה דקות איתנו 💜",
      body: "רוצים לדעת איפה הזוגיות שלכם עומדת? 11 שאלות קצרות, ותמונה אישית שלכם.",
      cta: "קחו את האבחון",
      dismiss: "אחר כך",
    },
    exitintent: {
      title: "רגע לפני שאתם הולכים",
      body: "לפני שתצאו - 11 שאלות קצרות שיראו לכם לאן הזוגיות שלכם יכולה להמשיך.",
      cta: "כן, קחו אותי לאבחון",
      dismiss: "המשיכו ליציאה",
    },
  },
  en: {
    ingame: {
      title: "Curious what's really going on between you?",
      body: "11 short questions and you get a personal picture of your relationship - and where it can go next.",
      cta: "Take the assessment",
      dismiss: "Later",
    },
    login: {
      title: "Good to see you again",
      body: "Under three minutes and you'll know where your relationship stands today - with recommendations just for you.",
      cta: "Start the assessment",
      dismiss: "Another time",
    },
    return24h: {
      title: "You're back - let's go a little deeper",
      body: "The quick assessment is waiting: 11 questions, and the path to a better relationship opens up.",
      cta: "To the assessment",
      dismiss: "Not now",
    },
    browse2min: {
      title: "A few minutes in 💜",
      body: "Want to know where your relationship stands? 11 short questions and a personal snapshot.",
      cta: "Take the assessment",
      dismiss: "Later",
    },
    exitintent: {
      title: "One moment before you go",
      body: "Before you leave - 11 short questions to show where your relationship can go next.",
      cta: "Yes, take me to the assessment",
      dismiss: "Continue to exit",
    },
  },
};

const FIELDS = ["title", "body", "cta", "dismiss"] as const;

/** Read the CRM copy for one trigger, falling back per-field to the defaults. */
export async function fetchOfferTexts(
  locale: "he" | "en",
  trigger: OfferTrigger,
): Promise<OfferTexts> {
  const fallback = DEFAULTS[locale][trigger];
  try {
    const supabase = createBrowserSupabaseClient();
    const keys = FIELDS.map((f) => `assessment_offer_${trigger}_${f}`);
    const { data } = await supabase
      .from("cms_texts")
      .select("key, he_text, en_text")
      .in("key", keys);
    const rows = (data ?? []) as { key: string; he_text: string | null; en_text: string | null }[];
    const byKey = new Map(rows.map((r) => [r.key, locale === "he" ? r.he_text : r.en_text]));
    const pick = (f: (typeof FIELDS)[number]) => {
      const v = byKey.get(`assessment_offer_${trigger}_${f}`)?.trim();
      return v && v.length > 0 ? v : fallback[f];
    };
    return { title: pick("title"), body: pick("body"), cta: pick("cta"), dismiss: pick("dismiss") };
  } catch {
    return fallback;
  }
}

export type OfferEligibility = {
  loggedIn: boolean;
  assessmentDone: boolean;
  journeyEntitled: boolean;
};

/** Suppress the offer entirely when the user already completed the assessment
 *  or already owns the journey product. */
export async function fetchEligibility(): Promise<OfferEligibility> {
  try {
    const res = await fetch("/api/marketing/offer-eligibility", {
      headers: { "x-device-id": getOrCreateDeviceId() },
    });
    if (!res.ok) return { loggedIn: false, assessmentDone: false, journeyEntitled: false };
    return (await res.json()) as OfferEligibility;
  } catch {
    return { loggedIn: false, assessmentDone: false, journeyEntitled: false };
  }
}

export function shouldSuppress(e: OfferEligibility): boolean {
  return e.assessmentDone || e.journeyEntitled;
}

// ── Frequency control (max once per session; survives the whole session) ─────
const SHOWN_KEY = "mioshy_assessment_offer_shown_v1";

export function wasOfferShownThisSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SHOWN_KEY) === "1";
}

export function markOfferShown(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    /* ignore quota/availability */
  }
}

// ── Return-after-24h detection (last-visit timestamp) ────────────────────────
const LAST_VISIT_KEY = "mioshy_last_visit_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** True if the previous visit was recorded more than 24h ago. */
export function isReturnAfter24h(): boolean {
  if (typeof localStorage === "undefined") return false;
  const prev = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
  return prev > 0 && Date.now() - prev > DAY_MS;
}

/** Stamp the current visit. Call once per load AFTER reading isReturnAfter24h. */
export function touchLastVisit(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// ── Context exclusion (central, not scattered) ───────────────────────────────
// The 2-min-browse trigger must never fire on the adults/sex surfaces.
export const ADULTS_OFFER_BLOCKED_PATHS = ["/mioshy-sex", "/sex-game"] as const;

export function isAdultsPath(pathname: string): boolean {
  return ADULTS_OFFER_BLOCKED_PATHS.some((p) => pathname.includes(p));
}

// ── Priority when more than one trigger is eligible at the same moment ───────
// (the shared once-per-session flag means first-to-claim wins; this documents +
// orders the simultaneous case). Highest first.
export const TRIGGER_PRIORITY: OfferTrigger[] = [
  "exitintent",
  "login",
  "return24h",
  "ingame",
  "browse2min",
];

// ── PostHog measurement (existing EU integration via /ingest; identify=user) ─
export type OfferEventKind = "shown" | "dismissed" | "clicked";

/** Fire one of the three offer events with { trigger, page, locale }. No-op if
 *  PostHog isn't initialised (dev / pre-consent) — never throws. */
export function captureOfferEvent(
  kind: OfferEventKind,
  trigger: OfferTrigger,
  locale: "he" | "en",
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(`assessment_offer_${kind}`, {
      trigger: PH_TRIGGER[trigger],
      page: window.location.pathname,
      locale,
    });
  } catch {
    /* posthog not initialised → no-op */
  }
}
