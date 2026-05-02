// ============================================================
// Hint catalog — Hebrew clinical-tone explanations for the
// non-obvious admin fields/buttons identified in the expert
// onboarding spec §1.5 (top-20 list).
//
// Hebrew is canonical. EN body is optional; included only where the
// term is borrowed from English (e.g. "audience", "anchor") and a
// short EN gloss helps the reader connect dashboard label ↔ explanation.
//
// Adding a hint = one entry below + one <HintIcon topic="..." />
// next to the relevant field. Stable IDs follow `<surface>.<field>`.
// ============================================================

export interface HintEntry {
  titleHe: string;
  bodyHe: string;
  /** Optional English gloss for borrowed terms. */
  titleEn?: string;
  bodyEn?: string;
}

export const HINT_CATALOG = {
  // ─── Sidebar ───────────────────────────────────────────────
  // (sidebar tooltips landed in PR1 as native `title` attributes;
  // included here for completeness if a future PR moves them to
  // HintIcon-style popovers)

  // ─── Journey hub ───────────────────────────────────────────
  "journey.hub_intro": {
    titleHe: "מה זה הליווי של מיאושי",
    bodyHe:
      "מסלול תוכן אישי לזוגות. כל לקוח מקבל פריט אחד בשבוע (כברירת מחדל) שמתאים לדירוג העדיפויות שלו. מומחה יכול לדחוף פריטים מסוימים, לתת תגובה אישית בכל פריט, ולנהל קבוצות (קוהורטות) של זוגות שעובדים על אותו תחום.",
  },

  // ─── ItemForm fields ───────────────────────────────────────
  "item.kind": {
    titleHe: "סוג הפריט",
    bodyHe:
      "תוכן (Content) — מאמר, תרגיל או הוראה לזוג. זה ברירת המחדל.\nשאלון מובנה (Assessment) — שאלות עם תשובות מובנות שאפשר לראות בדוחות.\nשאלת שטח פתוחה (Reflection) — תיבה אחת לכתיבה חופשית. בחרו לפי הציפייה שיש לכם מהזוג.",
    titleEn: "Item kind",
    bodyEn: "content / assessment / reflection — drives which form the user fills in.",
  },
  "item.subtopic_id": {
    titleHe: "תת-נושא",
    bodyHe:
      "תת-נושאים מאפשרים לחלק קטגוריה גדולה לאשכולות (לדוגמה: בקטגוריית 'מיניות ואינטימיות' אפשר לפתוח תת-נושא 'BDSM-curious'). פריט יכול לחיות ישירות בתוך הקטגוריה (ללא תת-נושא) או בתוך תת-נושא ספציפי. תת-נושאים חיוניים בעיקר לקבוצות (Groups) — שם אפשר לקשר תת-נושא לקבוצה במצב 'replace' או 'interleave'.",
  },
  "item.default_offset_days": {
    titleHe: "ימים מתחילת המסלול",
    bodyHe:
      "מספר הימים שעוברים מתחילת המסלול של הלקוח (anchor day) ועד שהפריט הזה נפתח אצלו. ערך 0 = הפריט נפתח כבר ביום הראשון. במנוע ה-cadence הרגיל המספר הזה לא קובע (המנוע פותח פריט אחד בשבוע) — הוא רלוונטי בעיקר להקצאות (Assignments) של תוכניות (Programs) שלמות עם לוח זמנים מובנה.",
  },
  "item.audience": {
    titleHe: "מי רואה את הפריט בתוך הזוג",
    bodyHe:
      "Both — שני בני הזוג רואים את הפריט. זה ברירת המחדל ומה שכמעט תמיד צריך.\nOwner / Partner — רק אחד מבני הזוג רואה. שמור לפריטים שמיועדים לבן הזוג שיזם (owner) או לבן הזוג השני (partner) בלבד. בזוגות עם מנוי בודד (סולו) הערך מתעלם לחלוטין.",
    titleEn: "Audience (per-couple visibility)",
    bodyEn: "both / owner / partner. Solo timelines see everything.",
  },

  // ─── CategoryForm fields ───────────────────────────────────
  "category.program_id": {
    titleHe: "תוכנית הורית (אופציונלי)",
    bodyHe:
      "תוכניות (Programs) הן אופציונליות — הן עוזרות לקבץ קטגוריות תחת מסלול אחד עם anchor משותף ('איפוס אינטימיות 6 שבועות'). אם אין לכם תוכניות, זה לא בעיה — בחרו 'Standalone (no program)' וזה הברירת מחדל הנפוצה. רוב הקטגוריות במיאושי הן עצמאיות.",
  },
  "category.assessment_priority_key": {
    titleHe: "מפתח עדיפות באבחון",
    bodyHe:
      "אם הקטגוריה הזו היא אחת מחמש קטגוריות הליבה שמופיעות בדירוג סוף-האבחון של הלקוח (תקשורת, מיניות, אהבה, חברות, משפחה) — שמרו את ה-key כאן (לדוגמה 'communication'). זה מקשר את הקטגוריה למה שהלקוח דירג. עבור כל קטגוריה אחרת — השאירו ריק.",
  },

  // ─── GroupSubtopicBinder ───────────────────────────────────
  "group.binding_replace_vs_interleave": {
    titleHe: "מצבי קישור: replace מול interleave",
    bodyHe:
      "Replace — מנוע ה-cadence מתעלם לחלוטין מתת-הנושא הזה לחברי הקבוצה. רק פריטים שדוחפים ידנית (Push) יגיעו אליהם מהתת-נושא הזה. שימוש: כשרוצים שליטה אדמיניסטרטיבית מלאה.\nInterleave — מנוע ה-cadence ממשיך לבחור בתת-הנושא הזה כרגיל, ובנוסף Push יכול להוסיף פריטים מעליו. שימוש: כשרוצים להעשיר זרם רגיל בלי לבטל אותו.\nאם משתמש בקבוצה אחת ב-replace ובאחרת ב-interleave לאותו תת-נושא: replace מנצח.",
    titleEn: "Replace vs Interleave",
    bodyEn:
      "replace = cadence ignores this subtopic for members. interleave = cadence picks normally; admin pushes are additive.",
  },

  // ─── AssignmentForm fields ─────────────────────────────────
  "assignment.anchor_kind": {
    titleHe: "נקודת ההתחלה (anchor)",
    bodyHe:
      "Anchor הוא יום-האפס של מסלול הזמנים. Default offset days של כל פריט נספר ממנו.\nAssignment — מתחיל מהיום שיצרתם את ההקצאה (הנפוץ).\nPurchase — מתחיל מתאריך הרכישה של המנוי (לאוטומציה ש-Cardcom מפעיל).\nFixed — תאריך ספציפי שאתם בוחרים (קמפיינים, התחלה משותפת לקבוצה).",
    titleEn: "Anchor",
    bodyEn: "Day-zero of the timeline; item offset days are counted from here.",
  },
  "assignment.origin": {
    titleHe: "מקור ההקצאה (לדוחות)",
    bodyHe:
      "תיוג שעוזר להבחין בדוחות בין הקצאות שנעשו ידנית (admin_manual), הקצאות שנוצרו אוטומטית מרכישה (purchase), והקצאות שנוצרו על-ידי טריגר אחר (trigger). ברוב המקרים תשאירו את הברירת מחדל — admin_manual — והערך הזה לא משפיע על אופן ההצגה ללקוח.",
  },
  "assignment.preview_materialization": {
    titleHe: "תצוגה מקדימה",
    bodyHe:
      "כפתור שמראה לכם, לפני שאתם שומרים, כמה פריטים בדיוק יכנסו ללוח הזמנים של הלקוח כתוצאה מההקצאה הזו, ובאילו תאריכים. שימושי במיוחד כשאתם מקצים תוכנית שלמה (Program) ורוצים לוודא שהיקף ההקצאה הגיוני.",
  },
  "assignment.create_and_materialize": {
    titleHe: "יצירת ההקצאה",
    bodyHe:
      "לחיצה על הכפתור הזה יוצרת את ההקצאה ובאותו רגע גם פותחת את כל הפריטים בלוח הזמנים של הלקוח לפי ה-default_offset_days שלהם. אחרי לחיצה יופיעו אצל הלקוח הפריטים העתידיים (נעולים) והפריט הראשון יהיה זמין מיד אם ה-offset שלו הוא 0.",
  },

  // ─── PushComposer fields ───────────────────────────────────
  "push.delivery_slot_explanation": {
    titleHe: "מתי הלקוח יקבל את מה שדחפתם",
    bodyHe:
      "Push לא מגיע מיד. הוא נכנס לתור של הלקוח, ובאחת מההתראות הבאות (ברירת מחדל: יום שני 09:00 לפי שעון UTC) המנוע פותח לו את הפריט. אם דחפתם 3 פריטים — הם יכנסו לתור ויפתחו אחד-אחד בכל מועד פתיחה הבא של הלקוח (3 שבועות, אם הקצב שלו 1 בשבוע). זה לא באג, זה מעצב — הלקוח מקבל זרם קבוע, לא הצפה.",
  },
  "push.recipient_kind": {
    titleHe: "מקבל ה-Push",
    bodyHe:
      "User — לקוח אחד. אם הוא בזוג, רק הוא יקבל.\nCouple — שני בני הזוג מקבלים את אותו פריט (כל אחד בלוח הזמנים שלו).\nGroup — כל חברי הקבוצה מקבלים. אם הקבוצה מקושרת ל-replace mode בתת-נושא של הפריט, זו הדרך היחידה שהפריט יגיע אליהם.",
  },

  // ─── Health page ───────────────────────────────────────────
  "health.cron_stale_threshold": {
    titleHe: "מתי עבודת רקע מוגדרת 'תקועה' (Stale)",
    bodyHe:
      "כל עבודת רקע (cron) רצה במרווח קבוע — לדוגמה כל 15 דקות. אם הריצה האחרונה הייתה לפני יותר מ-1.5× המרווח הצפוי (כלומר: 22.5 דקות לעבודה של 15-דקתית), המערכת מסמנת אותה כ-Stale. זה אות לבדיקה — לרוב זה אומר שהפריסה האחרונה לא עלתה כצפוי, או שהפלטפורמה השעתה משהו.",
  },
  "health.sum_rows_24h": {
    titleHe: "סך הפעולות ב-24 שעות",
    bodyHe:
      "סכום השורות שהעבודות עיבדו ביממה האחרונה. לדוגמה, ב-cadence_advance זה מספר הפריטים שנפתחו ללקוחות; ב-notify_unlocks זה מספר האימיילים שנשלחו. אם המספר נמוך באופן בלתי צפוי, זה רמז שמשהו עוצר את העיבוד — אין מועמדים, אין מקבלים, או שיש שגיאה.",
  },

  // ─── General-channel admin reply (PR2 new surface) ─────────
  "channel.admin_reply": {
    titleHe: "תגובה לערוץ הפרטי של הלקוח",
    bodyHe:
      "כל לקוח יש לו ערוץ פרטי אישי לתקשורת עם המומחים — נפרד מתגובות בפריטים ספציפיים. בערוץ הזה הלקוח שואל שאלות כלליות, מבקש עזרה, או משתף משהו שלא קשור לפריט מסוים. בן/בת הזוג לא רואים את הערוץ הזה. כל מומחה במשמרת יכול להגיב.",
  },
  "channel.privacy_isolation": {
    titleHe: "פרטיות הערוץ הכללי",
    bodyHe:
      "הערוץ הכללי הוא תמיד פרטי — בן/בת הזוג של הלקוח לא רואים מה הוא שולח לכם, ולא רואים את התגובות שלכם. בזוג: יש שני ערוצים נפרדים, אחד לכל בן/בת זוג. אל תכתבו תוכן שמיועד לזוג כולו פה — לזה יש את התגובות בפריטים (Per-item).",
  },
} as const satisfies Record<string, HintEntry>;

export type HintTopic = keyof typeof HINT_CATALOG;

export function getHint(topic: HintTopic): HintEntry | undefined {
  return HINT_CATALOG[topic];
}
