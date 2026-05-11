/**
 * /dashboard/coaching-guide
 *
 * Phase 10 — full Hebrew guide for the Mioshy coaching workflow.
 *
 * Single, scrollable, in-product guide that walks the coach through:
 *   1. Setup (one-time)
 *   2. Daily routine
 *   3. Content management — what AI does, what you do
 *   4. Escalation: urgent / drift / SLA
 *   5. Common scenarios + recipes
 *   6. What's still missing (honest gap list)
 *
 * Every step has live CTAs pointing at the actual admin surfaces.
 *
 * Server component — pure render. Renders for admins AND experts so
 * both roles get the same orientation.
 */

import Link from "next/link";
import {
  CircleDot,
  Construction,
  ExternalLink,
} from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";

export const metadata = {
  title: "Mioshy — מדריך למאמן",
};

export default async function CoachingGuidePage() {
  await requireExpert();

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16" dir="rtl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          מדריך למאמן — איך לנהל לקוחות במיאושי
        </h1>
        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
          המדריך הזה לוקח אתכם דרך הזרימה המלאה: מהרגע שמשתמש נרשם לליווי,
          דרך פרישת התוכן, ניהול שיחה, טיפול בהתראות חכמות (AI), ועד טיפול
          במצבי משבר. כל שלב מקושר ישירות למסך שבו תבצעו אותו.
        </p>
      </header>

      {/* ── TOC ───────────────────────────────────────────────── */}
      <nav className="bg-card rounded-lg border p-4">
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
          תוכן עניינים
        </h2>
        <ol className="space-y-1.5 text-sm">
          <TocLink href="#setup" num="1">
            הגדרות חד-פעמיות (15 דקות)
          </TocLink>
          <TocLink href="#daily" num="2">
            השגרה היומית (10-20 דקות בבוקר)
          </TocLink>
          <TocLink href="#content" num="3">
            ניהול תוכן ללקוח — מה ה-AI עושה, מה אתם עושים
          </TocLink>
          <TocLink href="#messaging" num="4">
            תקשורת — תגובות, הודעות, ערוצים
          </TocLink>
          <TocLink href="#escalation" num="5">
            הסלמה — דחוף, drift, SLA
          </TocLink>
          <TocLink href="#scenarios" num="6">
            תרחישים נפוצים — איך לפעול
          </TocLink>
          <TocLink href="#ai" num="7">
            ה-AI שמלווה אתכם
          </TocLink>
          <TocLink href="#missing" num="8">
            מה עוד חסר במערכת (שקיפות מלאה)
          </TocLink>
        </ol>
      </nav>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 1. SETUP                                                 */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="setup" num="1" title="הגדרות חד-פעמיות" eta="15 דקות">
        <p>
          לפני שתתחילו לראות זוגות במערכת, צריך לסיים את ההגדרה האישית. זה
          קורה פעם אחת. אחרי זה — לא חוזרים לכאן אלא אם רוצים לעדכן.
        </p>

        <Step num="1.1" title="הפרופיל המקצועי" href="/dashboard/coach-profile">
          <p>
            הזוגות רואים את השם, התמונה והביו שלכם בכל הודעה שתשלחו. בלי זה,
            ההודעות חתומות &ldquo;מיאושי&rdquo; באופן גנרי וזה פוגע באמון.
          </p>
          <Checks>
            <li>שם תצוגה (שם פרטי + שם משפחה)</li>
            <li>תמונת פרופיל ברורה</li>
            <li>ביו קצר (60-150 מילים) — תוארים, גישה, נקודת מבט</li>
          </Checks>
        </Step>

        <Step num="1.2" title="ספריית תגובות שמורות" href="/dashboard/coach-library">
          <p>
            ספרייה של תגובות / טיפים / הזמנות שאתם משתמשים בהם הרבה. הספרייה
            עובדת על שלוש שכבות: תגובות שמורות (saved_reply), פינים לתוכן
            (content_pin), והערות לזוג (couple_note).
          </p>
          <Checks>
            <li>לפחות 5 תגובות שמורות לפני שמתחילים</li>
            <li>תייגו כל תגובה (תקשורת / מיניות / וכו&apos;) — התגיות עוברות
              אוטומטית להודעה ועוזרות לאדמין לראות מגמות</li>
            <li>אפשר לקלון תבניות מוכנות שיש במערכת — &ldquo;Starter
              templates&rdquo;</li>
          </Checks>
        </Step>

        <Step num="1.3" title="בדיקת חיבור לזוגות שלכם" href="/dashboard/my-clients">
          <p>
            רשימת הזוגות מנוהלת ע&quot;י האדמין דרך קישור{" "}
            <Link className="text-primary hover:underline" href="/dashboard/experts">
              Experts
            </Link>
            . אם אין לכם זוגות, פנו לאיציק.
          </p>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 2. DAILY ROUTINE                                         */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="daily" num="2" title="השגרה היומית" eta="10-20 דקות בבוקר">
        <p>
          בכל בוקר תתחילו ב-
          <Link className="text-primary hover:underline" href="/dashboard">
            דשבורד הראשי
          </Link>{" "}
          ותעברו על הפאנלים לפי סדר. אם הכל ירוק — תוך 5 דקות סיימתם.
        </p>

        <Step num="2.1" title="פאנל &quot;דורש התייחסות&quot;" href="/dashboard/my-clients">
          <Highlight tone="rose">
            <strong>סדר עדיפויות:</strong> דחוף ראשון, אחר כך מדאיג, אחר כך
            הכל אחר.
          </Highlight>
          <p>
            הפאנל הזה נמצא בראש{" "}
            <Link className="text-primary hover:underline" href="/dashboard/my-clients">
              הזוגות שלי
            </Link>{" "}
            ומציג הודעות שה-AI סיווג כדורשות תשומת לב מיידית. כל שורה לחיצה —
            מובילה ישירות למרחב הזוג עם תיבת תגובה פתוחה.
          </p>
          <Checks>
            <li>קוראים את ההודעה כולה לפני שמגיבים</li>
            <li>אם דחוף — מגיבים תוך שעה</li>
            <li>אם מדאיג — תוך 24 שעות</li>
            <li>בשני המקרים: סוגרים את ה-loop בלי להעביר אותו לאחר</li>
          </Checks>
        </Step>

        <Step num="2.2" title="התור היום" href="/dashboard/clinician">
          <p>
            רשימת ההודעות הפתוחות שעדיין לא הגבתם עליהן, מסודרות לפי גיל. כל
            הודעה שנמצאת מעל 48 שעות בלי תגובה — מסומנת כ-SLA breach.
          </p>
          <Checks>
            <li>לעבור על כולם — לא לדלג</li>
            <li>אם תגובה דורשת חשיבה — לסמן את עצמכם בהערה פנימית
              ולחזור</li>
          </Checks>
        </Step>

        <Step num="2.3" title="זוגות ב-drift" href="/dashboard/my-clients">
          <p>
            הפאנל &quot;Couples needing a check-in&quot; מציג זוגות ששקטים
            יותר משמונה ימים. ה-AI לא מודיע להם — אתם מחליטים מתי וכיצד.
          </p>
          <Highlight tone="amber">
            <strong>המלצה:</strong> שלחו הודעה אישית קצרה דרך הערוץ הזוגי, לא
            מכל-זוגות-ב-drift באותו יום. זה מרגיש כמו טפסי-טופס.
          </Highlight>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 3. CONTENT MANAGEMENT                                    */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section
        id="content"
        num="3"
        title="ניהול תוכן ללקוח — מה ה-AI עושה, מה אתם עושים"
        eta="לפי הצורך"
      >
        <Highlight tone="info">
          <strong>הקטלוג שלנו = 250 שיעורים מובנים</strong> מתוך 4 שלבים × 5
          קטגוריות (תקשורת / מיניות / אהבה / חברות / משפחה). כל שיעור =
          תובנה + טעות + מטאפורה + מאמר + תרגיל + מדידה + לעשות/לא + סימן.
          מבוסס על מחקר Gottman, Chapman, Perel ו-130 חוקרים נוספים.
        </Highlight>

        <Step num="3.1" title="ה-AI ממליץ — אתם מאשרים" href="/dashboard/my-clients">
          <p>
            במרחב הזוג ({" "}
            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs">
              /dashboard/my-clients/[couple]
            </code>
            ) יש פאנל &ldquo;המלצות חכמות&rdquo; שמראה 3 פריטים שה-AI
            מציע לדחוף לזוג הזה עכשיו.
          </p>
          <p className="text-muted-foreground text-sm">
            הציון מבוסס על:
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>
              <strong>עדיפות הזוג</strong> — לפי דירוג שעשו באבחון (50/40/30/20/10)
            </li>
            <li>
              <strong>שלב הנוכחי</strong> — מתאים לשלב שהם בו או הבא (20/10/0)
            </li>
            <li>
              <strong>פידבק שלילי</strong> — פריטים עם 3+ פידבק שלילי כללי
              נחבאים אוטומטית (-30 max)
            </li>
          </ul>
          <Highlight tone="info">
            <strong>חשוב:</strong> ה-AI לא דוחף אוטומטית. הוא <em>ממליץ</em>.
            אתם מסתכלים, מחליטים, ומאשרים. זה מכוון.
          </Highlight>
        </Step>

        <Step num="3.2" title="לדחוף פריט מהקטלוג" href="/dashboard/my-clients">
          <p>במרחב הזוג, לוחצים על המלצה → רואים את הפריט במלואו → בוחרים:</p>
          <Checks>
            <li><strong>דחוף עכשיו</strong> — נפתח אצלם מיד</li>
            <li><strong>תזמן ל-תאריך</strong> — בורר תאריך</li>
            <li><strong>ערוך עבור הזוג הזה</strong> (V2 — בקרוב)</li>
            <li><strong>דחה</strong> — לא מתאים, ה-AI ייקח בחשבון</li>
          </Checks>
        </Step>

        <Step num="3.3" title="לערוך פריט בקטלוג" href="/dashboard/journey/items">
          <p>
            אם פריט בקטלוג צריך תיקון (טעות, ניסוח לא טבעי, חסר מידע) —
            לערוך אותו ישירות. השינוי מחל על כל הזוגות שמקבלים אותו מעכשיו.
          </p>
          <Highlight tone="amber">
            עריכה משפיעה על <strong>כל</strong> הזוגות. אם זה תיקון רק לזוג
            ספציפי — לא לערוך פה (V2: יהיה לנו override פר זוג).
          </Highlight>
        </Step>

        <Step num="3.4" title="ליצור פריט חדש (V2)" href="/dashboard/journey/items">
          <p>
            אפשר ליצור פריט חדש בקטלוג. זה הופך אותו לזמין לכל הזוגות
            כהמלצה. תהליך זה דורש זמן — תובנה + מאמר 500 מילה + תרגיל +
            מדידה + לעשות/לא + סימן + מקור.
          </p>
          <Highlight tone="info">
            <strong>כלי עזר:</strong> ב-{" "}
            <Link className="text-primary hover:underline" href="/dashboard/journey/items">
              עמוד הפריטים
            </Link>{" "}
            יש form-builder ויזואלי לאבחונים. למאמרים — עריכה ידנית של 9
            הבלוקים בנפרד.
          </Highlight>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. MESSAGING                                             */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="messaging" num="4" title="תקשורת — שלושה ערוצים">
        <p>
          המערכת תומכת ב-3 משטחי תכתובת — לכל אחד מטרה ופרטיות שונה. חשוב
          להבין מתי להשתמש בכל אחד.
        </p>

        <Step num="4.1" title="פר-פריט (Per-item thread)">
          <p>
            השיחה תחת פריט בודד — תגובה לתרגיל, שאלה על מאמר. <strong>גלוי
            לזוג שניהם</strong>.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong>מתי:</strong> תגובה תוכנית-ספציפית, שאלה על תרגיל.
          </p>
        </Step>

        <Step num="4.2" title="ערוץ אישי (Per-user channel)">
          <p>
            ערוץ פרטי בין כל פרטנר למאמן. <strong>השני לא רואה</strong>.
            רואים אותו ב-
            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs">
              /dashboard/my-clients/[couple]
            </code>{" "}
            תחת &ldquo;General channel&rdquo;.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong>מתי:</strong> הוא רוצה לדבר על משהו אישי / בלי הפרטנר /
            סודי. שאלות מבוכות.
          </p>
        </Step>

        <Step num="4.3" title="ערוץ זוגי (Couple channel)">
          <p>
            חדר משותף לשניהם + מאמן. <strong>שניהם רואים את כל מה שכל אחד
            כותב</strong>. מצוין למסרים שצריכים להישמע אצל שניהם.
          </p>
          <p className="text-muted-foreground text-sm">
            <strong>מתי:</strong> בקשה לשניהם לעשות תרגיל ביחד, הזמנה לשיחה,
            הצעה משותפת.
          </p>
        </Step>

        <Step num="4.4" title="חתימה אוטומטית של המאמן">
          <p>
            כל הודעה שאתם שולחים חתומה בשמכם, בתמונה ובביו (זה מה שמילאתם
            ב-{" "}
            <Link className="text-primary hover:underline" href="/dashboard/coach-profile">
              פרופיל
            </Link>
            ). הזוג רואה אדם — לא &ldquo;מערכת&rdquo;.
          </p>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 5. ESCALATION                                            */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="escalation" num="5" title="הסלמה — איך לטפל במקרים מורכבים">
        <Step num="5.1" title="הודעה דחופה (urgent)">
          <Highlight tone="rose">
            הודעות שמסומנות &ldquo;דחוף&rdquo; ע&quot;י ה-AI כוללות סימני
            משבר רגשי, חרדה אקוטית, או חשד לאלימות. ה-AI לא מחליט עליכם —
            רק מסמן.
          </Highlight>
          <Checks>
            <li>קוראים את כל ההיסטוריה של הזוג לפני שעונים</li>
            <li>תגובה תוך שעה במקסימום</li>
            <li>אם החשש הוא ביטחוני (אלימות, אובדנות) — מצרפים את משאבי
              החירום ומציעים שיחה דחופה</li>
            <li>אחרי שיחה — מוסיפים הערה פנימית ב-couple_note בספרייה</li>
          </Checks>
        </Step>

        <Step num="5.2" title="זוג ב-drift (8+ ימים שקטים)">
          <p>
            ב-{" "}
            <Link className="text-primary hover:underline" href="/dashboard/my-clients">
              הזוגות שלי
            </Link>{" "}
            יש פאנל ייעודי. ה-AI סופר ימים מאז התגובה האחרונה ומסמן.
          </p>
          <Checks>
            <li>
              <strong>8-14 ימים</strong> (drifting) — שלחו הודעה רכה דרך
              הערוץ הזוגי. לא דרישה — שאלה.
            </li>
            <li>
              <strong>15+ ימים</strong> (silent) — צרו קשר טלפוני / WhatsApp
              ישיר. במקביל, רשמו ב-couple_note למה ההפסקה.
            </li>
          </Checks>
        </Step>

        <Step num="5.3" title="חריגה מ-SLA (48 שעות בלי תגובה שלכם)">
          <p>
            המערכת לא מאפשרת לחרוג מבלי שתדעו. הפאנל &ldquo;חרגו מ-SLA&rdquo;
            בדשבורד מציג כמה תורים פתוחים יש לכם.
          </p>
          <Highlight tone="amber">
            <strong>אחריות מקצועית:</strong> אל תתחילו עם זוג חדש לפני
            שסיימתם את הקיים. עדיף לדחות הצטרפות מאשר לאכזב.
          </Highlight>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 6. SCENARIOS                                             */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="scenarios" num="6" title="תרחישים נפוצים — איך לפעול">
        <Step num="6.1" title="זוג חדש מצטרף — היום הראשון">
          <ol className="text-muted-foreground list-decimal space-y-2 pe-5 text-sm leading-relaxed">
            <li>הזוג מקבל אוטומטית פריט יום-1 לפי תוצאות האבחון</li>
            <li>אתם מקבלים נוטיפיקציה ב-{" "}
              <Link className="text-primary hover:underline" href="/dashboard/my-clients">
                הזוגות שלי
              </Link></li>
            <li>פותחים את מרחב הזוג — קוראים את האבחון (5 הקטגוריות + שאלה
              פתוחה)</li>
            <li>שולחים &quot;ברוכים הבאים&quot; אישי דרך הערוץ הזוגי
              — לא תבנית!</li>
            <li>מציינים מתי תהיה הפעם הבאה שתבדקו אצלם (3-7 ימים)</li>
          </ol>
        </Step>

        <Step num="6.2" title="זוג סיים פריט — פידבק חיובי">
          <p>
            הם סימנו &ldquo;עזר&rdquo; ב-feedback bar. ה-AI יחזק עוד פריטים
            דומים בהמלצות. אתם — מגיבים בקצרה (לא ארוך), מאשררים, מציעים את
            הפריט הבא בהקשר.
          </p>
        </Step>

        <Step num="6.3" title="זוג סיים פריט — פידבק שלילי (&quot;לא בשבילנו&quot;)">
          <p>
            תפסיקו רגע. השאלות:
          </p>
          <Checks>
            <li>למה זה לא עבד? (פותחים את היסטוריית התגובות שלהם)</li>
            <li>האם הקטגוריה לא מתאימה לעדיפויות שלהם?</li>
            <li>האם השפה / הניסוח לא קלע אליהם?</li>
          </Checks>
          <p className="text-muted-foreground text-sm">
            אם 3+ פריטים מאותה קטגוריה קיבלו פידבק שלילי — שווה לעבור עם
            הזוג איזו קטגוריה אחרת מתאימה להם יותר.
          </p>
        </Step>

        <Step num="6.4" title="זוג מבקש להפסיק / להשהות">
          <p>
            יש להם כפתור &quot;השהיית מנוי&quot; ב-{" "}
            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs">
              /account
            </code>
            . אם הם פונים אליכם במקום — מציעים השהייה לפני ביטול. השהייה
            שומרת את ההיסטוריה ואת הקטלוג שלהם, ביטול מאבד התקדמות.
          </p>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 7. AI                                                    */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="ai" num="7" title="ה-AI שמלווה אתכם — מה הוא עושה ומה לא">
        <Highlight tone="info">
          המערכת משתמשת ב-Claude Haiku כדי לעזור לכם בעבודה היומיומית.
          ה-AI אף פעם לא פועל באופן אוטונומי על הזוגות — רק מסווג, ממליץ,
          ומסמן. אתם המבוגרים האחראים.
        </Highlight>

        <Step num="7.1" title="סיווג הודעות (Sentiment + Topic)">
          <p>
            כל הודעה שמשתמש שולח עוברת ניתוח אוטומטי שמחזיר:
          </p>
          <Checks>
            <li>
              <strong>סנטימנט:</strong> positive / neutral / concerning / urgent
            </li>
            <li>
              <strong>תגיות נושא:</strong> 1-3 תגיות מ-12 קטגוריות (תקשורת /
              אינטימיות / חברות / וכו&apos;)
            </li>
          </Checks>
          <p className="text-muted-foreground text-sm">
            הסיווג מאפשר את פאנל &ldquo;דורש התייחסות&rdquo; ב-
            <Link className="text-primary hover:underline" href="/dashboard/my-clients">
              הזוגות שלי
            </Link>
            . הוא אינו מצנזר את ההודעה — היא תמיד מגיעה אליכם במלואה.
          </p>
        </Step>

        <Step num="7.2" title="המלצות חכמות פר זוג" href="/dashboard/my-clients">
          <p>
            במרחב הזוג ה-AI מציג 3 פריטים שמתאימים אליהם עכשיו (לפי
            עדיפויות + שלב + פידבק). ה-AI לא רואה תוכן הודעות — רק מטא-נתונים.
          </p>
        </Step>

        <Step num="7.3" title="זיהוי drift">
          <p>
            המערכת רצה cron יומי שבודק תקשורת אחרונה. לא AI במלוא מובן המילה
            — חוקי business simple. אבל קריטי לבטיחות הזוג.
          </p>
        </Step>

        <Step num="7.4" title="מה ה-AI לא יעשה">
          <Checks>
            <li>לא יענה במקומכם להודעה</li>
            <li>לא ידחוף תוכן ללא אישור שלכם</li>
            <li>לא ישנה את התוכן בקטלוג</li>
            <li>לא יתקשר עם הזוג מאחורי הקלעים</li>
          </Checks>
        </Step>

        <Step num="7.5" title="Backfill — סיווג היסטורי" href="/dashboard/journey/metrics">
          <p>
            הודעות שנשלחו לפני שה-AI הוטמע נשארות עם סנטימנט = NULL. אפשר
            להריץ אותן אחורה דרך כפתור &quot;Run classifier on backlog&quot;
            בעמוד המטריקות. עלות: ~$0.10 לכל 500 הודעות.
          </p>
        </Step>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 8. WHAT'S MISSING                                        */}
      {/* ──────────────────────────────────────────────────────── */}
      <Section id="missing" num="8" title="מה עוד חסר במערכת — שקיפות מלאה">
        <Highlight tone="info">
          זה לא תקלה זמנית — זו תוכנית. כל אחד מהפערים הבאים מתועד והוא
          עתיד להגיע. אבל חשוב שתדעו מה <em>אין</em> כדי לפעול נכון בינתיים.
        </Highlight>

        <Gap
          title="עמוד אדמין מרכזי (Cockpit)"
          status="ב-Spec, ממתין לאישור"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום אדמין/מאמן צריך לקפוץ בין כמה מסכים. ה-Cockpit יביא הכל
            למסך אחד עם search גלובלי, רשימת זוגות עם drawer לעריכה, רשימת
            מנויים, ופאנל פעילות חיה. אפיון מלא ב-
            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs">
              docs/admin-cockpit-spec-2026-05-09.md
            </code>
          </p>
        </Gap>

        <Gap
          title="עריכת תוכן פר-זוג (override)"
          status="ב-Spec, ממתין לאישור"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום עריכה של פריט בקטלוג משפיעה על כל הזוגות. בעתיד תוכלו לערוך
            פריט <em>רק</em> לזוג מסוים בלי לפגוע באחרים. דורש מיגרציה 080.
          </p>
        </Gap>

        <Gap
          title="יצירת תוכן ad-hoc (חד-פעמי)"
          status="ב-Spec, ממתין לאישור"
          icon={<Construction className="size-4" />}
        >
          <p>
            כשאין פריט מתאים, רוצים לכתוב משהו חדש רק לזוג אחד מבלי שייכנס
            לקטלוג. כל ה-9 בלוקים — כותרת, תובנה, מאמר, תרגיל וכו&apos;.
          </p>
        </Gap>

        <Gap
          title="חיפוש גלובלי במערכת"
          status="ב-Spec, ממתין לאישור"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום אם רוצים למצוא זוג ספציפי, או משתמש לפי אימייל, או פריט לפי
            כותרת — כל אחד במקום אחר. ב-Cockpit יהיה search bar אחד שמחפש
            הכל.
          </p>
        </Gap>

        <Gap
          title="ניהול מנויים מלא"
          status="ב-Spec, ממתין לאישור"
          icon={<Construction className="size-4" />}
        >
          <p>
            השהיה / ביטול / refund / הארכת trial — היום חלק זמין, חלק לא.
            ה-Cockpit יביא Console drawer עם 8 פעולות אדמין מלאות + audit log.
          </p>
        </Gap>

        <Gap
          title="התראות real-time"
          status="V2 — אחרי ה-Cockpit"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום צריך להיכנס לדשבורד כדי לראות הודעה דחופה. בעתיד —
            push/email/WhatsApp נוטיפיקציה לכל urgent.
          </p>
        </Gap>

        <Gap
          title="ניתוח מגמות (cohort retention)"
          status="V2"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום יש מטריקות point-in-time. בעתיד — עקומות retention לחודש,
            רבעון, שנה. נוכל לראות אם זוגות שמתחילים בקטגוריה X נשארים
            יותר זמן.
          </p>
        </Gap>

        <Gap
          title="גרפים בכל מקום"
          status="V2"
          icon={<Construction className="size-4" />}
        >
          <p>
            היום יש גרף Score Evolution אחד ב-
            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs">
              /my/journey
            </code>
            . בעתיד — היסטוגרמות פר זוג, heatmap פר חודש, completion funnels.
          </p>
        </Gap>

        <Gap
          title="העתקת תוכן בין זוגות"
          status="לא ב-Spec עדיין"
          icon={<Construction className="size-4" />}
        >
          <p>
            כשמכינים תוכן ad-hoc למזוג ומבינים שזה רלוונטי גם לזוג אחר —
            צריך לאפשר &quot;להעתיק את זה לזוג אחר&quot;.{" "}
            <strong>נוסיף לאפיון.</strong>
          </p>
        </Gap>

        <Gap
          title="שיתוף בין מאמנים"
          status="לא רלוונטי כרגע"
          icon={<CircleDot className="size-4 text-muted-foreground" />}
        >
          <p>
            היום יש מאמן אחד (איציק). אם בעתיד יהיו מספר מאמנים — צריך
            להוסיף mechanism של handoff (העברת זוג ממאמן למאמן).
          </p>
        </Gap>
      </Section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* Footer                                                   */}
      {/* ──────────────────────────────────────────────────────── */}
      <footer className="border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">
          מצאתם משהו שחסר? תהיתם איך לפעול במצב מסוים? פנו לאיציק.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          המדריך מתעדכן אחרי כל שינוי משמעותי במערכת. עודכן לאחרונה: 09/05/2026.
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function TocLink({
  href,
  num,
  children,
}: {
  href: string;
  num: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-primary inline-flex items-center gap-2 hover:underline"
      >
        <span className="text-muted-foreground tabular-nums">{num}.</span>
        {children}
      </Link>
    </li>
  );
}

