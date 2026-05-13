"use client";

import { useState, useTransition } from "react";
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
 */
export function CmsTextRow({ row }: { row: CmsTextRowType }) {
  // Editor state — what's currently typed.
  const [he, setHe] = useState<string>(row.he_text ?? "");
  const [en, setEn] = useState<string>(row.en_text ?? "");

  // Baseline state — what's last known to be in the DB. Diverges from
  // (he, en) when the admin types; reconciled after a successful save.
  const [baselineHe, setBaselineHe] = useState<string>(row.he_text ?? "");
  const [baselineEn, setBaselineEn] = useState<string>(row.en_text ?? "");

  const [isPending, startTransition] = useTransition();

  const isDirty = he !== baselineHe || en !== baselineEn;

  function handleSave() {
    startTransition(async () => {
      const result = await saveCmsText({ key: row.key, he, en });
      if (result.ok) {
        setBaselineHe(he);
        setBaselineEn(en);
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
    });
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
          disabled={!isDirty || isPending}
        >
          Revert
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isPending}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
