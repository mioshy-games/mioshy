"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveCmsText } from "@/lib/cms/actions";
import type { CmsTextRow as CmsTextRowType } from "@/lib/cms/types";

/**
 * CmsTextRow — one editable key. Renders Hebrew + English textareas
 * side-by-side and a Save button. Save fires the server action which
 * UPDATEs the DB row and triggers `revalidateTag('cms-texts')`, so
 * the public site reflects the change on its next render.
 *
 * Local state is the source of truth for the editor; the row prop is
 * only used as the initial value. After a successful save we update
 * the "baseline" to the new value so the dirty-check works for
 * subsequent edits without needing a server refetch.
 *
 * Fix (2026-05-13) — the first MVP version used
 * `useTransition(async () => await saveCmsText({he, en}))`. React
 * 18.3's startTransition treats the async closure specially: in
 * practice we observed Save sending the closed-over he/en from
 * BEFORE the user typed (DB timestamp moved, value didn't). Replaced
 * with plain useState(isSaving) + an explicit snapshot of the
 * textarea values read straight from the DOM via refs at the moment
 * the user clicks Save — bypasses any closure-staleness ambiguity.
 */
export function CmsTextRow({ row }: { row: CmsTextRowType }) {
  // Editor state — what's currently typed. We keep these for the
  // "dirty" check + the Revert button. The actual save reads from the
  // textarea refs below (DOM is the source of truth at submit time).
  const [he, setHe] = useState<string>(row.he_text ?? "");
  const [en, setEn] = useState<string>(row.en_text ?? "");

  // Baseline state — what's last known to be in the DB. Diverges from
  // (he, en) when the admin types; reconciled after a successful save.
  const [baselineHe, setBaselineHe] = useState<string>(row.he_text ?? "");
  const [baselineEn, setBaselineEn] = useState<string>(row.en_text ?? "");

  const [isSaving, setIsSaving] = useState(false);

  // Refs onto the underlying <textarea> elements. On Save we read
  // textarea.value directly — this is the most current value the DOM
  // holds, regardless of any React batching / closure timing.
  const heRef = useRef<HTMLTextAreaElement>(null);
  const enRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = he !== baselineHe || en !== baselineEn;

  async function handleSave() {
    if (isSaving || !isDirty) return;

    // Source of truth at submit-time: the DOM value of each textarea.
    // Fall back to React state if the ref isn't attached (shouldn't
    // happen in practice, but defends against an SSR/hydration edge).
    const heToSave = heRef.current?.value ?? he;
    const enToSave = enRef.current?.value ?? en;

    // Diagnostic — visible in DevTools console + Vercel runtime logs
    // (the server action below also logs). Helps narrow down whether
    // the client or the server is the source of any future drift.
    // eslint-disable-next-line no-console
    console.log("[cms-save] sending", {
      key: row.key,
      he: heToSave,
      en: enToSave,
    });

    setIsSaving(true);
    try {
      const result = await saveCmsText({
        key: row.key,
        he: heToSave,
        en: enToSave,
      });
      if (result.ok) {
        // Reconcile state + baseline to the just-saved values. Done in
        // sequence so isDirty becomes false after the second setter.
        setHe(heToSave);
        setEn(enToSave);
        setBaselineHe(heToSave);
        setBaselineEn(enToSave);
        toast.success("Saved", {
          description: row.key,
          duration: 2000,
        });
      } else {
        toast.error("Save failed", {
          description: result.error,
          duration: 5000,
        });
      }
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : String(err),
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleRevert() {
    setHe(baselineHe);
    setEn(baselineEn);
  }

  // Heuristic for "this looks like rich text" — admin sees a tiny hint
  // when the value carries HTML markup so they know to be careful with
  // tags. Sprint 5 will add a real preview + a markup helper toolbar.
  const hasMarkup = /<\/?(em|strong|br)/i.test(he + en);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      {/* Key + meta */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <code className="text-xs font-medium text-slate-700">{row.key}</code>
        <div className="flex items-center gap-2">
          {hasMarkup ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-[10px] text-amber-700"
              title="This value contains <em> / <strong> / <br> markup. Preserve the tags when editing."
            >
              rich text
            </Badge>
          ) : null}
          {row.needs_review ? (
            <Badge
              variant="outline"
              className="border-rose-300 bg-rose-50 text-[10px] text-rose-700"
              title="One language was edited but the other hasn't been reviewed yet."
            >
              needs review
            </Badge>
          ) : null}
          {isDirty ? (
            <Badge
              variant="outline"
              className="border-blue-300 bg-blue-50 text-[10px] text-blue-700"
            >
              unsaved
            </Badge>
          ) : null}
        </div>
      </div>

      {/* HE + EN side-by-side */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`he-${row.id}`} className="text-xs font-semibold">
            Hebrew (RTL)
          </Label>
          <Textarea
            id={`he-${row.id}`}
            ref={heRef}
            dir="rtl"
            lang="he"
            value={he}
            onChange={(e) => setHe(e.target.value)}
            className="min-h-[80px] resize-y text-sm leading-relaxed"
            placeholder="(empty — public site will fall back to messages/he.json)"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`en-${row.id}`} className="text-xs font-semibold">
            English (LTR)
          </Label>
          <Textarea
            id={`en-${row.id}`}
            ref={enRef}
            dir="ltr"
            lang="en"
            value={en}
            onChange={(e) => setEn(e.target.value)}
            className="min-h-[80px] resize-y text-sm leading-relaxed"
            placeholder="(empty — public site will fall back to messages/en.json)"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevert}
          disabled={!isDirty || isSaving}
        >
          Revert
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
