"use client";

import { useRef, useState, useMemo } from "react";
import { QuestionsTable, type QuestionTableRow } from "@/components/dashboard/QuestionsTable";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileDown, CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportSummary } from "@/app/dashboard/questions/import/route";

// ---------------------------------------------------------------------------
// Import result banner
// ---------------------------------------------------------------------------

type BannerProps = {
  summary: ImportSummary;
  onDismiss: () => void;
};

function ImportResultBanner({ summary, onDismiss }: BannerProps) {
  const allOk = summary.failed === 0;
  const partialFail = summary.failed > 0 && (summary.imported + summary.updated) > 0;
  const allFailed = summary.imported === 0 && summary.updated === 0;

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm ${
        allOk
          ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
          : partialFail
            ? "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
            : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      }`}
    >
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-2 font-medium">
        {allOk && <CheckCircle2 className="size-4 shrink-0" />}
        {partialFail && <AlertCircle className="size-4 shrink-0" />}
        {allFailed && <XCircle className="size-4 shrink-0" />}
        {allOk
          ? "Import complete"
          : partialFail
            ? "Import finished with warnings"
            : "Import failed"}
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <span>Total rows: <strong>{summary.total}</strong></span>
        <span>Imported: <strong>{summary.imported}</strong></span>
        <span>Updated: <strong>{summary.updated}</strong></span>
        {summary.failed > 0 && (
          <span>Failed / skipped: <strong>{summary.failed}</strong></span>
        )}
      </div>

      {summary.skipped.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs underline underline-offset-2">
            Show {summary.skipped.length} skipped row{summary.skipped.length !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 text-xs font-mono">
            {summary.skipped.map((e, i) => (
              <li key={i}>
                {e.row > 0 ? `Row ${e.row} [${e.field}]` : `[${e.field}]`}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page client
// ---------------------------------------------------------------------------

export function QuestionsPageClient({
  initialQuestions,
}: {
  initialQuestions: QuestionTableRow[];
}) {
  const [type, setType] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return initialQuestions.filter((q) => {
      if (type !== "all" && q.type !== type) return false;
      if (level !== "all" && q.level !== level) return false;
      return true;
    });
  }, [initialQuestions, type, level]);

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleImportClick() {
    setImportResult(null);
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so same file can be re-selected
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/dashboard/questions/import", {
        method: "POST",
        body,
      });

      const json = await res.json();

      if (!res.ok) {
        // Fatal / structural error
        const msg =
          json?.error ??
          (Array.isArray(json?.details)
            ? json.details.map((d: { message: string }) => d.message).join("; ")
            : "Import failed");
        setImportError(msg);
      } else {
        setImportResult(json as ImportSummary);
        // Refresh the page to show newly imported questions
        if ((json as ImportSummary).imported > 0 || (json as ImportSummary).updated > 0) {
          window.location.reload();
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error");
    } finally {
      setImporting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Filters + action bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="truth">Truth</SelectItem>
                <SelectItem value="dare">Dare</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v ?? "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="flirty">Flirty</SelectItem>
                <SelectItem value="deep">Deep</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Template download */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => {
              window.location.href = "/dashboard/questions/template";
            }}
          >
            <FileDown className="size-4" />
            Template
          </Button>

          {/* Import */}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleImportClick}
            disabled={importing}
          >
            <Upload className="size-4" />
            {importing ? "Importing…" : "Import CSV"}
          </Button>

          {/* Export */}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              window.location.href = "/dashboard/questions/export";
            }}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import error (fatal / structural) */}
      {importError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Import error</p>
            <p className="mt-0.5">{importError}</p>
          </div>
          <button
            onClick={() => setImportError(null)}
            className="opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Import result summary */}
      {importResult && (
        <ImportResultBanner
          summary={importResult}
          onDismiss={() => setImportResult(null)}
        />
      )}

      <QuestionsTable
        gameId={null}
        initialQuestions={filtered}
        mode="global"
      />
    </div>
  );
}
