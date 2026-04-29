"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  downloadCsv,
  mergeQuestions,
  parseCsvQuestions,
  questionsToCsv,
  type CsvQuestion,
  type CsvValidationError,
} from "@/lib/csv-questions";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ImportMode = "merge" | "replace";

type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; incoming: CsvQuestion[]; mode: ImportMode }
  | { phase: "errors"; errors: CsvValidationError[] };

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface Props {
  configId: string;
  configName: string;
  questions: CsvQuestion[];
  onSave: (next: CsvQuestion[]) => Promise<void>;
}

export function CsvImportExport({ configId, configName, questions, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Export ──────────────────────────────────

  function handleExport() {
    if (questions.length === 0) {
      toast.error("אין שאלות לייצוא");
      return;
    }
    const csv = questionsToCsv(questions);
    const safeName = configName.replace(/[^a-z0-9_\u0590-\u05FF]/gi, "_");
    downloadCsv(csv, `questions_${safeName}_${configId.slice(0, 6)}.csv`);
    toast.success(`${questions.length} שאלות יוצאו ל-CSV`);
  }

  // ── File handling ───────────────────────────

  function processFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("יש להעלות קובץ CSV בלבד");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCsvQuestions(text);

      if (!result.ok) {
        setState({ phase: "errors", errors: result.errors });
        return;
      }

      setState({
        phase: "preview",
        incoming: result.questions,
        mode: "merge",
      });
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Confirm import ──────────────────────────

  async function confirmImport() {
    if (state.phase !== "preview") return;

    const { incoming, mode } = state;

    let next: CsvQuestion[];
    if (mode === "replace") {
      next = incoming;
    } else {
      next = mergeQuestions(questions, incoming);
    }

    setBusy(true);
    try {
      await onSave(next);
      toast.success(
        mode === "replace"
          ? `הוחלפו ${next.length} שאלות`
          : `עודכנו/נוספו ${incoming.length} שאלות (סה"כ ${next.length})`,
      );
      setState({ phase: "idle" });
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ──────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleExport}>
          📤 ייצוא CSV ({questions.length} שאלות)
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setState({ phase: "idle" });
            fileRef.current?.click();
          }}
        >
          📥 ייבוא CSV
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drag & Drop zone (visible only in idle state) */}
      {state.phase === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex min-h-[80px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed text-sm transition-colors ${
            dragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/30 text-muted-foreground"
          }`}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        >
          גרור קובץ CSV לכאן, או לחץ לבחירה
        </div>
      )}

      {/* Validation errors */}
      {state.phase === "errors" && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-destructive">
              ⚠️ נמצאו {state.errors.length} שגיאות — הייבוא לא בוצע
            </p>
            <Button size="sm" variant="ghost" onClick={() => setState({ phase: "idle" })}>
              סגור
            </Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border text-sm">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">שורה</th>
                  <th className="px-3 py-2 text-left font-semibold">שדה</th>
                  <th className="px-3 py-2 text-left font-semibold">שגיאה</th>
                </tr>
              </thead>
              <tbody>
                {state.errors.map((err, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 font-mono">{err.row}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{err.field}</td>
                    <td className="px-3 py-1.5">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            נסה קובץ אחר
          </Button>
        </div>
      )}

      {/* Preview + Confirm */}
      {state.phase === "preview" && (
        <div className="rounded-2xl border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              תצוגה מקדימה — {state.incoming.length} שאלות בקובץ
            </p>
            <Button size="sm" variant="ghost" onClick={() => setState({ phase: "idle" })}>
              ביטול
            </Button>
          </div>

          {/* Mode selector */}
          <div className="flex gap-3">
            <ModeButton
              active={state.mode === "merge"}
              onClick={() =>
                setState((s) => s.phase === "preview" ? { ...s, mode: "merge" } : s)
              }
              label="Merge"
              description="עדכן קיים + הוסף חדש (מומלץ)"
            />
            <ModeButton
              active={state.mode === "replace"}
              onClick={() =>
                setState((s) => s.phase === "preview" ? { ...s, mode: "replace" } : s)
              }
              label="Replace All"
              description="מחק הכל והחלף בקובץ"
              danger
            />
          </div>

          {/* Stats */}
          {state.mode === "merge" && (
            <PreviewStats existing={questions} incoming={state.incoming} />
          )}

          {/* Preview table */}
          <div className="max-h-72 overflow-auto rounded-xl border text-sm">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">סוג</th>
                  <th className="px-3 py-2 text-left font-semibold">רמה</th>
                  <th className="px-3 py-2 text-right font-semibold">עברית</th>
                  <th className="px-3 py-2 text-left font-semibold">English</th>
                  <th className="px-3 py-2 text-left font-semibold">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {state.incoming.map((q) => (
                  <tr key={q.id} className="border-t">
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          q.type === "challenge"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {q.type === "challenge" ? "אתגר" : "שאלה"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          (q.level ?? 1) === 3
                            ? "bg-red-100 text-red-700"
                            : (q.level ?? 1) === 2
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {(q.level ?? 1) === 1 ? "קליל" : (q.level ?? 1) === 2 ? "בינוני" : "מאתגר"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate text-right" dir="rtl">
                      {q.text_he}
                    </td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate" dir="ltr">
                      {q.text_en}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{q.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button disabled={busy} onClick={confirmImport}>
              {busy ? "שומר..." : `אישור ייבוא (${state.mode === "replace" ? "החלפה" : "מיזוג"})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  label,
  description,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border p-3 text-left text-sm transition-colors ${
        active
          ? danger
            ? "border-destructive bg-destructive/10"
            : "border-primary bg-primary/10"
          : "bg-background hover:bg-muted"
      }`}
    >
      <div className={`font-semibold ${danger && active ? "text-destructive" : ""}`}>{label}</div>
      <div className="text-muted-foreground text-xs">{description}</div>
    </button>
  );
}

function PreviewStats({
  existing,
  incoming,
}: {
  existing: CsvQuestion[];
  incoming: CsvQuestion[];
}) {
  const existingIds = new Set(existing.map((q) => q.id));
  const toUpdate = incoming.filter((q) => existingIds.has(q.id)).length;
  const toAdd = incoming.filter((q) => !existingIds.has(q.id)).length;

  return (
    <div className="flex gap-4 text-sm">
      <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">
        🔄 עדכון: {toUpdate}
      </span>
      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
        ➕ חדש: {toAdd}
      </span>
    </div>
  );
}
