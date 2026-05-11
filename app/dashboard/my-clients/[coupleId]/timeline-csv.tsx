"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Couple-scoped CSV editor.
 *
 *   Download → GET ../timeline.csv (server route) - produces one row per
 *              materialized scheduled item, columns the expert can edit.
 *   Upload   → POST ../timeline-import (multipart) - applies edits in
 *              batch, reports row-level errors.
 *
 * The CSV is the only place the expert can override audience or unlock_at
 * per-couple without touching the global catalog.
 */
export function CoupleTimelineCsv({ coupleId }: { coupleId: string }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  function onDownload() {
    window.location.href = `/dashboard/my-clients/${coupleId}/timeline.csv`;
  }

  async function onPick(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/dashboard/my-clients/${coupleId}/timeline-import`,
        { method: "POST", body: fd },
      );
      const json = (await res.json()) as
        | {
            updated: number;
            failed: number;
            errors: Array<{ row: number; message: string }>;
          }
        | { error: string };

      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : "upload failed";
        toast.error(msg);
        return;
      }

      if (json.failed === 0) {
        toast.success(`Updated ${json.updated} rows`);
      } else {
        toast.warning(
          `Updated ${json.updated} · ${json.failed} failed - see console`,
        );
        console.warn("[CoupleTimelineCsv] partial import", json.errors);
      }
      router.refresh();
    } catch (e) {
      console.error("[CoupleTimelineCsv] upload error", e);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <Button type="button" variant="outline" size="sm" onClick={onDownload}>
        <Download className="me-2 size-4" />
        Download timeline.csv
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
      >
        <Upload className="me-2 size-4" />
        {uploading ? "Uploading…" : "Upload CSV"}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <p className="text-muted-foreground ms-auto max-w-md text-xs">
        Edit any of <code>audience</code>, <code>unlock_at</code>,{" "}
        <code>sort_order</code>, <code>admin_notes</code>. Changing{" "}
        <code>unlock_at</code> auto-flags{" "}
        <code>has_unlock_override=true</code> so future propagations leave the
        row alone.
      </p>
    </div>
  );
}
