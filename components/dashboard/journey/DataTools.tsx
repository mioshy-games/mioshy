"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileDown, CheckCircle2, AlertCircle, XCircle, X } from "lucide-react";
import type { JourneyImportSummary } from "@/app/dashboard/journey/import/route";

// ── Import result modal ───────────────────────────────────────────────────────

function ResultModal({
  summary,
  onClose,
}: {
  summary: JourneyImportSummary;
  onClose: () => void;
}) {
  const allOk = summary.failed === 0;
  const partial = summary.failed > 0 && (summary.created + summary.updated) > 0;
  const allFailed = summary.created === 0 && summary.updated === 0;

  const kindLabel = summary.kind.charAt(0).toUpperCase() + summary.kind.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border-border relative w-full max-w-lg rounded-2xl border shadow-xl">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground absolute right-4 top-4 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="border-b border-border p-5 pb-4">
          <div className="flex items-center gap-2">
            {allOk && <CheckCircle2 className="size-5 text-green-500" />}
            {partial && <AlertCircle className="size-5 text-yellow-500" />}
            {allFailed && <XCircle className="size-5 text-red-500" />}
            <h2 className="text-base font-semibold">
              {allOk
                ? `${kindLabel} import complete`
                : partial
                  ? `${kindLabel} import finished with warnings`
                  : `${kindLabel} import failed`}
            </h2>
          </div>
        </div>

        {/* Stats */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: "Total rows", value: summary.total },
              { label: "Created", value: summary.created, green: summary.created > 0 },
              { label: "Updated", value: summary.updated, blue: summary.updated > 0 },
              { label: "Failed", value: summary.failed, red: summary.failed > 0 },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-lg border border-border p-3 ${
                  s.red ? "border-red-200/50 bg-red-500/10" :
                  s.green ? "border-green-200/50 bg-green-500/10" :
                  s.blue ? "border-blue-200/50 bg-blue-500/10" : ""
                }`}
              >
                <div className={`text-xl font-bold ${s.red ? "text-red-400" : s.green ? "text-green-400" : s.blue ? "text-blue-400" : ""}`}>
                  {s.value}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Skipped rows detail */}
          {summary.skipped.length > 0 && (
            <details className="rounded-lg border border-border overflow-hidden">
              <summary className="cursor-pointer bg-muted/30 px-4 py-2 text-sm font-medium select-none hover:bg-muted/50 transition-colors">
                {summary.skipped.length} skipped / failed row{summary.skipped.length !== 1 ? "s" : ""} - click to expand
              </summary>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border text-xs font-mono">
                {summary.skipped.map((e, i) => (
                  <li key={i} className="px-4 py-1.5 flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {e.row > 0 ? `row ${e.row}` : ""}
                    </span>
                    <span className="text-destructive font-semibold shrink-0">[{e.field}]</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Note about assignments */}
          {summary.kind === "programs" && summary.created > 0 && (
            <p className="text-muted-foreground text-xs border-l-2 border-fuchsia-500 pl-3">
              Next: import <strong>categories.csv</strong> then <strong>items.csv</strong>.
              Assignments must be created via{" "}
              <a href="/dashboard/journey/assignments/new" className="underline hover:text-foreground">
                Assign to owner
              </a>.
            </p>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 flex justify-end">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main DataTools component ──────────────────────────────────────────────────

export function JourneyDataTools() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<JourneyImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleImportClick() {
    setImportResult(null);
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/dashboard/journey/import", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setImportError(json?.error ?? "Import failed");
      } else {
        setImportResult(json as JourneyImportSummary);
        // Refresh page if something was written
        const s = json as JourneyImportSummary;
        if (s.created > 0 || s.updated > 0) {
          // Soft refresh after user closes the modal
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error");
    } finally {
      setImporting(false);
    }
  }

  function handleModalClose() {
    const hadChanges =
      importResult && (importResult.created > 0 || importResult.updated > 0);
    setImportResult(null);
    if (hadChanges) window.location.reload();
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Button group */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Templates */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => { window.location.href = "/dashboard/journey/template"; }}
        >
          <FileDown className="size-4" />
          Templates
        </Button>

        {/* Import */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={importing}
          onClick={handleImportClick}
        >
          <Upload className="size-4" />
          {importing ? "Importing…" : "Import CSV"}
        </Button>

        {/* Export */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => { window.location.href = "/dashboard/journey/export"; }}
        >
          <Download className="size-4" />
          Export ZIP
        </Button>
      </div>

      {/* Inline import error (structural/auth errors) */}
      {importError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">{importError}</span>
          <button onClick={() => setImportError(null)} aria-label="Dismiss">
            <X className="size-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Result modal */}
      {importResult && (
        <ResultModal summary={importResult} onClose={handleModalClose} />
      )}
    </>
  );
}
