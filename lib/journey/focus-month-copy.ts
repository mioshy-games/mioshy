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
      plan: "בחודש הקרוב המומחה שלכם יוביל אתכם דרך 4 כלים מעשיים שמשנים איך אתם מדברים אחד עם השנייה.",
      close:
        "זו לא תיאוריה - זה שבוע ראשון, אתם כבר עושים אחרת.",
    },
    intimacy: {
      reflection:
        "בחרתם באינטימיות כעדיפות הראשונה. הניתוח שלכם תומך בכך - וזה אומר שאתם מודעים בדיוק לאן צריך להתמקד.",
      plan: "בחודש הקרוב המומחה שלכם יוביל אתכם דרך תרגילים מעשיים שמחזירים קרבה - בלי להיתקע על שיחות שאינן מובילות לכלום.",
      close:
        "זו לא תיאוריה - תוך שבועיים תרגישו את ההבדל בחיבור ביניכם.",
    },
    emotional_connection: {
      reflection:
        "בחרתם בקשר רגשי כעדיפות הראשונה. זאת בחירה חכמה - היא הבסיס לכל מה שיבוא אחר כך בזוגיות שלכם.",
      plan: "בחודש הקרוב המומחה שלכם ילמד אתכם איך להישמע ולשמוע באמת - דרך כלים שאתם מתחילים ליישם כבר מהשבוע הראשון.",
      close:
        "זו לא תיאוריה - זה תהליך שבונה אמון מחדש, צעד אחר צעד.",
    },
    friendship: {
      reflection:
        "בחרתם בחברות זוגית כעדיפות הראשונה. זאת בחירה מבוססת - הניתוח שלכם מראה שכאן נמצא המנוף שיניע את כל השאר.",
      plan: "בחודש הקרוב תקבלו מהמומחה שלכם תוכנית בנויה לחיזוק החברות בזוגיות - תרגילים יומיים, שיחות מנוהלות, ובניית רגעים משותפים.",
      close:
        "זו לא תיאוריה - אתם כבר השבוע הראשון מתחילים להרגיש כמו שותפים, לא רק כשני אנשים שגרים יחד.",
    },
    family: {
      reflection:
        "בחרתם במשפחה כעדיפות הראשונה. זאת לא במקרה - הניתוח שלכם מראה שזה התחום שבו תרגישו הכי מהר את ההשפעה.",
      plan: "בחודש הקרוב המומחה שלכם יוביל אתכם דרך כלים מעשיים לתיאום בין הוריות, תקשורת עם הילדים, ושמירה על הזמן הזוגי בתוך החיים המשפחתיים.",
      close:
        "זו לא תיאוריה - כבר בשבוע הראשון תראו שינוי בדינמיקה בבית.",
    },
  },
  en: {
    communication: {
      reflection:
        "You chose communication as your top priority. That's not by chance - your analysis shows exactly what needs fixing.",
      plan: "In the coming month your dedicated expert will guide you through 4 practical tools that change how you speak to each other.",
      close: "This isn't theory - it's week one, you're already doing it differently.",
    },
    intimacy: {
      reflection:
        "You chose intimacy as your top priority. Your analysis backs this - meaning you're aware exactly where to focus.",
      plan: "In the coming month your dedicated expert will guide you through practical exercises that restore closeness - without getting stuck in conversations that lead nowhere.",
      close: "This isn't theory - within two weeks you'll feel the difference in your connection.",
    },
    emotional_connection: {
      reflection:
        "You chose emotional connection as your top priority. That's a smart choice - it's the foundation for everything else in your relationship.",
      plan: "In the coming month your dedicated expert will teach you how to truly hear and be heard - through tools you start applying from the first week.",
      close: "This isn't theory - it's a process that rebuilds trust, step by step.",
    },
    friendship: {
      reflection:
        "You chose friendship as your top priority. A grounded choice - your analysis shows this is the lever that moves everything else.",
      plan: "In the coming month you'll get a structured plan from your dedicated expert for strengthening friendship in your relationship - daily exercises, guided conversations, and building shared moments.",
      close: "This isn't theory - by week one you start feeling like partners, not just two people living together.",
    },
    family: {
      reflection:
        "You chose family as your top priority. Not by chance - your analysis shows this is the area where you'll feel impact fastest.",
      plan: "In the coming month your dedicated expert will guide you through practical tools for co-parenting, communication with kids, and protecting your couple time inside family life.",
      close: "This isn't theory - by week one you'll see a change in the dynamic at home.",
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
