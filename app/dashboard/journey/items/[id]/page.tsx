import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListAllSubtopics,
  adminListCategoriesWithItemCounts,
  adminListPrograms,
  getItemById,
} from "@/lib/journey-content/queries";
import { getItemLiveStats } from "@/lib/journey-content/observability";
import { ItemForm } from "@/components/dashboard/journey/ItemForm";
import type {
  CategoryOption,
  SubtopicOption,
} from "@/components/dashboard/journey/ItemForm";
import { ItemLiveStatsSidebar } from "@/components/dashboard/journey/ItemLiveStatsSidebar";
import { ItemPropagationActions } from "@/components/dashboard/journey/ItemPropagationActions";
import { AssessmentEditor } from "@/components/dashboard/journey/AssessmentEditor";
import { SectionHelp } from "@/components/dashboard/SectionHelp";
import { getAdminLocale } from "@/lib/admin/locale";
import { ArrowLeft } from "lucide-react";
import type { JourneyItemFormValues } from "@/lib/journey-content/validations";
import type {
  JourneyItemKind,
  JourneyAssessmentPayload,
} from "@/lib/journey-content/types";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const locale = getAdminLocale();
  const item = await getItemById(params.id);
  if (!item) notFound();

  const [categories, programs, subtopics, liveStats] = await Promise.all([
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
    adminListAllSubtopics(),
    getItemLiveStats(item.id),
  ]);
  const programNameById = new Map(programs.map((p) => [p.id, p.name_he] as const));

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name_he,
    program_label: c.program_id
      ? programNameById.get(c.program_id) ?? null
      : null,
  }));

  const subtopicOptions: SubtopicOption[] = subtopics.map((s) => ({
    id: s.id,
    category_id: s.category_id,
    label: s.name_he,
  }));

  const defaults: JourneyItemFormValues = {
    category_id: item.category_id,
    subtopic_id: item.subtopic_id ?? "",
    slug: item.slug,
    title_he: item.title_he,
    title_en: item.title_en ?? "",
    body_he: item.body_he,
    body_en: item.body_en ?? "",
    task_he: item.task_he ?? "",
    task_en: item.task_en ?? "",
    challenge_he: item.challenge_he ?? "",
    challenge_en: item.challenge_en ?? "",
    video_url: item.video_url ?? "",
    image_url: item.image_url ?? "",
    sort_order: item.sort_order,
    default_offset_days: item.default_offset_days,
    is_active: item.is_active,
    audience: (item.audience ?? "both") as "both" | "owner" | "partner",

    // Lesson blocks (migration 077). 0 = unset sentinel for stage.
    stage: item.stage ?? 0,
    source_attribution_he: item.source_attribution_he ?? "",
    source_attribution_en: item.source_attribution_en ?? "",
    expert_insight_he: item.expert_insight_he ?? "",
    expert_insight_en: item.expert_insight_en ?? "",
    common_mistakes_he: item.common_mistakes_he ?? "",
    common_mistakes_en: item.common_mistakes_en ?? "",
    metaphor_he: item.metaphor_he ?? "",
    metaphor_en: item.metaphor_en ?? "",
    measurement_he: item.measurement_he ?? "",
    measurement_en: item.measurement_en ?? "",
    do_this_week_he: item.do_this_week_he ?? "",
    do_this_week_en: item.do_this_week_en ?? "",
    dont_this_week_he: item.dont_this_week_he ?? "",
    dont_this_week_en: item.dont_this_week_en ?? "",
    progress_marker_he: item.progress_marker_he ?? "",
    progress_marker_en: item.progress_marker_en ?? "",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/items"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          חזרה לרשימה
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">
              {item.title_he}
            </h1>
            <SectionHelp
              title="עריכת פריט בקטלוג"
              body={
                <>
                  <p>
                    אתם בעורך השיעור. השיעור מובנה כ-9 בלוקים נפרדים. כל
                    בלוק נערך עצמאית והופך לסקציה בעמוד שהזוג רואה.
                  </p>
                  <p><strong>הבלוקים — מה כל אחד עושה:</strong></p>
                  <ul className="list-disc space-y-1 ps-5 text-[13px]">
                    <li><strong>תובנת מומחים</strong> — פתיחה (60-150
                      מילים). הסבר &quot;ההיגיון מאחורי&quot; הנושא.</li>
                    <li><strong>טעות שכיחה</strong> — מה רוב הזוגות עושים
                      לא נכון. מסומן באדום־ענבר בעמוד המשתמש.</li>
                    <li><strong>מטאפורה</strong> — עוגן ויזואלי (לדוגמה
                      &quot;כמו רדיו...&quot;). פסקה אחת.</li>
                    <li><strong>תוכן מלא</strong> — מאמר 500 מילים. ה-deep
                      dive.</li>
                    <li><strong>שאלה / תרגיל</strong> — ה-CTA הראשי. מסומן
                      בולט בכרטיס יין.</li>
                    <li><strong>תצפית / מדידה</strong> — &quot;ספרו השבוע
                      כמה פעמים...&quot;. מבסס פידבק.</li>
                    <li><strong>לעשות / לא לעשות השבוע</strong> — שני
                      קלפים זה לצד זה (ירוק + ורוד).</li>
                    <li><strong>סימן להתקדמות</strong> — &quot;תופסים את
                      עצמכם ש...&quot;. מאיר על התוצאה הצפויה.</li>
                    <li><strong>מקור</strong> — לדוגמה &quot;Gottman, The
                      Seven Principles&quot;. מוצג ברגל הפריט עם framing
                      &quot;מבוסס על המחקר של... — ניתוח של מיאושי&quot;.</li>
                  </ul>
                  <p><strong>שדות נוספים:</strong></p>
                  <ul className="list-disc space-y-1 ps-5 text-[13px]">
                    <li><strong>שלב 1-4</strong> — מיקום בקוריקולום (יסודות
                      / העמקה / אינטגרציה / הבשלה).</li>
                    <li><strong>קטגוריה</strong> — אחת מ-5 (תקשורת /
                      מיניות / אהבה / חברות / משפחה).</li>
                    <li><strong>Audience</strong> — שני פרטנרים / רק owner
                      / רק partner.</li>
                    <li><strong>Default offset</strong> — כמה ימים אחרי
                      העוגן הפריט נפתח.</li>
                    <li><strong>Active toggle</strong> — Draft (לא נדחף
                      לזוגות) / Active.</li>
                  </ul>
                  <p>
                    <strong>שמירה:</strong> כפתור &quot;Save&quot; בראש —
                    שינויים מתעדכנים אוטומטית בכל זוג שיש לו את הפריט הזה
                    בציר הזמן.
                  </p>
                </>
              }
              aiNote={
                <>
                  <p>
                    ה-AI לא נוגע בעריכה. <strong>אבל</strong> פידבק שלילי
                    מצטבר על הפריט הזה ייגרום ל-Smart Suggestions להסתיר
                    אותו אוטומטית — תבדקו את הפידבק (כפתור &quot;View
                    feedback&quot; למעלה ימינה) אם פריט פתאום מפסיק לקבל
                    המלצות.
                  </p>
                </>
              }
            />
          </span>
          <Link
            href={`/dashboard/journey/items/${item.id}/feedback`}
            className="text-primary text-sm hover:underline"
          >
            צפיה בפידבק ←
          </Link>
        </div>
      </div>

      {/* Two-column layout: editor on the left, live-stats rail on
          the right. Stacks to single column at < lg. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <ItemForm
            itemId={item.id}
            defaultValues={defaults}
            categories={categoryOptions}
            subtopics={subtopicOptions}
            locale={locale}
          />

          {/* Phase 3 step 3 - assessment / reflection editor.
              Available on every item; for content items it just shows the
              kind selector. Setting kind=assessment opens the JSON editor
              + live preview using the same form the end user will see. */}
          <AssessmentEditor
            itemId={item.id}
            initialKind={(item.kind as JourneyItemKind | undefined) ?? "content"}
            initialPayload={
              (item.assessment_payload as JourneyAssessmentPayload | null | undefined) ??
              null
            }
          />

          <ItemPropagationActions
            itemId={item.id}
            currentOffsetDays={item.default_offset_days}
          />
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <ItemLiveStatsSidebar stats={liveStats} />
        </div>
      </div>
    </div>
  );
}
