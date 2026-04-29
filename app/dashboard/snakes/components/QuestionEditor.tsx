"use client";

import { useMemo, useState } from "react";
import type { Question, QuestionLevel, SnakesConfig } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateSnakesConfig } from "@/app/dashboard/actions/snakes";
import { CsvImportExport } from "./CsvImportExport";
import type { CsvQuestion } from "@/lib/csv-questions";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────

function makeId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

const LEVEL_OPTIONS: { value: QuestionLevel; label: string; color: string }[] = [
  { value: 1, label: "1 — קליל",   color: "bg-green-100 text-green-700 border-green-300" },
  { value: 2, label: "2 — בינוני", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: 3, label: "3 — מאתגר",  color: "bg-red-100 text-red-700 border-red-300" },
];

const LEVEL_BADGE: Record<number, string> = {
  1: "bg-green-100 text-green-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-red-100 text-red-700",
};

const LEVEL_LABEL: Record<number, string> = {
  1: "קליל",
  2: "בינוני",
  3: "מאתגר",
};

const CATEGORY_OPTIONS = [
  { value: "love",      label: "❤️ אהבה" },
  { value: "dreams",    label: "✨ חלומות" },
  { value: "memories",  label: "📸 זיכרונות" },
  { value: "physical",  label: "💪 פיזי" },
  { value: "emotional", label: "🫂 רגשי" },
  { value: "fun",       label: "🎉 כיף" },
  { value: "custom",    label: "⚙️ מותאם אישית" },
] as const;

type Category = (typeof CATEGORY_OPTIONS)[number]["value"];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map(({ value, label }) => [value, label]),
);

// ── Main component ─────────────────────────────────────────────────────────

