"use client";

/**
 * AdHocItemCreator
 *
 * Phase 13 — modal launcher for the coach to write a one-off lesson
 * for THIS specific couple. Shows up on the per-couple page below
 * "Send intervention" / "Smart suggestions" so it's available when a
 * coach concludes "the catalog doesn't have what this couple needs".
 *
 * UX choices:
 *   - Two-step disclosure: title + body required; "Add lesson blocks"
 *     reveals the optional 7-block area. Most one-offs will be a
 *     single-paragraph note — the coach shouldn't see 9 textareas
 *     until they ask for them.
 *   - Inline new-category creation: typing a fresh name in the new-
 *     category input takes precedence over the dropdown.
 *   - Audience: both / partner-A / partner-B (matches Send Intervention).
 *
 * Data flow: action → server → revalidatePath → page re-renders with
 * the new lesson visible in Active timeline + Couple history.
 */

import { useState, useTransition } from "react";
import { Plus, Wand2, X } from "lucide-react";
import {
  createOneOffItemForCouple,
  type CoachOneOffInput,
} from "@/app/actions/coach-one-off";

interface CategoryOption {
  id:      string;
  name_he: string | null;
  name_en: string | null;
}

export function AdHocItemCreator({
  coupleId,
  partnerALabel,
  partnerBLabel,
  hasPartnerB,
  categories,
}: {
  coupleId:       string;
  partnerALabel:  string;
  partnerBLabel:  string;
  hasPartnerB:    boolean;
  categories:     CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state — single source of truth, controlled inputs.
  const [target, setTarget] = useState<"both" | "a" | "b">("both");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [task, setTask] = useState("");
  const [expertInsight, setExpertInsight] = useState("");
  const [commonMistakes, setCommonMistakes] = useState("");
  const [metaphor, setMetaphor] = useState("");
  const [measurement, setMeasurement] = useState("");
  const [doThisWeek, setDoThisWeek] = useState("");
  const [dontThisWeek, setDontThisWeek] = useState("");
  const [progressMarker, setProgressMarker] = useState("");

  const reset = () => {
    setTitle("");
    setBody("");
    setTask("");
    setExpertInsight("");
    setCommonMistakes("");
    setMetaphor("");
    setMeasurement("");
    setDoThisWeek("");
    setDontThisWeek("");
    setProgressMarker("");
    setNewCategoryName("");
    setShowBlocks(false);
    setError(null);
    setSuccess(null);
  };

  const submit = () => {
    setError(null);
    setSuccess(null);
    if (title.trim().length < 2) {
      setError("יש להזין כותרת באורך 2+ תווים");
      return;
    }
    if (body.trim().length < 10) {
      setError("יש להזין תוכן באורך 10+ תווים");
      return;
    }
    if (!categoryId && newCategoryName.trim().length < 2) {
      setError("יש לבחור קטגוריה קיימת או ליצור חדשה");
      return;
    }
    const useNew = newCategoryName.trim().length >= 2;
    const payload: CoachOneOffInput = {
      coupleId,
      target,
      categoryId:      useNew ? undefined : categoryId,
      newCategoryName: useNew ? newCategoryName.trim() : undefined,
      title: title.trim(),
      body:  body.trim(),
      task:           task.trim() || undefined,
      expertInsight:  expertInsight.trim() || undefined,
      commonMistakes: commonMistakes.trim() || undefined,
      metaphor:       metaphor.trim() || undefined,
      measurement:    measurement.trim() || undefined,
      doThisWeek:     doThisWeek.trim() || undefined,
      dontThisWeek:   dontThisWeek.trim() || undefined,
      progressMarker: progressMarker.trim() || undefined,
    };
    startTransition(async () => {
      const r = await createOneOffItemForCouple(payload);
      if (r.ok) {
        setSuccess(
          `נשלח. הזוג יראה את התוכן מיד — ${r.data.assignments} משתתפ${r.data.assignments === 1 ? "" : "ים"}.`,
        );
        // Keep the modal open so the coach can immediately confirm; auto-close after a beat.
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 1200);
      } else {
        setError(`שליחה נכשלה: ${r.error}`);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card p-4 text-start transition"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
            <Wand2 className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">תוכן מותאם אישית לזוג</div>
            <div className="text-muted-foreground text-xs">
              צור שיעור חדש שיגיע מיד רק לזוג הזה. לא נכנס לקטלוג הכללי.
            </div>
          </div>
        </div>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Plus className="size-3.5" />
          חדש
        </span>
      </button>
    );
  }

  return (
    <div className="bg-card relative space-y-4 rounded-lg border p-4" dir="rtl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">שיעור one-off לזוג הזה</h3>
          <p className="text-muted-foreground text-xs">
            התוכן נשמר עם דגל is_one_off — לא יופיע בקטלוג הכללי ולא יומלץ
            לזוגות אחרים.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="hover:bg-muted/40 rounded-md p-1 transition"
          aria-label="סגור"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Audience + category */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="למי לשלוח">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as "both" | "a" | "b")}
            className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
          >
            <option value="both">לשני בני הזוג</option>
            <option value="a">{partnerALabel}</option>
            <option value="b" disabled={!hasPartnerB}>
              {partnerBLabel}{!hasPartnerB ? " (לא מחובר)" : ""}
            </option>
          </select>
        </Field>
        <Field label="קטגוריה (קיימת)">
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setNewCategoryName("");
            }}
            disabled={newCategoryName.trim().length >= 2}
            className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {categories.length === 0 ? (
              <option value="">— אין קטגוריות —</option>
            ) : null}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_he ?? c.name_en ?? c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="או — צור קטגוריה חדשה (השאר ריק כדי להשתמש בקיימת)">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="לדוגמה: התמודדות עם משברים"
          className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </Field>

      {/* Required: title + body */}
      <Field label="כותרת">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת קצרה ומדויקת"
          className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="גוף השיעור (תוכן עיקרי)">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="כתוב כאן את הסיפור / הקונספט / מה שהזוג צריך לקרוא"
          className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm leading-snug"
        />
      </Field>

      {/* Optional 7-block disclosure */}
      <button
        type="button"
        onClick={() => setShowBlocks((v) => !v)}
        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition hover:underline"
      >
        {showBlocks ? "הסתר בלוקים מתקדמים" : "+ הוסף בלוקים מתקדמים (תרגיל, מטאפורה, סימני התקדמות…)"}
      </button>

      {showBlocks ? (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <Field label="תרגיל / שאלה">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={2}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="תובנת המאמן">
            <textarea
              value={expertInsight}
              onChange={(e) => setExpertInsight(e.target.value)}
              rows={2}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="טעויות שכיחות">
            <textarea
              value={commonMistakes}
              onChange={(e) => setCommonMistakes(e.target.value)}
              rows={2}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="מטאפורה">
            <textarea
              value={metaphor}
              onChange={(e) => setMetaphor(e.target.value)}
              rows={2}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="מה למדוד / לשים לב אליו השבוע">
            <textarea
              value={measurement}
              onChange={(e) => setMeasurement(e.target.value)}
              rows={2}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="לעשות השבוע">
              <textarea
                value={doThisWeek}
                onChange={(e) => setDoThisWeek(e.target.value)}
                rows={2}
                className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="לא לעשות השבוע">
              <textarea
                value={dontThisWeek}
                onChange={(e) => setDontThisWeek(e.target.value)}
                rows={2}
                className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
          <Field label="סימן להתקדמות (איך נדע שעבד)">
            <input
              type="text"
              value={progressMarker}
              onChange={(e) => setProgressMarker(e.target.value)}
              className="bg-background w-full rounded-md border border-border px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-muted-foreground text-[11px]">
          התוכן יוצמד מיידית — anchor=עכשיו, unlock=עכשיו. הזוג יראה אותו ב-/my/journey
          תוך מספר שניות.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={pending}
            className="hover:bg-muted/40 rounded-md border border-border px-3 py-1.5 text-xs transition disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "שולח…" : "צור ושלח עכשיו"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}
