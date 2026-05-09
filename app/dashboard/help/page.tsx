/**
 * /dashboard/help
 *
 * Phase 12 — central Hebrew help index for the admin. Different from
 * /dashboard/coaching-guide (which is workflow-focused — "how to do
 * your job"). This page is functionality-focused — "what does each
 * area / button / control DO".
 *
 * Reading order: top → bottom. Each section explains one admin
 * surface with: WHAT it is, WHAT controls live there, WHEN to use it,
 * WHEN the AI helps. Live links into every surface.
 */

import Link from "next/link";
import {
  Sparkles,
  ExternalLink,
  HeartHandshake,
  Stethoscope,
  Activity,
  MessageSquare,
  BookOpenText,
  UserCog,
  Filter,
  FileText,
} from "lucide-react";
import { requireExpert } from "@/lib/auth/expert";

export const metadata = {
  title: "Mioshy — מרכז עזרה",
};

export default async function HelpPage() {
  await requireExpert();

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16" dir="rtl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          מרכז עזרה — מה כל אזור באדמין עושה
        </h1>
        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
          המסך הזה מסביר <strong>לפי אזור</strong> מה כל מסך, כפתור או
          רכיב באדמין עושה, מתי להשתמש בו, ואיך ה-AI עוזר. אם אתם מחפשים{" "}
          <strong>איך לטפל בזרימת עבודה יומית</strong> — לכו ל-
          <Link
            href="/dashboard/coaching-guide"
            className="text-primary hover:underline"
          >
            מדריך למאמן
          </Link>
          .
        </p>
      </header>

      {/* Quick TOC */}
      <nav className="bg-card rounded-lg border p-4">
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
          קפיצה מהירה
        </h2>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          <Toc href="#dashboard">סקירה ראשית</Toc>
          <Toc href="#my-clients">הזוגות שלי</Toc>
          <Toc href="#clinician">התור היום</Toc>
          <Toc href="#coach-profile">הפרופיל שלי</Toc>
          <Toc href="#coach-library">הספרייה שלי</Toc>
          <Toc href="#journey-hub">מסע — מערכת תוכן</Toc>
          <Toc href="#journey-items">פריטי המסע (250 השיעורים)</Toc>
          <Toc href="#journey-item-edit">עריכת פריט בודד</Toc>
          <Toc href="#journey-match-rules">כללי התאמה</Toc>
          <Toc href="#journey-feedback">פידבק פר־פריט</Toc>
          <Toc href="#journey-expert-messages">הודעות מומחים</Toc>
          <Toc href="#journey-metrics">מטריקות פלטפורמה</Toc>
          <Toc href="#ai-overview">איך ה-AI עוזר</Toc>
        </ul>
      </nav>

      {/* ── DASHBOARD ───────────────────────────────────────────── */}
      <Section
        id="dashboard"
        title="סקירה ראשית"
        href="/dashboard"
        icon={<HeartHandshake className="size-4" />}
      >
        <p>
          מסך הנחיתה. למאמן — מציג שלום אישי, סטטוס תור (דחוף / SLA / drift /
          threads), checklist הגדרות שטרם הושלמו, וניווט מהיר ל-4 המסכים
          המרכזיים.
        </p>
        <p>
          <strong>מתי להיכנס:</strong> בכל בוקר. אם הכול ירוק — תוך 2-5 דקות
          סיימתם.
        </p>
        <p>
          <strong>מה הכפתורים עושים:</strong> כל KPI card הוא קליקבילי ומוביל
          ישירות לרשימה הרלוונטית. ה-checklist מוביל למסך ההגדרה.
        </p>
        <Ai>
          ה-AI מסווג הודעות משתמש כך שמספר &quot;דחוף&quot; שמופיע בקרון העליון
          הוא ספירה אוטומטית — אין צורך לסרוק ידנית.
        </Ai>
      </Section>

      {/* ── MY CLIENTS ──────────────────────────────────────────── */}
      <Section
        id="my-clients"
        title="הזוגות שלי"
        href="/dashboard/my-clients"
        icon={<HeartHandshake className="size-4" />}
      >
        <p>
          רשימת כל הזוגות שמוצמדים אליכם דרך טבלת{" "}
          <code className="bg-muted rounded px-1 text-xs">expert_couples</code>.
          לחיצה על שורה פותחת את מרחב הזוג.
        </p>
        <h4 className="font-bold mt-3">פאנלים בעמוד:</h4>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li>
            <strong>דורש התייחסות</strong> — הודעות urgent + concerning שה-AI
            סימן. דחוף ראשון.
          </li>
          <li>
            <strong>צריכים check-in</strong> — זוגות שקטים 8+ ימים (drift).
          </li>
          <li>
            <strong>טבלת זוגות</strong> — שם, סטטוס, פעילות אחרונה, מצב SLA,
            asymmetry chip (אם פרטנר אחד פעיל יותר).
          </li>
        </ul>
        <p>
          <strong>במרחב הזוג</strong> (לחיצה על שורה):
        </p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li>
            <strong>Smart Suggestions</strong> — 3 פריטים שה-AI ממליץ לדחוף עכשיו
          </li>
          <li>
            <strong>טופס הצמדה</strong> — לדחוף תוכנית/קטגוריה/פריט בודד
          </li>
          <li>
            <strong>תקשורת</strong> — שלושת הערוצים (פר־פריט / אישי / זוגי)
          </li>
          <li>
            <strong>Recent Activity</strong> — פעילות הזוג בזמן אמת
          </li>
        </ul>
        <Ai>
          ה-Smart Suggestions משתמש בעדיפויות הזוג מהאבחון (50/40/30/20/10
          ניקוד) + השלב הנוכחי שלהם + פידבק שלילי על פריטים דומים. ה-AI לא
          דוחף אוטומטית — הוא ממליץ. אתם בוחרים.
        </Ai>
      </Section>

      {/* ── CLINICIAN QUEUE ─────────────────────────────────────── */}
      <Section
        id="clinician"
        title="התור היום"
        href="/dashboard/clinician"
        icon={<Stethoscope className="size-4" />}
      >
        <p>
          רשימת ה-threads הפתוחים — היכן שמשתמש שלח הודעה ועוד לא הגבתם.
          ממוין לפי גיל ההודעה (הישנות קודם).
        </p>
        <p>
          <strong>SLA:</strong> 48 שעות בלי תגובה = breach. הפאנל בדשבורד
          הראשי מציג כמה תורים פתוחים.
        </p>
        <Ai>
          ה-AI מצבע את הסנטימנט של ההודעה (positive / neutral / concerning /
          urgent) — ואותם sentiments מסומנים בצבע מיוחד בתור כך שתדעו אילו
          שיחות עדינות לטפל בעדיפות.
        </Ai>
      </Section>

      {/* ── COACH PROFILE ───────────────────────────────────────── */}
      <Section
        id="coach-profile"
        title="הפרופיל שלי"
        href="/dashboard/coach-profile"
        icon={<UserCog className="size-4" />}
      >
        <p>
          הפרסונה שהזוגות רואים על כל הודעה שלכם. שם תצוגה, תמונה, ביו קצר.
          בלי זה כל ההודעות חתומות &quot;מיאושי&quot; באופן גנרי וזה פוגע
          באמון הזוג.
        </p>
        <p>
          <strong>חובה למלא לפני הצמדה ראשונה לזוג.</strong>
        </p>
      </Section>

      {/* ── COACH LIBRARY ───────────────────────────────────────── */}
      <Section
        id="coach-library"
        title="הספרייה שלי"
        href="/dashboard/coach-library"
        icon={<BookOpenText className="size-4" />}
      >
        <p>
          ספריית snippets לשימוש מהיר. שלוש קטגוריות:
        </p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li>
            <strong>Saved replies</strong> — תגובות שמורות. לוחצים → נשתל
            בתיבת ההודעה. תגיות עוברות אוטומטית.
          </li>
          <li>
            <strong>Content pins</strong> — קישורים לפריטים בקטלוג שמומלצים
            פעמים רבות.
          </li>
          <li>
            <strong>Couple notes</strong> — הערות פנימיות פר־זוג. הזוג לא רואה.
          </li>
        </ul>
        <p>
          יש גם <strong>Starter Templates</strong> — תבניות מוכנות שמיאושי
          הכינה, אפשר לקלון לספרייה האישית.
        </p>
        <Ai>
          התגיות שאתם שמים על תגובה שמורה עוברות אוטומטית להודעה כשמשתמשים
          בה — כך שדשבורד &quot;הודעות מומחים&quot; (אדמין) יכול למיין לפי
          תגית בלי שתתייגו ידנית בכל הודעה.
        </Ai>
      </Section>

      {/* ── JOURNEY HUB ─────────────────────────────────────────── */}
      <Section
        id="journey-hub"
        title="מסע — מערכת תוכן"
        href="/dashboard/journey"
        icon={<FileText className="size-4" />}
      >
        <p>
          מרכז ניהול התוכן של מוצר Journey. <strong>מצמידים</strong> תוכניות /
          קטגוריות / פריטים לזוגות, או יוצרים תוכן חדש.
        </p>
        <p>4 הקלפים העליונים:</p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li>
            <strong>תוכניות</strong> — קונטיינר של קטגוריות (לדוגמה
            &quot;המסע השלם&quot;).
          </li>
          <li>
            <strong>קטגוריות</strong> — 5 הקטגוריות העיקריות (תקשורת / מיניות
            / וכו&apos;) + עצמאיות.
          </li>
          <li>
            <strong>פריטים</strong> — 250 שיעורים בודדים.
          </li>
          <li>
            <strong>בעלים פעילים</strong> — מספר הזוגות עם הצמדה פעילה.
          </li>
        </ul>
        <p>4 שורטקאטים נוספים:</p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li><strong>כללי התאמה</strong> — איך פריטים מקבלים שיוך</li>
          <li><strong>פידבק פר־פריט</strong> — איזה תוכן מצליח</li>
          <li><strong>הודעות מומחים</strong> — מעקב חוצה־מאמנים</li>
          <li><strong>מטריקות פלטפורמה</strong> — KPIs כלליים</li>
        </ul>
      </Section>

      {/* ── JOURNEY ITEMS ───────────────────────────────────────── */}
      <Section
        id="journey-items"
        title="פריטי המסע"
        href="/dashboard/journey/items"
        icon={<FileText className="size-4" />}
      >
        <p>
          הקטלוג של 250 השיעורים שייצרתם / שייבאתם מ-CSV. לוחצים פריט →
          נפתח עורך השיעור המלא.
        </p>
        <p>
          <strong>חלוקה:</strong> 4 שלבים (יסודות / העמקה / אינטגרציה /
          הבשלה) × 5 קטגוריות = 50 / 75 / 75 / 50 = 250.
        </p>
        <p>
          <strong>פילטרים:</strong> לפי קטגוריה ותת־נושא. (פילטר שלב יבוא
          ב-V2.)
        </p>
      </Section>

      {/* ── JOURNEY ITEM EDIT ───────────────────────────────────── */}
      <Section
        id="journey-item-edit"
        title="עריכת פריט בודד"
        icon={<FileText className="size-4" />}
      >
        <p>
          (זה העמוד שאליו מגיעים מלחיצה על פריט ברשימה — למשל URL כמו{" "}
          <code className="bg-muted rounded px-1 text-xs">
            /dashboard/journey/items/&lt;id&gt;
          </code>
          .)
        </p>
        <p>
          השיעור מובנה כ-9 בלוקים נפרדים. כל בלוק נערך עצמאית והופך
          לסקציה בעמוד שהזוג רואה:
        </p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li><strong>תובנת מומחים</strong> — פתיחה (60-150 מילים)</li>
          <li><strong>טעות שכיחה</strong> — מה רוב הזוגות עושים לא נכון</li>
          <li><strong>מטאפורה</strong> — עוגן ויזואלי קצר</li>
          <li><strong>תוכן מלא</strong> — מאמר עומק (~500 מילים)</li>
          <li><strong>תרגיל / שאלה</strong> — ה-CTA הראשי</li>
          <li><strong>תצפית / מדידה</strong> — מה לבדוק במשך השבוע</li>
          <li><strong>לעשות / לא לעשות השבוע</strong> — שני קלפים</li>
          <li><strong>סימן להתקדמות</strong> — איך תדעו שזה עובד</li>
          <li><strong>מקור</strong> — Gottman / Chapman / Perel וכו&apos;</li>
        </ul>
        <p>
          בנוסף: שלב (1-4), קטגוריה, slug, audience (שני פרטנרים / רק
          owner / רק partner), תאריך unlock, סטטוס פעיל.
        </p>
        <p>
          יש שני מצבי עריכה לאבחונים: <strong>Visual builder</strong>{" "}
          (form-builder ויזואלי לשאלות) ו-<strong>JSON</strong> (לאדמין מתקדם).
        </p>
        <Ai>
          ה-AI לא נוגע בעריכת פריטים. עריכה ידנית בלבד. אבל פידבק שלילי על
          פריט מצטבר בדשבורד — אם פריט מקבל 3+ &quot;לא בשבילנו&quot; ה-Smart
          Suggestions יסתיר אותו אוטומטית.
        </Ai>
      </Section>

      {/* ── MATCH RULES ─────────────────────────────────────────── */}
      <Section
        id="journey-match-rules"
        title="כללי התאמה"
        href="/dashboard/journey/match-rules"
        icon={<Filter className="size-4" />}
      >
        <p>
          כל פריט שמשובץ אצל זוג נושא שיוך לכלל שיצר אותו (לדוגמה
          &quot;עדיפות #1&quot; / &quot;רכישה אוטומטית&quot;). הכלל הוא ה-
          <em>סיבה</em> שהמשתמש רואה תחת &quot;למה הפריט הזה?&quot;.
        </p>
        <p>
          בעמוד הזה עורכים את <strong>הסבר הכלל</strong> (rationale) — לא את
          הלוגיקה. השינויים מופיעים מיידית לכל המשתמשים שיש להם פריטים
          מתויגים בכלל.
        </p>
        <p>
          <strong>סוגי כללים:</strong> ידני / רכישה אוטו&apos; / עדיפות #1 /
          ברירת מערכת.
        </p>
      </Section>

      {/* ── FEEDBACK ────────────────────────────────────────────── */}
      <Section
        id="journey-feedback"
        title="פידבק פר־פריט"
        href="/dashboard/journey/feedback"
        icon={<MessageSquare className="size-4" />}
      >
        <p>
          המשתמש בוחר אחת מ-4 אפשרויות אחרי השלמת פריט: עזר / נייטרלי /
          לא בשבילנו / החמיר את המצב. הדשבורד מראה את ההתפלגות פר־פריט.
        </p>
        <p>
          <strong>שימושי:</strong> איתור פריטים שעובדים / פריטים שלא. פריטים
          עם 3+ פידבק שלילי מסומנים בדשבורד מטריקות תחת &quot;Attention list&quot;.
        </p>
      </Section>

      {/* ── EXPERT MESSAGES ─────────────────────────────────────── */}
      <Section
        id="journey-expert-messages"
        title="הודעות מומחים"
        href="/dashboard/journey/expert-messages"
        icon={<MessageSquare className="size-4" />}
      >
        <p>
          פיד <strong>חוצה־מאמנים, חוצה־זוגות</strong> של כל הודעה ששלח מאמן
          (פר־פריט + ערוץ אישי + ערוץ זוגי). מאפשר לאדמין לראות מגמות:
          איזה נושאים בטרנד, מי מטפל בכמה זוגות, איזה תגיות עולות יותר.
        </p>
        <p>
          <strong>פילטרים:</strong> לפי מאמן / זוג / תאריך / תגית /
          לא־מתויגות בלבד.
        </p>
        <Ai>
          התגיות עוברות אוטומטית מהספרייה האישית של המאמן (כשמשתמשים בתגובה
          שמורה) — כך שלא צריך לתייג ידנית בכל הודעה. הודעות &quot;לא
          מתויגות&quot; הן תגובות אורגניות (נכתבו מאפס).
        </Ai>
      </Section>

      {/* ── METRICS ─────────────────────────────────────────────── */}
      <Section
        id="journey-metrics"
        title="מטריקות פלטפורמה"
        href="/dashboard/journey/metrics"
        icon={<Activity className="size-4" />}
      >
        <p>
          KPIs חוצי־מערכת למוצר Journey. מסך אחד עם 4 שורות:
        </p>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px]">
          <li>
            <strong>קלפי KPI עליונים</strong> — בעלים פעילים, אחוז השלמה (30
            יום), זמן תגובה ממוצע, drift.
          </li>
          <li>
            <strong>עומס מאמנים</strong> — top 10 מאמנים: זוגות פעילים,
            הודעות 30 יום, threads פתוחים (ללא תגובה עדיין).
          </li>
          <li>
            <strong>Funnel שלבים</strong> — כמה זוגות שונים השלימו לפחות פריט
            אחד בכל שלב.
          </li>
          <li>
            <strong>חום קטגוריות</strong> — השלמות לפי קטגוריה — 7 ימים מול
            7 קודמים.
          </li>
          <li>
            <strong>הודעות דחופות + מדאיגות</strong> — רשימה אוטומטית של
            הודעות משתמש שה-AI סימן.
          </li>
          <li>
            <strong>רשימת תשומת לב</strong> — drift cohorts + פריטים עם פידבק
            שלילי שצריכים עיניים.
          </li>
        </ul>
        <Ai>
          כפתור &quot;הרץ מסווג על הצבר&quot; בראש פאנל ההודעות הדחופות —
          מסווג אחורה הודעות היסטוריות שהיו לפני שה-AI הופעל. עלות ~$0.10
          לכל 500 הודעות. הריצו פעם אחת לפני שה-Concerning panel ימולא
          באופן מלא.
        </Ai>
      </Section>

      {/* ── AI OVERVIEW ─────────────────────────────────────────── */}
      <Section
        id="ai-overview"
        title="איך ה-AI עוזר — סיכום מלא"
        icon={<Sparkles className="size-4 text-amber-500" />}
      >
        <p>
          המערכת משתמשת ב-Claude Haiku ל-3 שימושים. <strong>בכל המקרים ה-AI
          מסייע ולא מחליט</strong> — הוא מסווג, ממליץ, מסמן. ההחלטות
          הסופיות שלכם.
        </p>

        <h4 className="mt-4 font-bold">1. סיווג הודעות (sentiment + tags)</h4>
        <p>
          כל הודעה ש<em>משתמש</em> שולח עוברת ניתוח אוטומטי. ה-AI מחזיר:
        </p>
        <ul className="list-disc space-y-1 ps-5 text-[13px]">
          <li>
            <strong>סנטימנט:</strong> positive / neutral / concerning / urgent
          </li>
          <li>
            <strong>תגיות נושא:</strong> 1-3 תגיות מבין 12 קטגוריות סגורות
            (תקשורת / אינטימיות / חברות / קונפליקט / וכו&apos;)
          </li>
        </ul>
        <p>
          <strong>מתי זה עוזר:</strong> אתם רואים בכניסה לדשבורד מספר
          &quot;דחוף&quot; — זה מספר ההודעות שה-AI סימן כדורשות תגובה
          מיידית. בלי זה הייתם צריכים לסרוק כל הודעה ידנית.
        </p>

        <h4 className="mt-4 font-bold">2. המלצות חכמות פר־זוג</h4>
        <p>
          במרחב הזוג, ה-AI מציג 3 פריטים שמתאימים לזוג הזה <strong>עכשיו</strong>:
        </p>
        <ul className="list-disc space-y-1 ps-5 text-[13px]">
          <li>עדיפות #1 שלהם מהאבחון = +50 ניקוד</li>
          <li>שלב מתאים (הנוכחי או הבא) = +20/+10 ניקוד</li>
          <li>פריט עם פידבק שלילי כללי = -10 לכל פידבק שלילי (cap -30)</li>
        </ul>
        <p>
          <strong>מתי זה עוזר:</strong> אתם פותחים זוג ומיד רואים &quot;מה
          לדחוף עכשיו&quot; בלי לחפור בקטלוג של 250.
        </p>

        <h4 className="mt-4 font-bold">3. Backfill — סיווג היסטורי</h4>
        <p>
          הודעות שנשלחו לפני שה-AI הופעל נשארות עם סנטימנט = NULL. הכפתור
          &quot;הרץ מסווג&quot; בעמוד מטריקות מסווג אחורה. עלות נמוכה
          (~$0.10/500 הודעות).
        </p>
        <p>
          <strong>מתי להריץ:</strong> פעם אחת בהפעלה הראשונה. לאחר מכן ההודעות
          החדשות מסווגות אוטומטית.
        </p>

        <div
          className="mt-4 rounded-md border p-3 text-[13px]"
          style={{
            borderColor: "rgba(184,60,77,0.45)",
            background: "rgba(184,60,77,0.08)",
          }}
        >
          <strong>מה ה-AI לא יעשה:</strong>
          <ul className="mt-1.5 list-disc space-y-0.5 ps-5">
            <li>לא יענה במקומכם להודעה</li>
            <li>לא ידחוף תוכן בלי האישור שלכם</li>
            <li>לא ישנה את הקטלוג</li>
            <li>לא יתקשר עם הזוג מאחורי הקלעים</li>
          </ul>
        </div>
      </Section>

      <footer className="border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">
          חסר משהו? הסבר לא ברור? פנו לאיציק.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          המסך מתעדכן אחרי כל שינוי משמעותי במערכת.
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function Toc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-primary hover:underline">
        ← {children}
      </Link>
    </li>
  );
}

function Section({
  id,
  title,
  href,
  icon,
  children,
}: {
  id: string;
  title: string;
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-6">
      <header className="border-b pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {href ? (
            <Link
              href={href}
              className="text-primary inline-flex items-center gap-1 text-xs hover:underline ms-auto"
            >
              <ExternalLink className="h-3 w-3" />
              פתחו את האזור
            </Link>
          ) : null}
        </div>
      </header>
      <div className="space-y-2 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Ai({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-md border p-3 text-[13px] leading-relaxed"
      style={{
        borderColor: "rgba(184,60,77,0.45)",
        background: "rgba(184,60,77,0.08)",
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[12px]">
        <Sparkles className="h-3.5 w-3.5" />
        תפקיד ה-AI כאן
      </div>
      <div className="text-foreground/85">{children}</div>
    </div>
  );
}