export function QuestionEditor({ cfg }: { cfg: SnakesConfig }) {
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<Question["type"] | "all">("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<QuestionLevel | "all">("all");

  // Add-form state
  const [addType, setAddType] = useState<Question["type"]>("question");
  const [addTextHe, setAddTextHe] = useState("");
  const [addTextEn, setAddTextEn] = useState("");
  const [addCategory, setAddCategory] = useState<Category>("love");
  const [addLevel, setAddLevel] = useState<QuestionLevel>(1);

  const questions = useMemo(() => cfg.questions ?? [], [cfg.questions]);

  // ── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const byType = questions.reduce(
      (acc, q) => {
        acc[q.type] = (acc[q.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const byLevel = questions.reduce(
      (acc, q) => {
        const l = q.level ?? 1;
        acc[l] = (acc[l] ?? 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );
    const cats = new Set(questions.map((q) => q.category)).size;
    return { total: questions.length, byType, byLevel, cats };
  }, [questions]);

  // ── Filtered view ──────────────────────────────────────────────────────

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterCat !== "all" && item.category !== filterCat) return false;
      if (filterLevel !== "all" && (item.level ?? 1) !== filterLevel) return false;
      if (q && !item.text_he.toLowerCase().includes(q) && !item.text_en?.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [questions, search, filterType, filterCat, filterLevel]);

  // ── Persistence ────────────────────────────────────────────────────────

  async function save(next: Question[]) {
    setBusy(true);
    const res = await updateSnakesConfig(cfg.id, { questions: next as unknown[] });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else toast.success("נשמר ✓");
  }

  async function saveFromCsv(next: CsvQuestion[]) {
    await save(next as unknown as Question[]);
  }

  // ── Add ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!addTextHe.trim()) {
      toast.error("טקסט עברי הוא שדה חובה");
      return;
    }
    const q: Question = {
      id: makeId(),
      type: addType,
      text_he: addTextHe.trim(),
      text_en: addTextEn.trim() || addTextHe.trim(), // fall back to HE if EN empty
      category: addCategory,
      level: addLevel,
    };
    await save([q, ...questions]);
    setAddTextHe("");
    setAddTextEn("");
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    await save(questions.filter((q) => q.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 font-semibold">
          סה״כ {stats.total}
        </span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 font-semibold">
          שאלות {stats.byType["question"] ?? 0}
        </span>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700 font-semibold">
          אתגרות {stats.byType["challenge"] ?? 0}
        </span>
        <span className="rounded-full bg-green-100 px-3 py-1 text-green-700 font-semibold">
          קליל {stats.byLevel[1] ?? 0}
        </span>
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700 font-semibold">
          בינוני {stats.byLevel[2] ?? 0}
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700 font-semibold">
          מאתגר {stats.byLevel[3] ?? 0}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {stats.cats} קטגוריות
        </span>
        {stats.total < 5 && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700 font-semibold">
            ⚠️ מומלץ לפחות 5 שאלות
          </span>
        )}
      </div>

      {/* ── CSV Import / Export ───────────────────────────────────────── */}
      <details className="group rounded-2xl border">
        <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm font-semibold list-none">
          <span>📊 ייצוא / ייבוא CSV</span>
          <span className="text-muted-foreground text-xs group-open:hidden">▼ פתח</span>
          <span className="text-muted-foreground text-xs hidden group-open:block">▲ סגור</span>
        </summary>
        <div className="border-t px-4 py-4">
          <CsvImportExport
            configId={cfg.id}
            configName={cfg.name}
            questions={questions as unknown as CsvQuestion[]}
            onSave={saveFromCsv}
          />
        </div>
      </details>

      {/* ── Add question ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm font-bold">➕ הוספת שאלה / אתגר</div>

        {/* Type toggle */}
        <div className="flex gap-2">
          <TypeButton active={addType === "question"} onClick={() => setAddType("question")}>
            שאלה
          </TypeButton>
          <TypeButton active={addType === "challenge"} danger onClick={() => setAddType("challenge")}>
            אתגר
          </TypeButton>
        </div>

        {/* Category + Level row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">קטגוריה</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value as Category)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">דרגת קושי</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={addLevel}
              onChange={(e) => setAddLevel(Number(e.target.value) as QuestionLevel)}
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hebrew text (required) */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            עברית <span className="text-destructive">*</span>
          </div>
          <Textarea
            dir="rtl"
            rows={2}
            placeholder="כתוב כאן את השאלה / האתגר…"
            value={addTextHe}
            onChange={(e) => setAddTextHe(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* English text (optional) */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground list-none hover:text-foreground">
            + הוסף תרגום לאנגלית (אופציונלי)
          </summary>
          <div className="mt-2 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">English</div>
            <Textarea
              dir="ltr"
              rows={2}
              placeholder="English version (auto-fills from Hebrew if left empty)"
              value={addTextEn}
              onChange={(e) => setAddTextEn(e.target.value)}
              className="resize-none"
            />
          </div>
        </details>

        <div className="flex justify-end">
          <Button disabled={busy || !addTextHe.trim()} onClick={handleAdd}>
            {busy ? "שומר..." : "הוסף"}
          </Button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          dir="rtl"
          placeholder="חיפוש…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        {/* Type filter */}
        <div className="flex gap-1">
          {(["all", "question", "challenge"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filterType === t
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-foreground",
              )}
            >
              {t === "all" ? "הכל" : t === "question" ? "שאלות" : "אתגרות"}
            </button>
          ))}
        </div>
        {/* Level filter */}
        <div className="flex gap-1">
          {(["all", 1, 2, 3] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setFilterLevel(l)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filterLevel === l
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-foreground",
              )}
            >
              {l === "all" ? "כל הרמות" : LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <select
          className="h-8 rounded-full border bg-background px-3 text-xs"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="all">כל הקטגוריות</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {(search || filterType !== "all" || filterCat !== "all" || filterLevel !== "all") && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(""); setFilterType("all"); setFilterCat("all"); setFilterLevel("all"); }}
          >
            ✕ נקה
          </button>
        )}
        <span className="text-xs text-muted-foreground mr-auto">
          {visible.length !== questions.length ? `${visible.length} / ${questions.length}` : `${questions.length} שאלות`}
        </span>
      </div>

      {/* ── Questions list ────────────────────────────────────────────── */}
      <div className="rounded-2xl border divide-y overflow-hidden">
        {visible.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {questions.length === 0 ? "אין שאלות עדיין. הוסף שאלה ראשונה למעלה." : "אין תוצאות לסינון הנוכחי."}
          </div>
        )}
        {visible.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            isEditing={editingId === q.id}
            busy={busy}
            onEdit={() => setEditingId(editingId === q.id ? null : q.id)}
            onSave={async (updated) => {
              await save(questions.map((x) => (x.id === updated.id ? updated : x)));
              setEditingId(null);
            }}
            onDelete={() => void handleDelete(q.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── QuestionRow ────────────────────────────────────────────────────────────

function QuestionRow({
  question,
  isEditing,
  busy,
  onEdit,
  onSave,
  onDelete,
}: {
  question: Question;
  isEditing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (q: Question) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Question>(question);

  // Keep draft in sync if the parent updates the question (e.g. after CSV import)
  useMemo(() => { setDraft(question); }, [question]);

  if (isEditing) {
    return (
      <div className="p-4 space-y-3 bg-muted/30" dir="rtl">
        {/* Type + Category + Level */}
        <div className="flex flex-wrap gap-2 items-center">
          <TypeButton
            active={draft.type === "question"}
            onClick={() => setDraft((d) => ({ ...d, type: "question" }))}
          >
            שאלה
          </TypeButton>
          <TypeButton
            active={draft.type === "challenge"}
            danger
            onClick={() => setDraft((d) => ({ ...d, type: "challenge" }))}
          >
            אתגר
          </TypeButton>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={draft.level ?? 1}
            onChange={(e) => setDraft((d) => ({ ...d, level: Number(e.target.value) as QuestionLevel }))}
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Hebrew */}
        <Textarea
          dir="rtl"
          rows={2}
          value={draft.text_he}
          onChange={(e) => setDraft((d) => ({ ...d, text_he: e.target.value }))}
          className="resize-none"
          placeholder="עברית"
        />

        {/* English (optional) */}
        <Textarea
          dir="ltr"
          rows={2}
          value={draft.text_en}
          onChange={(e) => setDraft((d) => ({ ...d, text_en: e.target.value }))}
          className="resize-none text-sm"
          placeholder="English (optional)"
        />

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            ביטול
          </Button>
          <Button
            size="sm"
            disabled={busy || !draft.text_he.trim()}
            onClick={async () => {
              await onSave({
                ...draft,
                text_he: draft.text_he.trim(),
                text_en: draft.text_en?.trim() || draft.text_he.trim(),
              });
            }}
          >
            {busy ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  const level = question.level ?? 1;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
    >
      {/* Type badge */}
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
          question.type === "challenge"
            ? "bg-purple-100 text-purple-700"
            : "bg-blue-100 text-blue-700",
        )}
      >
        {question.type === "challenge" ? "אתגר" : "שאלה"}
      </span>

      {/* Level badge */}
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
          LEVEL_BADGE[level],
        )}
      >
        {LEVEL_LABEL[level]}
      </span>

      {/* Main text */}
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-snug line-clamp-2" dir="rtl">
          {question.text_he}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {CATEGORY_LABEL[question.category] ?? question.category}
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="rounded-lg border border-transparent px-2 py-1 text-xs hover:border-border hover:bg-background"
          onClick={onEdit}
        >
          עריכה
        </button>
        <button
          type="button"
          className="rounded-lg border border-transparent px-2 py-1 text-xs text-destructive hover:border-destructive/30 hover:bg-destructive/5"
          onClick={onDelete}
        >
          מחיקה
        </button>
      </div>
    </div>
  );
}

// ── TypeButton ─────────────────────────────────────────────────────────────

function TypeButton({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors",
        active
          ? danger
            ? "border-purple-500 bg-purple-100 text-purple-800"
            : "border-blue-500 bg-blue-100 text-blue-800"
          : "border-border bg-background text-muted-foreground hover:border-foreground",
      )}
    >
      {children}
    </button>
  );
}
