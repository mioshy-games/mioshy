"use client";

/**
 * Admin CMS for the JOURNEY questionnaire (table: journey_questions).
 * Sibling of components/dashboard/assessments/QuestionsManager.tsx.
 *
 * EDITABLE:  he/en text, type, domain, phase (short|full), position/reorder,
 *            is_active, reflection placeholder, choice option LABELS.
 * LOCKED (read-only): axes + weights, per-option scores (🔒). Scoring changes
 *            go through CSV import only.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  upsertJourneyQuestion,
  toggleActiveJourneyQuestion,
  deleteJourneyQuestion,
  reorderJourneyQuestion,
  exportJourneyQuestionsCsv,
  importJourneyQuestionsCsv,
  getJourneyResponseCount,
  type JourneyQuestionRow,
  type JourneyQuestionInput,
  type Phase,
} from "@/app/dashboard/journey-questions/actions";

interface Props {
  initialQuestions: JourneyQuestionRow[];
}

// Friendly Hebrew labels; the STORED value is always the technical type.
const TYPE_LABELS: Record<string, string> = {
  likert5: "דירוג 1–5",
  single_choice: "בחירה מרשימה",
  forced_choice: "בחירה (דמוגרפי)",
  multi_choice: "בחירה מרובה",
  reflection: "טקסט פתוח",
  ranking: "דירוג חשיבות",
};
const TYPE_ORDER = ["likert5", "single_choice", "forced_choice", "multi_choice", "reflection", "ranking"];

const DOMAIN_LABELS: Record<string, string> = {
  communication: "תקשורת",
  intimacy: "אינטימיות",
  emotional_connection: "חיבור רגשי",
  friendship: "חברות",
  family: "משפחה",
};

const isChoice = (t: string) =>
  t === "single_choice" || t === "forced_choice" || t === "multi_choice";

type Draft = JourneyQuestionRow;

function emptyDraft(nextPos: number): Draft {
  return {
    slug: "",
    position: nextPos,
    phase: "full",
    type: "likert5",
    domain: null,
    axes: [],
    reverse: false,
    he_text: "",
    en_text: "",
    options: null,
    meta: null,
    is_active: true,
  };
}

function weightLabel(w: number): string {
  if (w === 1) return "×1";
  if (w === -1) return "×−1";
  return `×${w}`;
}

export function JourneyQuestionsManager({ initialQuestions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Phase | "inactive">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const nextPos = (initialQuestions.at(-1)?.position ?? -1) + 1;

  const shown = initialQuestions.filter((q) =>
    filter === "all"
      ? true
      : filter === "inactive"
        ? !q.is_active
        : q.is_active && q.phase === filter,
  );
  const counts = {
    all: initialQuestions.length,
    short: initialQuestions.filter((q) => q.is_active && q.phase === "short").length,
    full: initialQuestions.filter((q) => q.is_active && q.phase === "full").length,
    inactive: initialQuestions.filter((q) => !q.is_active).length,
  };

  const save = () => {
    if (!draft) return;
    const input: JourneyQuestionInput = {
      slug: draft.slug,
      position: draft.position,
      phase: draft.phase,
      type: draft.type,
      domain: draft.domain,
      he_text: draft.he_text,
      en_text: draft.en_text,
      is_active: draft.is_active,
      placeholder_he: draft.meta?.placeholder_he ?? "",
      placeholder_en: draft.meta?.placeholder_en ?? "",
      optionLabels: draft.options?.map((o) => ({ id: o.id, he: o.he, en: o.en })),
    };
    startTransition(async () => {
      const res = await upsertJourneyQuestion(input);
      if (res.ok) {
        setMsg("נשמר ✓");
        setDraft(null);
        router.refresh();
      } else setMsg(`שגיאה: ${res.error}`);
    });
  };

  const toggleActive = (slug: string, makeActive: boolean) => {
    startTransition(async () => {
      const res = await toggleActiveJourneyQuestion(slug, makeActive);
      setMsg(res.ok ? (makeActive ? "הופעלה ✓" : "הושבתה ✓") : `שגיאה: ${res.error}`);
      if (res.ok) router.refresh();
    });
  };

  const hardDelete = (slug: string) => {
    startTransition(async () => {
      const { count } = await getJourneyResponseCount(slug);
      const warn =
        count > 0
          ? `\n\n⚠️ ${count} תגובות היסטוריות מפנות לשאלה הזו. המחיקה לא תמחק את התגובות, אבל הגדרת השאלה תיעלם.`
          : "";
      const ok = confirm(
        `מחיקה לצמיתות של "${slug}" — לא ניתן לבטל.${warn}\n\nלהשבתה הפיכה השתמשו ב"השבת". להמשיך במחיקה?`,
      );
      if (!ok) return;
      const res = await deleteJourneyQuestion(slug);
      setMsg(res.ok ? "נמחקה לצמיתות ✓" : `שגיאה: ${res.error}`);
      if (res.ok) router.refresh();
    });
  };

  const move = (slug: string, dir: -1 | 1) => {
    startTransition(async () => {
      await reorderJourneyQuestion(slug, dir);
      router.refresh();
    });
  };

  const doExport = () => {
    startTransition(async () => {
      const csv = await exportJourneyQuestionsCsv();
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "journey-questions.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    startTransition(async () => {
      const res = await importJourneyQuestionsCsv(text);
      setMsg(res.ok ? `יובאו ${res.count} שאלות ✓` : `שגיאת ייבוא: ${res.error}`);
      if (fileRef.current) fileRef.current.value = "";
      if (res.ok) router.refresh();
    });
  };

  const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4" dir="rtl">
      {/* Scoring-lock note */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-gray-600">
        <span>🔒</span>
        <div>
          ניתן לערוך: טקסט (עב/אנ), תוויות תשובות, <b>שלב</b>, סוג, תחום, סדר, והפעלה/השבתה.{" "}
          <b>ניקוד (צירים, משקלים, ניקוד-תשובה) נעול</b> כדי לשמור על תקפות האבחון — לשינוי השתמשו בייבוא CSV.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setDraft(emptyDraft(nextPos)); setIsNew(true); setMsg(null); }}
          className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700"
        >
          + שאלה חדשה (מלא)
        </button>
        <button onClick={doExport} disabled={pending} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          ייצוא CSV
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={pending} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          ייבוא CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); }} />

        <div className="ms-auto flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          {([
            ["all", `הכל · ${counts.all}`],
            ["short", `קצר · ${counts.short}`],
            ["full", `מלא · ${counts.full}`],
            ["inactive", `מושבתות · ${counts.inactive}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 font-semibold ${filter === key ? "bg-white text-fuchsia-600 shadow-sm" : "text-gray-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {msg ? <span className="text-sm text-gray-600">{msg}</span> : null}
        {pending ? <span className="text-sm text-gray-400">עובד…</span> : null}
      </div>

      {/* Editor */}
      {draft ? (
        <div className="space-y-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-gray-600">
              מזהה (slug)
              <input className={input} value={draft.slug} disabled={!isNew} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              מיקום
              <input type="number" className={input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              סוג
              <select className={input} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              תחום
              <select className={input} value={draft.domain ?? ""} onChange={(e) => setDraft({ ...draft, domain: e.target.value || null })}>
                <option value="">— ללא —</option>
                {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Phase toggle */}
          <div>
            <div className="text-xs font-semibold text-gray-600">שלב (לפני / אחרי רכישה)</div>
            <div className="mt-1 inline-flex overflow-hidden rounded-md border border-gray-300 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, phase: "short" })}
                className={`px-4 py-1.5 ${draft.phase === "short" ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-500"}`}
              >
                קצר · לפני רכישה
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, phase: "full" })}
                className={`px-4 py-1.5 ${draft.phase === "full" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-white text-gray-500"}`}
              >
                מלא · אחרי רכישה
              </button>
            </div>
          </div>

          <label className="block text-xs font-semibold text-gray-600">
            טקסט עברית
            <textarea className={input} dir="rtl" rows={2} value={draft.he_text} onChange={(e) => setDraft({ ...draft, he_text: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            טקסט אנגלית
            <textarea className={input} dir="ltr" rows={2} value={draft.en_text} onChange={(e) => setDraft({ ...draft, en_text: e.target.value })} />
          </label>

          {/* Reflection placeholder (only for reflection) */}
          {draft.type === "reflection" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                placeholder עברית
                <input className={input} dir="rtl" value={draft.meta?.placeholder_he ?? ""} onChange={(e) => setDraft({ ...draft, meta: { ...(draft.meta ?? {}), placeholder_he: e.target.value } })} />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                placeholder אנגלית
                <input className={input} dir="ltr" value={draft.meta?.placeholder_en ?? ""} onChange={(e) => setDraft({ ...draft, meta: { ...(draft.meta ?? {}), placeholder_en: e.target.value } })} />
              </label>
            </div>
          ) : null}

          {/* Choice option LABELS editor (he/en editable; scores LOCKED) */}
          {isChoice(draft.type) && draft.options && draft.options.length > 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
              <div className="text-xs font-semibold text-gray-700">תשובות — תוויות פתוחות לעריכה · ניקוד 🔒 נעול</div>
              <div className="mt-2 space-y-2">
                {draft.options.map((o, i) => (
                  <div key={o.id} className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-400">🔒 {o.id}</span>
                    <input
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      dir="rtl"
                      value={o.he}
                      onChange={(e) => {
                        const next = [...draft.options!];
                        next[i] = { ...o, he: e.target.value };
                        setDraft({ ...draft, options: next });
                      }}
                    />
                    <input
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      dir="ltr"
                      value={o.en}
                      onChange={(e) => {
                        const next = [...draft.options!];
                        next[i] = { ...o, en: e.target.value };
                        setDraft({ ...draft, options: next });
                      }}
                    />
                    <span className="rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] text-zinc-500">
                      🔒 {o.scores.map((s) => `${s.axis} ${weightLabel(s.weight)}`).join(", ") || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Locked axes (read-only) */}
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
            <div className="text-xs font-semibold text-gray-700">🔒 ניקוד — לקריאה בלבד</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.axes.length > 0 ? (
                draft.axes.map((a) => (
                  <span key={a.axis} className="rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-600">
                    🔒 {a.axis} <b className={a.weight < 0 ? "text-rose-600" : "text-gray-900"}>{weightLabel(a.weight)}</b>
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-gray-400">לא מנוקדת</span>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            פעילה
          </label>

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
              <th className="p-2 text-start">שאלה</th>
              <th className="p-2 text-start">תחום</th>
              <th className="p-2 text-start">ניקוד (נעול)</th>
              <th className="p-2 text-start">שלב</th>
              <th className="p-2 text-start">פעילה</th>
              <th className="p-2 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((qrow) => (
              <tr key={qrow.slug} className={`border-t border-gray-100 ${qrow.is_active ? "" : "bg-gray-50 text-gray-400"}`}>
                <td className="p-2 font-mono text-xs text-gray-400">{qrow.position}</td>
                <td className="p-2">
                  {qrow.he_text}
                  {qrow.reverse ? <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">משקל שלילי</span> : null}
                  {qrow.type === "reflection" ? <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">פתוחה</span> : null}
                  <div className="mt-0.5 font-mono text-[11px] text-gray-400">{qrow.slug} · {TYPE_LABELS[qrow.type] ?? qrow.type}</div>
                </td>
                <td className="p-2 text-gray-600">{qrow.domain ? DOMAIN_LABELS[qrow.domain] ?? qrow.domain : "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {qrow.axes.length > 0 ? (
                      qrow.axes.map((a) => (
                        <span key={a.axis} className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                          🔒 {a.axis} <b className={a.weight < 0 ? "text-rose-600" : "text-gray-900"}>{weightLabel(a.weight)}</b>
                        </span>
                      ))
                    ) : qrow.options && qrow.options.some((o) => o.scores.length > 0) ? (
                      <span className="font-mono text-[10px] text-zinc-500">🔒 ניקוד לפי תשובה</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${qrow.phase === "short" ? "bg-emerald-100 text-emerald-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>
                    {qrow.phase === "short" ? "קצר" : "מלא"}
                  </span>
                </td>
                <td className="p-2">{qrow.is_active ? "✓" : "—"}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(qrow.slug, -1)} disabled={pending} title="למעלה" className="rounded px-1.5 py-0.5 hover:bg-gray-100">↑</button>
                    <button onClick={() => move(qrow.slug, 1)} disabled={pending} title="למטה" className="rounded px-1.5 py-0.5 hover:bg-gray-100">↓</button>
                    <button onClick={() => { setDraft({ ...qrow }); setIsNew(false); setMsg(null); }} className="rounded px-2 py-0.5 text-fuchsia-600 hover:bg-fuchsia-50">עריכה</button>
                    {qrow.is_active ? (
                      <button onClick={() => toggleActive(qrow.slug, false)} disabled={pending} className="rounded px-2 py-0.5 text-amber-700 hover:bg-amber-50">השבת</button>
                    ) : (
                      <button onClick={() => toggleActive(qrow.slug, true)} disabled={pending} className="rounded px-2 py-0.5 text-emerald-700 hover:bg-emerald-50">הפעל</button>
                    )}
                    <button onClick={() => hardDelete(qrow.slug)} disabled={pending} className="rounded px-2 py-0.5 text-rose-600 hover:bg-rose-50">מחק</button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">אין שאלות בתצוגה הזו.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