function Section({
  id,
  num,
  title,
  eta,
  children,
}: {
  id: string;
  num: string;
  title: string;
  eta?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-6">
      <header className="border-b pb-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-muted-foreground text-sm font-mono tabular-nums">
            {num}
          </span>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {eta ? (
            <span className="text-muted-foreground ms-auto text-xs">
              ⏱ {eta}
            </span>
          ) : null}
        </div>
      </header>
      <div className="space-y-5 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Step({
  num,
  title,
  href,
  children,
}: {
  num: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <header className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-muted-foreground text-xs font-mono tabular-nums">
          {num}
        </span>
        <h3 className="text-base font-bold">{title}</h3>
        {href ? (
          <Link
            href={href}
            className="text-primary inline-flex items-center gap-1 text-xs hover:underline ms-auto"
          >
            <ExternalLink className="size-3" />
            פתחו את המסך
          </Link>
        ) : null}
      </header>
      <div className="space-y-2 text-[14px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </div>
  );
}

function Checks({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-muted-foreground space-y-1 text-sm leading-relaxed">
      {children}
    </ul>
  );
}

function Highlight({
  tone,
  children,
}: {
  tone: "rose" | "amber" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "rose"
      ? "border-rose-300/40 bg-rose-500/[0.05] text-rose-900 dark:text-rose-100"
      : tone === "amber"
        ? "border-amber-300/40 bg-amber-500/[0.05] text-amber-900 dark:text-amber-100"
        : "border-blue-300/40 bg-blue-500/[0.05] text-blue-900 dark:text-blue-100";
  return (
    <div className={`rounded-md border p-3 text-[14px] ${cls}`}>{children}</div>
  );
}

function Gap({
  title,
  status,
  icon,
  children,
}: {
  title: string;
  status: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-muted-foreground bg-muted ms-auto rounded px-2 py-0.5 text-[11px]">
          {status}
        </span>
      </div>
      <div className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
