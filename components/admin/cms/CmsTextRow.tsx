"use client";

import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveCmsText } from "@/lib/cms/actions";
import { normalizeRichText } from "@/lib/cms/render";
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
        <LanguageEditor
          id={`he-${row.id}`}
          label="Hebrew (RTL)"
          dir="rtl"
          lang="he"
          value={he}
          onChange={setHe}
          textareaRef={heRef}
          placeholder="(empty — public site will fall back to messages/he.json)"
        />
        <LanguageEditor
          id={`en-${row.id}`}
          label="English (LTR)"
          dir="ltr"
          lang="en"
          value={en}
          onChange={setEn}
          textareaRef={enRef}
          placeholder="(empty — public site will fall back to messages/en.json)"
        />
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

// ── LanguageEditor ───────────────────────────────────────────────────
//
// One language's editing surface: toolbar (em / strong wrappers) + the
// textarea + a live preview of how the value will render. Server-side
// sanitization in lib/cms/render.ts is the authoritative gate; this
// toolbar just emits well-formed markup so admins don't have to type
// it by hand.

function LanguageEditor({
  id,
  label,
  dir,
  lang,
  value,
  onChange,
  textareaRef,
  placeholder,
}: {
  id: string;
  label: string;
  dir: "rtl" | "ltr";
  lang: "he" | "en";
  value: string;
  onChange: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  placeholder?: string;
}) {
  // Preview is shown only when the value actually contains markup —
  // for plain strings the textarea is the preview. Keeps the UI quiet
  // on the 90% of keys that are tag-free.
  const hasMarkup = /<\/?(em|strong|br)\b/i.test(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-semibold">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => wrapSelection(textareaRef.current, "em", onChange)}
            label="Brand color"
            preview={<span className="italic text-rose-700">italic red</span>}
            title="Wrap selected text in <em> (brand red italic on the public site)"
          />
          <ToolbarButton
            onClick={() =>
              wrapSelection(textareaRef.current, "strong", onChange)
            }
            label="Bold"
            preview={<span className="font-bold">bold</span>}
            title="Wrap selected text in <strong>"
          />
        </div>
      </div>

      <Textarea
        id={id}
        ref={textareaRef}
        dir={dir}
        lang={lang}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] resize-y text-sm leading-relaxed"
        placeholder={placeholder}
      />

      {hasMarkup ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </div>
          <div
            dir={dir}
            lang={lang}
            className="text-sm leading-relaxed text-slate-800 [&_em]:font-serif [&_em]:not-italic [&_em]:text-rose-700 [&_strong]:font-bold"
            dangerouslySetInnerHTML={{ __html: normalizeRichText(value) }}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── ToolbarButton ────────────────────────────────────────────────────
//
// Small chip-style button used twice above each textarea. The visible
// `preview` slot shows the styling the wrap will produce on the public
// site, so admins know what they're getting before they click.

function ToolbarButton({
  onClick,
  label,
  preview,
  title,
}: {
  onClick: () => void;
  label: string;
  preview: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
    >
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-400">·</span>
      {preview}
    </button>
  );
}

// ── wrapSelection — pure helper, no React state ──────────────────────
//
// Reads the textarea's current selection, wraps it in <tag>...</tag>,
// writes the new value via the supplied setter, and restores the
// selection to span the just-wrapped content (so successive clicks
// "nest" or the admin can type something while it's highlighted).
//
// If nothing is selected (collapsed caret), the tag pair is inserted
// at the caret and the caret is placed BETWEEN the tags — admin can
// type the emphasised word immediately. This matches every WYSIWYG
// I've ever used.

function wrapSelection(
  ta: HTMLTextAreaElement | null,
  tag: "em" | "strong",
  setValue: (v: string) => void,
): void {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const value = ta.value;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const opening = `<${tag}>`;
  const closing = `</${tag}>`;
  const newValue = `${before}${opening}${selected}${closing}${after}`;
  setValue(newValue);

  // Restore caret/selection on the wrapped span. requestAnimationFrame
  // gives React time to flush the value re-render before we touch the
  // DOM selection — without it the focus / setSelectionRange runs
  // before the new value lands and the cursor jumps to position 0.
  requestAnimationFrame(() => {
    ta.focus();
    if (selected.length === 0) {
      // Empty selection — place caret BETWEEN the opening + closing tags
      const caret = start + opening.length;
      ta.setSelectionRange(caret, caret);
    } else {
      // Highlight what we just wrapped so the admin can see what changed
      const newStart = start + opening.length;
      const newEnd = newStart + selected.length;
      ta.setSelectionRange(newStart, newEnd);
    }
  });
}
