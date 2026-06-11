"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DimensionDef, QuestionInput } from "@/lib/assessments/types";
import {
  upsertAssessmentQuestion,
  deleteAssessmentQuestion,
  reorderAssessmentQuestion,
  exportAssessmentQuestionsCsv,
  importAssessmentQuestionsCsv,
} from "@/app/dashboard/assessments/actions";

export interface QuestionRow {
  slug: string;
  position: number;
  dimension_key: string | null;
  type: "likert5" | "reflection";
  reverse: boolean;
  is_open: boolean;
  text_he: string;
  text_en: string;
  source_slugs: string;
  is_active: boolean;
}

interface Props {
  assessmentId: string;
  dimensions: DimensionDef[];
  initialQuestions: QuestionRow[];
}

function emptyDraft(nextPos: number): QuestionRow {
  return {
    slug: "",
    position: nextPos,
    dimension_key: null,
    type: "likert5",
    reverse: false,
    is_open: false,
    text_he: "",
    text_en: "",
    source_slugs: "",
    is_active: true,
  };
}

export function QuestionsManager({ assessmentId, dimensions, initialQuestions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<QuestionRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dimLabel = (key: string | null) =>
    key ? dimensions.find((d) => d.key === key)?.he ?? key : "—";

  const nextPos = (initialQuestions.at(-1)?.position ?? 0) + 1;

  const save = () => {
    if (!draft) return;
    const input: QuestionInput = { assessment_id: assessmentId, ...draft };
    startTransition(async () => {
      const res = await upsertAssessmentQuestion(input);
      if (res.ok) {
        setMsg("נשמר ✓");
        setDraft(null);
        router.refresh();
      } else setMsg(`שגיאה: ${res.error}`);
    });
  };

  const remove = (slug: string) => {
    if (!confirm(`למחוק את השאלה ${slug}?`)) return;
    startTransition(async () => {
      const res = await deleteAssessmentQuestion(assessmentId, slug);
      setMsg(res.ok ? "נמחק ✓" : `שגיאה: ${res.error}`);
      if (res.ok) router.refresh();
    });
  };

  const move = (slug: string, dir: -1 | 1) => {
    startTransition(async () => {
      await reorderAssessmentQuestion(assessmentId, slug, dir);
      router.refresh();
    });
  };

  const doExport = () => {
    startTransition(async () => {
      const csv = await exportAssessmentQuestionsCsv(assessmentId);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${assessmentId}-questions.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    startTransition(async () => {
      const res = await importAssessmentQuestionsCsv(assessmentId, text);
      setMsg(res.ok ? `יובאו ${res.count} שאלות ✓` : `שגיאת ייבוא: ${res.error}`);
      if (fileRef.current) fileRef.current.value = "";
      if (res.ok) router.refresh();
    });
  };

  const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setDraft(emptyDraft(nextPos)); setIsNew(true); setMsg(null); }}
          className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700"
        >
          + שאלה חדשה
        </button>
        <button onClick={doExport} disabled={pending} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          ייצוא CSV
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={pending} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          ייבוא CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); }}
        />
        {msg ? <span className="text-sm text-gray-600">{msg}</span> : null}
        {pending ? <span className="text-sm text-gray-400">עובד…</span> : null}
      </div>

      {/* Editor */}
      {draft ? (
        <div className="space-y-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-gray-600">
              מזהה (slug)
              <input
                className={input}
                value={draft.slug}
                disabled={!isNew}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              מיקום
              <input
                type="number"
                className={input}
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              סוג
              <select
                className={input}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionRow["type"] })}
              >
                <option value="likert5">likert5 (סולם)</option>
                <option value="reflection">reflection (פתוחה)</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              ממד
              <select
                className={input}
                value={draft.dimension_key ?? ""}
                disabled={draft.is_open}
                onChange={(e) => setDraft({ ...draft, dimension_key: e.target.value || null })}
              >
                <option value="">— ללא —</option>
                {dimensions.map((d) => (
                  <option key={d.key} value={d.key}>{d.he}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-gray-600">
            טקסט עברית
            <textarea className={input} rows={2} value={draft.text_he} onChange={(e) => setDraft({ ...draft, text_he: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            טקסט אנגלית
            <textarea className={input} rows={2} value={draft.text_en} onChange={(e) => setDraft({ ...draft, text_en: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            מקור בלומדות (slugs, מופרד ב-;)
            <input className={input} value={draft.source_slugs} onChange={(e) => setDraft({ ...draft, source_slugs: e.target.value })} />
          </label>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.reverse} onChange={(e) => setDraft({ ...draft, reverse: e.target.checked })} />
              ניקוד הפוך [הפוך]
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_open}
                onChange={(e) => setDraft({ ...draft, is_open: e.target.checked, type: e.target.checked ? "reflection" : draft.type, dimension_key: e.target.checked ? null : draft.dimension_key })}
              />
              שאלה פתוחה (לא מנוקדת)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
              פעילה
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={pending} className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60">
              שמירה
            </button>
            <button onClick={() => setDraft(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
              ביטול
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm" dir="rtl">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2 text-start">#</th>
              <th className="p-2 text-start">שאלה (עברית)</th>
              <th className="p-2 text-start">ממד</th>
              <th className="p-2 text-start">סוג</th>
              <th className="p-2 text-start">פעילה</th>
              <th className="p-2 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {initialQuestions.map((qrow) => (
              <tr key={qrow.slug} className="border-t border-gray-100">
                <td className="p-2 font-mono text-xs text-gray-400">{qrow.position}</td>
                <td className="p-2">
                  {qrow.text_he}
                  {qrow.is_open ? <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">פתוחה</span> : null}
                  {qrow.reverse ? <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">הפוך</span> : null}
                </td>
                <td className="p-2 text-gray-600">{dimLabel(qrow.dimension_key)}</td>
                <td className="p-2 font-mono text-xs text-gray-500">{qrow.type}</td>
                <td className="p-2">{qrow.is_active ? "✓" : "—"}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(qrow.slug, -1)} disabled={pending} title="למעלה" className="rounded px-1.5 py-0.5 hover:bg-gray-100">↑</button>
                    <button onClick={() => move(qrow.slug, 1)} disabled={pending} title="למטה" className="rounded px-1.5 py-0.5 hover:bg-gray-100">↓</button>
                    <button onClick={() => { setDraft({ ...qrow }); setIsNew(false); setMsg(null); }} className="rounded px-2 py-0.5 text-fuchsia-600 hover:bg-fuchsia-50">עריכה</button>
                    <button onClick={() => remove(qrow.slug)} disabled={pending} className="rounded px-2 py-0.5 text-rose-600 hover:bg-rose-50">מחיקה</button>
                  </div>
                </td>
              </tr>
            ))}
            {initialQuestions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  אין שאלות עדיין. הריצו את מיגרציה 109 לזריעה, או הוסיפו/ייבאו שאלות.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
