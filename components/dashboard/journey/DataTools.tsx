"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Upload,
  FileDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
} from "lucide-react";
import type {
  JourneyImportSummary,
  EntityCounts,
} from "@/app/dashboard/journey/import/route";

// ── Import result modal ─────────────────────────────────────────────────────
//
// Phase 2 shape: a 4-entity matrix plus three error/warning sections. The
// route always returns counts for every entity; only the entity matching
// `summary.kind` has non-zero numbers. The matrix shows all four anyway so
// the admin sees at a glance which file got applied.

const ENTITY_ORDER = ["programs", "categories", "subtopics", "items"] as const;

function entityTotal(c: EntityCounts): number {
  return c.created + c.updated + c.skipped + c.failed;
}

function ResultModal({
  summary,
  onClose,
}: {
  summary: JourneyImportSummary;
  onClose: () => void;
}) {
  const totals = ENTITY_ORDER.reduce(
    (acc, k) => {
      const c = summary.summary[k];
      acc.created += c.created;
      acc.updated += c.updated;
      acc.skipped += c.skipped;
      acc.failed += c.failed;
      return acc;
    },
    { created: 0, updated: 0, skipped: 0, failed: 0 },
  );
  const totalWrites = totals.created + totals.updated;
  const totalFailed = totals.failed + summary.parseErrors.length + summary.failures.length;

  const allOk = totalFailed === 0;
  const partial = totalFailed > 0 && totalWrites > 0;
  const allFailed = totalWrites === 0;

  const kindLabel = summary.kind
    ? summary.kind.charAt(0).toUpperCase() + summary.kind.slice(1)
    : "Catalog";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border-border relative w-full max-w-2xl rounded-2xl border shadow-xl max-h-[90vh] overflow-y-auto">
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

        <div className="p-5 space-y-4">
          {/* One-time empty-cell warning banner (Section 12 #8). Shown
              whenever any write happened, since empty cells DO overwrite. */}
          {totalWrites > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
              <strong>Note:</strong> empty cells overwrote existing values
              to NULL. Re-export the CSV before bulk editing if you want
              to start from current state.
            </div>
          )}

          {/* 4-entity matrix */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Entity</th>
                  <th className="px-3 py-2 text-right font-medium">Created</th>
                  <th className="px-3 py-2 text-right font-medium">Updated</th>
                  <th className="px-3 py-2 text-right font-medium">Skipped</th>
                  <th className="px-3 py-2 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ENTITY_ORDER.map((k) => {
                  const c = summary.summary[k];
                  const muted = entityTotal(c) === 0;
                  return (
                    <tr key={k} className={muted ? "text-muted-foreground" : ""}>
                      <td className="px-3 py-2 capitalize">{k}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.created > 0 ? "text-green-500 font-semibold" : ""}`}>{c.created}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.updated > 0 ? "text-blue-500 font-semibold" : ""}`}>{c.updated}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.skipped > 0 ? "text-yellow-500 font-semibold" : ""}`}>{c.skipped}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.failed > 0 ? "text-red-500 font-semibold" : ""}`}>{c.failed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Parse errors */}
          {summary.parseErrors.length > 0 && (
            <details className="rounded-lg border border-border overflow-hidden">
              <summary className="cursor-pointer bg-muted/30 px-4 py-2 text-sm font-medium select-none hover:bg-muted/50 transition-colors">
                {summary.parseErrors.length} parse error{summary.parseErrors.length !== 1 ? "s" : ""} — click to expand
              </summary>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border text-xs font-mono">
                {summary.parseErrors.map((e, i) => (
                  <li key={i} className="px-4 py-1.5 flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {e.row > 0 ? `row ${e.row}` : "file"}
                    </span>
                    {e.column && <span className="text-destructive font-semibold shrink-0">[{e.column}]</span>}
                    <span className="text-muted-foreground shrink-0">{e.code}</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Warnings (is_one_off / prereq_dropped / cycle_broken / unknown columns) */}
          {summary.warnings.length > 0 && (
            <details className="rounded-lg border border-yellow-300/40 overflow-hidden">
              <summary className="cursor-pointer bg-yellow-50 dark:bg-yellow-950/30 px-4 py-2 text-sm font-medium select-none hover:bg-yellow-100/60 transition-colors">
                {summary.warnings.length} warning{summary.warnings.length !== 1 ? "s" : ""} — click to expand
              </summary>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border text-xs font-mono">
                {summary.warnings.map((w, i) => (
                  <li key={i} className="px-4 py-1.5 flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {w.row > 0 ? `row ${w.row}` : "file"}
                    </span>
                    {w.slug && <span className="text-foreground shrink-0">{w.slug}</span>}
                    <span className="text-yellow-600 dark:text-yellow-400 shrink-0">{w.code}</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Apply failures (FK missing / DB error / etc.) */}
          {summary.failures.length > 0 && (
            <details className="rounded-lg border border-red-300/40 overflow-hidden">
              <summary className="cursor-pointer bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm font-medium select-none hover:bg-red-100/60 transition-colors">
                {summary.failures.length} apply failure{summary.failures.length !== 1 ? "s" : ""} — click to expand
              </summary>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border text-xs font-mono">
                {summary.failures.map((f, i) => (
                  <li key={i} className="px-4 py-1.5 flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      row {f.row}
                    </span>
                    {f.slug && <span className="text-foreground shrink-0">{f.slug}</span>}
                    <span className="text-destructive font-semibold shrink-0">{f.code}</span>
                    <span>{f.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 flex justify-end">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main DataTools component ────────────────────────────────────────────────

/**
 * `scope` controls which buttons are visible.
 *
 *   - "hub"   (default): Templates + Import + Export — the existing
 *     `/dashboard/journey` mount.
 *   - "items": Import + Export. Templates stay hub-only (admins authoring
 *     new content offline land on the hub first).
 *
 * Phase 2: Import is now wired to the slug-keyed Phase 2 route, so it's
 * safe to expose on the items page.
 */
export interface JourneyDataToolsProps {
  scope?: "hub" | "items";
}

export function JourneyDataTools({ scope = "hub" }: JourneyDataToolsProps = {}) {
  const showTemplates = scope === "hub";
  // Import is now available on both hub and items page (Phase 2).
  const showImport = true;

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
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error");
    } finally {
      setImporting(false);
    }
  }

  function handleModalClose() {
    // Refresh if anything was actually written so the page reflects the
    // new state. The 4-entity totals come from summary.summary.
    let hadWrites = false;
    if (importResult) {
      for (const k of ENTITY_ORDER) {
        const c = importResult.summary[k];
        if (c.created + c.updated > 0) { hadWrites = true; break; }
      }
    }
    setImportResult(null);
    if (hadWrites) window.location.reload();
  }

  return (
    <>
      {/* Hidden file input — only mounted when import is enabled */}
      {showImport && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Button group */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Templates — hub only */}
        {showTemplates && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              window.location.href = "/dashboard/journey/template";
            }}
          >
            <FileDown className="size-4" />
            Templates
          </Button>
        )}

        {/* Import */}
        {showImport && (
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
        )}

        {/* Export — always shown */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            window.location.href = "/dashboard/journey/export";
          }}
        >
          <Download className="size-4" />
          {scope === "items" ? "Export to CSV" : "Export ZIP"}
        </Button>
      </div>

      {/* Inline import error (structural / auth errors) */}
      {showImport && importError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">{importError}</span>
          <button onClick={() => setImportError(null)} aria-label="Dismiss">
            <X className="size-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Result modal */}
      {showImport && importResult && (
        <ResultModal summary={importResult} onClose={handleModalClose} />
      )}
    </>
  );
}
