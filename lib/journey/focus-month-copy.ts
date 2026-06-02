/**
 * lib/journey/focus-month-copy.ts
 *
 * Per-priority "Focus for the first month" copy shown on the analysis
 * summary screen. Each entry reframes the user's #1 priority pick into:
 *   1. A reflection ("you chose X as your top priority")
 *   2. A validation ("not by chance - your scores show why")
 *   3. A concrete first-month plan ("4 practical tools that change…")
 *   4. A close that frames doing → results, not theory
 *
 * Tone: professional + urgency-results (per Itzik 2026-05-05). Bilingual.
 *
 * Each priority maps 1:1 to a `PriorityKey` literal. Adding a sixth
 * priority means adding the new slug to PriorityKey AND adding an entry
 * here - TypeScript will fail the build if the table is incomplete.
 */

import type { PriorityKey } from "./priorities";
import type { Locale } from "./types";

export interface FocusMonthCopy {
  /** Short reflection - "You chose X. Not by chance." */
  reflection: string;
  /** Concrete what-the-first-month-looks-like sentence. */
  plan: string;
  /** Close - "this isn't theory, it's first-week-already-different." */
  close: string;
}

const COPY: Record<Locale, Record<PriorityKey, FocusMonthCopy>> = {
  he: {
    communication: {
      reflection:
        "בחרתם בתקשורת כעדיפות הראשונה. זאת לא במקרה הבחירה שלכם - אנחנו רואים בניתוח שלכם בדיוק מה צריך לתקן.",
      plan: "בשבועות הקרובים תקבלו גישה לכלים ייחודיים שיעשו מהפך בתקשורת ביניכם, עם מומחה שילווה אתכם ויענה על שאלות בזמן אמת.",
      close:
        "השינוי שיורגש כבר בחודש הראשון - התקשורת תתעצם והקרבה תגדל.",
    },
    intimacy: {
      reflection:
        "בחרתם באינטימיות כעדיפות הראשונה. הניתוח שלכם תומך בכך - וזה אומר שאתם מודעים בדיוק לאן צריך להתמקד.",
      plan: "בשבועות הקרובים תקבלו גישה לכלים ייחודיים שיעשו מהפך באינטימיות ביניכם, עם מומחה שילווה אתכם ויענה על שאלות בזמן אמת.",
      close:
        "השינוי שיורגש כבר בחודש הראשון - האינטימיות תגדל והחברות תצמח.",
    },
    emotional_connection: {
      reflection:
        "בחרתם בקשר רגשי כעדיפות הראשונה. זאת בחירה חכמה - היא הבסיס לכל מה שיבוא אחר כך בזוגיות שלכם.",
      plan: "בשבועות הקרובים תקבלו גישה לכלים ייחודיים שיחזקו את החיבור הרגשי ביניכם, עם מומחה שילווה אתכם ויענה על שאלות בזמן אמת.",
      close:
        "השינוי שיורגש כבר בחודש הראשון - החיבור הרגשי יתעצם והאמון יתעמק.",
    },
    friendship: {
      reflection:
        "בחרתם בחברות זוגית כעדיפות הראשונה. זאת בחירה מבוססת - הניתוח שלכם מראה שכאן נמצא המנוף שיניע את כל השאר.",
      plan: "בשבועות הקרובים תקבלו גישה לכלים ייחודיים שיעשו מהפך בחברות הזוגית שלכם, עם מומחה שילווה אתכם ויענה על שאלות בזמן אמת.",
      close:
        "השינוי שיורגש כבר בחודש הראשון - החברות תצמח והכיף יחזור.",
    },
    family: {
      reflection:
        "בחרתם במשפחה כעדיפות הראשונה. זאת לא במקרה - הניתוח שלכם מראה שזה התחום שבו תרגישו הכי מהר את ההשפעה.",
      plan: "בשבועות הקרובים תקבלו גישה לכלים ייחודיים שישנו את הדינמיקה המשפחתית, עם מומחה שילווה אתכם ויענה על שאלות בזמן אמת.",
      close:
        "השינוי שיורגש כבר בחודש הראשון - הדינמיקה תשתפר והזמן הזוגי יחזור.",
    },
  },
  en: {
    communication: {
      reflection:
        "You chose communication as your top priority. That's not by chance - your analysis shows exactly what needs fixing.",
      plan: "In the coming weeks you'll get access to unique tools that will transform your communication, with an expert who'll guide you and answer questions in real time.",
      close: "Change you'll feel within the first month - communication will strengthen and closeness will grow.",
    },
    intimacy: {
      reflection:
        "You chose intimacy as your top priority. Your analysis backs this - meaning you're aware exactly where to focus.",
      plan: "In the coming weeks you'll get access to unique tools that will transform your intimacy, with an expert who'll guide you and answer questions in real time.",
      close: "Change you'll feel within the first month - intimacy will grow and friendship will bloom.",
    },
    emotional_connection: {
      reflection:
        "You chose emotional connection as your top priority. That's a smart choice - it's the foundation for everything else in your relationship.",
      plan: "In the coming weeks you'll get access to unique tools that will strengthen your emotional connection, with an expert who'll guide you and answer questions in real time.",
      close: "Change you'll feel within the first month - emotional connection will deepen and trust will grow.",
    },
    friendship: {
      reflection:
        "You chose friendship as your top priority. A grounded choice - your analysis shows this is the lever that moves everything else.",
      plan: "In the coming weeks you'll get access to unique tools that will transform your couple friendship, with an expert who'll guide you and answer questions in real time.",
      close: "Change you'll feel within the first month - friendship will bloom and fun will return.",
    },
    family: {
      reflection:
        "You chose family as your top priority. Not by chance - your analysis shows this is the area where you'll feel impact fastest.",
      plan: "In the coming weeks you'll get access to unique tools that will shift your family dynamic, with an expert who'll guide you and answer questions in real time.",
      close: "Change you'll feel within the first month - the dynamic will improve and couple time will return.",
    },
  },
};

export function getFocusMonthCopy(
  priority: PriorityKey | undefined | null,
  locale: Locale,
): FocusMonthCopy | null {
  if (!priority) return null;
  return COPY[locale]?.[priority] ?? null;
}

/**
 * Type guard - narrows a string to PriorityKey. Used at the call site
 * to safely look up copy when `analysis.summary.top_priority` arrives
 * as a plain string.
 */
const KNOWN: ReadonlySet<string> = new Set([
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
]);

export function isPriorityKey(s: string | undefined | null): s is PriorityKey {
  if (!s) return false;
  return KNOWN.has(s);
}
