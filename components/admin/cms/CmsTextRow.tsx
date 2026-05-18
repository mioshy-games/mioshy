"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Highlighter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveCmsText } from "@/lib/cms/actions";
import {
  COLOR_PRESETS,
  COLOR_PRESET_ORDER,
  HEX_VALUE_RE,
  resolveColorOverride,
  type ColorPresetName,
} from "@/lib/cms/colors";
import { normalizeRichText } from "@/lib/cms/render";
import type { CmsTextRow as CmsTextRowType } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

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
// ── Colour-section helpers ───────────────────────────────────────────
//
// The DB stores `color_override` as one of three shapes:
//   null              → no override
//   "preset:<name>"   → named preset
//   "#XXXXXX"         → 6-digit HEX
//
// The editor UI splits that into three pieces of state — `colorMode`,
// `colorPreset`, `colorHex` — so the dropdown and the HEX input can
// each be controlled independently. These two helpers convert between
// the wire shape and the UI shape.

type ColorMode = "default" | "preset" | "custom";

type ColorUiState = {
  mode: ColorMode;
  preset: ColorPresetName | "";
  hex: string;
};

/**
 * Storage value → UI state. Used to seed initial editor state from the
 * row prop AND to compute the baseline when the dropdown is reverted
 * or after a successful save.
 *
 * Unknown preset names (a renamed preset that left orphan rows) and
 * non-HEX strings (junk that bypassed the DB CHECK somehow) both fall
 * back to "default" — matches `resolveColorOverride`'s graceful path.
 */
function deriveColorUiState(value: string | null): ColorUiState {
  if (value === null) return { mode: "default", preset: "", hex: "" };
  if (value.startsWith("preset:")) {
    const name = value.slice("preset:".length);
    if (name in COLOR_PRESETS) {
      return { mode: "preset", preset: name as ColorPresetName, hex: "" };
    }
    return { mode: "default", preset: "", hex: "" };
  }
  if (HEX_VALUE_RE.test(value)) {
    return { mode: "custom", preset: "", hex: value };
  }
  return { mode: "default", preset: "", hex: "" };
}

/**
 * UI state → storage value (or validation error). The save action
 * runs the same Zod refine on its side; this client-side check lets
 * us disable the Save button before the round-trip.
 *
 * In "custom" mode an empty HEX returns null (treated as Default until
 * the admin types something). A non-empty but malformed HEX returns
 * an error so the input gets the red border.
 */
function buildColorOverride(state: ColorUiState): {
  value: string | null;
  error: string | null;
} {
  if (state.mode === "default") return { value: null, error: null };
  if (state.mode === "preset") {
    if (!state.preset) return { value: null, error: null };
    return { value: `preset:${state.preset}`, error: null };
  }
  // custom
  const trimmed = state.hex.trim();
  if (trimmed.length === 0) return { value: null, error: null };
  if (!HEX_VALUE_RE.test(trimmed)) {
    return {
      value: null,
      error: "HEX לא תקין. נדרש פורמט #XXXXXX (6 ספרות).",
    };
  }
  return { value: trimmed, error: null };
}

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

  // is_rich mode — starts at the DB value. Clicking the "enable
  // rich formatting" toggle in plain rows flips this to true and
  // marks the row dirty so the next Save promotes the column. We
  // never auto-demote (rich → plain) — admin would have to manually
  // strip markup and toggle off (UI for that isn't surfaced yet).
  const [isRich, setIsRich] = useState<boolean>(row.is_rich);
  const [baselineIsRich, setBaselineIsRich] = useState<boolean>(row.is_rich);

  // Sprint 5 — colour-override editor state. Three pieces because the
  // dropdown, the HEX input, and the "Default" sentinel each need to
  // be controlled independently. The single canonical baseline is
  // `baselineColorOverride` (the wire shape); the baseline UI state
  // is derived from it on the fly.
  const initialColorState = useMemo(
    () => deriveColorUiState(row.color_override),
    [row.color_override],
  );
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorState.mode);
  const [colorPreset, setColorPreset] = useState<ColorPresetName | "">(
    initialColorState.preset,
  );
  const [colorHex, setColorHex] = useState<string>(initialColorState.hex);
  const [baselineColorOverride, setBaselineColorOverride] = useState<
    string | null
  >(row.color_override);

  const baselineColorState = useMemo(
    () => deriveColorUiState(baselineColorOverride),
    [baselineColorOverride],
  );

  const colorBuild = buildColorOverride({
    mode: colorMode,
    preset: colorPreset,
    hex: colorHex,
  });

  // Dirty if the UI shape (mode/preset/hex) differs from the baseline.
  // Comparing UI shape rather than the built value lets a malformed
  // HEX still register as dirty so Revert restores correctly — the
  // built value would be null in that case and might match baseline
  // by coincidence.
  const colorIsDirty =
    colorMode !== baselineColorState.mode ||
    colorPreset !== baselineColorState.preset ||
    colorHex !== baselineColorState.hex;

  const [isSaving, setIsSaving] = useState(false);

  // Refs onto the underlying <textarea> elements. On Save we read
  // textarea.value directly — this is the most current value the DOM
  // holds, regardless of any React batching / closure timing.
  const heRef = useRef<HTMLTextAreaElement>(null);
  const enRef = useRef<HTMLTextAreaElement>(null);

  const isDirty =
    he !== baselineHe ||
    en !== baselineEn ||
    isRich !== baselineIsRich ||
    colorIsDirty;

  // Save is gated on validity too — a malformed custom HEX must not
  // round-trip to the server (which would return its own validation
  // error, but we can save the round-trip).
  const canSave = isDirty && !isSaving && colorBuild.error === null;

  async function handleSave() {
    if (!canSave) return;

    // Source of truth at submit-time: the DOM value of each textarea.
    // Fall back to React state if the ref isn't attached (shouldn't
    // happen in practice, but defends against an SSR/hydration edge).
    const heToSave = heRef.current?.value ?? he;
    const enToSave = enRef.current?.value ?? en;
    const isRichToSave = isRich;
    // Sprint 5 — colorBuild.value already carries the wire shape
    // (null / "preset:<name>" / "#XXXXXX"). canSave guarantees error
    // is null, so it's safe to send.
    const colorOverrideToSave = colorBuild.value;

    // Diagnostic — visible in DevTools console + Vercel runtime logs
    // (the server action below also logs). Helps narrow down whether
    // the client or the server is the source of any future drift.
    // eslint-disable-next-line no-console
    console.log("[cms-save] sending", {
      key: row.key,
      he: heToSave,
      en: enToSave,
      is_rich: isRichToSave,
      color_override: colorOverrideToSave,
    });

    setIsSaving(true);
    try {
      const result = await saveCmsText({
        key: row.key,
        he: heToSave,
        en: enToSave,
        is_rich: isRichToSave,
        color_override: colorOverrideToSave,
      });
      if (result.ok) {
        // Reconcile state + baseline to the just-saved values.
        setHe(heToSave);
        setEn(enToSave);
        setBaselineHe(heToSave);
        setBaselineEn(enToSave);
        setBaselineIsRich(isRichToSave);
        setBaselineColorOverride(colorOverrideToSave);
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
    setIsRich(baselineIsRich);
    // Colour revert — UI back to whatever the baseline storage value
    // would derive to. Reads `baselineColorState` (memoised above).
    setColorMode(baselineColorState.mode);
    setColorPreset(baselineColorState.preset);
    setColorHex(baselineColorState.hex);
  }

  // Dropdown handler — single source of truth for "what does the user
  // mean when they pick option X". The dropdown carries one of:
  //   "default" | "custom" | "preset:<name>"
  // We map that back into the three-piece UI state. When switching
  // INTO custom mode we pre-populate the HEX input from the currently
  // resolved colour (if it has a HEX form) so the admin starts from a
  // known-good value rather than an empty box.
  function handleColorDropdownChange(next: string) {
    // ── DEBUG (row-level colour vs toolbar wrap diagnostics) ───────
    // Itzik 2026-05-16 reported: "I selected a word to colour and
    // the whole line came out coloured". Two surfaces can produce
    // that symptom and we need to tell them apart from telemetry:
    //   1. The toolbar Color chip → wraps selected text in <mark>
    //      (logged in wrapSelection above).
    //   2. THIS dropdown → sets cms_texts.color_override for the
    //      ENTIRE row (whole text, both languages). Picking a
    //      preset / custom HEX here is BY DESIGN row-scoped — there
    //      is no per-selection state for it.
    // Surface this log so when we look at the trail we know which
    // control fired. Includes row key + chosen value.
    // eslint-disable-next-line no-console
    console.log("[cms-toolbar] row-color dropdown changed", {
      key: row.key,
      next,
      wholeRowAffected: true,
      note:
        "This dropdown recolours the entire row by design. " +
        "If only a selected word should be coloured, use the <mark> " +
        "toolbar chip above the textarea instead.",
    });
    if (next === "default") {
      setColorMode("default");
      return;
    }
    if (next === "custom") {
      // Seed from the currently shown preset's HEX if it has one.
      // Falls through to whatever colorHex already is (last-typed
      // value) for repeated default↔custom toggles. The `muted`
      // preset is rgba and has no HEX form, so we leave the input
      // empty in that case rather than seed something invalid.
      if (colorMode === "preset" && colorPreset) {
        const resolved = COLOR_PRESETS[colorPreset];
        if (resolved.startsWith("#")) {
          setColorHex(resolved);
        }
      }
      setColorMode("custom");
      return;
    }
    if (next.startsWith("preset:")) {
      const name = next.slice("preset:".length);
      if (name in COLOR_PRESETS) {
        setColorMode("preset");
        setColorPreset(name as ColorPresetName);
      }
    }
  }

  function handleColorReset() {
    setColorMode("default");
    setColorPreset("");
    setColorHex("");
  }

  // Dropdown's controlled value — derives directly from UI state so
  // there's only one source of truth.
  const dropdownValue: string =
    colorMode === "default"
      ? "default"
      : colorMode === "custom"
        ? "custom"
        : colorPreset
          ? `preset:${colorPreset}`
          : "default";

  // Resolved CSS colour for the swatch preview. Uses the same
  // resolver the public site uses, so what the admin sees in the
  // swatch is exactly what visitors will get.
  const swatchColor = resolveColorOverride(colorBuild.value);

  return (
    <div
      // `data-cms-key` is the anchor the global search bar uses to
      // scroll directly to this row when the admin clicks a result.
      // Querying the DOM by `[data-cms-key="<key>"]` is more robust
      // than relying on React refs threaded through Tabs → details
      // → row, and survives the tab switch + section auto-open that
      // happens before the scroll fires.
      data-cms-key={row.key}
      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition-shadow"
    >
      {/* Key + meta */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <code className="text-xs font-medium text-slate-700">{row.key}</code>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isRich
                ? "border-amber-300 bg-amber-50 text-[10px] text-amber-700"
                : "border-slate-300 bg-slate-50 text-[10px] text-slate-600"
            }
            title={
              isRich
                ? "This row accepts the 8-tag allow-list: <em>, <strong>, <mark>, <br>, <p>, <ul>, <li>, <s>. Attributes are stripped on save."
                : "Plain text only. Saves with any HTML tag are rejected. Click 'enable rich formatting' below to promote this row."
            }
          >
            {isRich ? "rich text" : "plain text"}
          </Badge>
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
          isRich={isRich}
          onEnableRich={() => setIsRich(true)}
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
          isRich={isRich}
          onEnableRich={() => setIsRich(true)}
          placeholder="(empty — public site will fall back to messages/en.json)"
        />
      </div>

      {/* Sprint 5 — Colour override section. Sits between the textareas
          and the action row so the bottom of the card stays consistent
          (Revert / Save always at the very bottom). */}
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold text-slate-700">Color</Label>
          {colorMode !== "default" ? (
            <button
              type="button"
              onClick={handleColorReset}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              title="Clear the override — the row will use the component's default colour"
            >
              Reset to default
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live swatch — solid for an active colour, diagonal-stripe
              for "no override" so the admin can tell at a glance. */}
          <div
            className={cn(
              "h-8 w-8 shrink-0 rounded border",
              swatchColor
                ? "border-slate-300"
                : "border-dashed border-slate-300 bg-slate-50",
            )}
            style={swatchColor ? { backgroundColor: swatchColor } : undefined}
            title={
              swatchColor
                ? `Resolved colour: ${swatchColor}`
                : "No override — component default"
            }
            aria-label="Colour preview"
          />

          {/* Mode selector. Single source of truth for default vs
              preset vs custom; the "Custom HEX…" option reveals the
              text input below. */}
          <Select
            value={dropdownValue}
            onValueChange={handleColorDropdownChange}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (no override)</SelectItem>
              {COLOR_PRESET_ORDER.map((name) => (
                <SelectItem key={name} value={`preset:${name}`}>
                  {name}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom HEX…</SelectItem>
            </SelectContent>
          </Select>

          {/* HEX input — only in custom mode. Fixed-width monospace so
              "#" plus 6 hex chars fit cleanly. The red border + ring
              fire whenever the build returns an error (any non-empty
              malformed value). */}
          {colorMode === "custom" ? (
            <Input
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              placeholder="#RRGGBB"
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              aria-invalid={colorBuild.error !== null}
              className={cn(
                "h-8 w-32 font-mono text-xs",
                colorBuild.error !== null &&
                  "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/40",
              )}
            />
          ) : null}
        </div>

        {/* Validation error — only relevant in custom mode. The dir+lang
            + leading icon make the Hebrew copy below readable in either
            UI direction; the error text itself stays short. */}
        {colorMode === "custom" && colorBuild.error !== null ? (
          <p
            dir="rtl"
            lang="he"
            className="mt-2 text-[11px] font-medium text-red-600"
          >
            {colorBuild.error}
          </p>
        ) : null}

        {/* Custom-mode warning. Always shown when in custom mode, not
            just on error — picking custom at all is the moment to
            warn, not after the admin already typed a HEX. */}
        {colorMode === "custom" ? (
          <p
            dir="rtl"
            lang="he"
            className="mt-2 text-[11px] text-amber-700"
          >
            ⚠️ ערכים מותאמים יכולים לשבור את ה-design system. השתמש בזהירות.
          </p>
        ) : null}
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
          disabled={!canSave}
          title={
            colorBuild.error !== null
              ? "Fix the colour error before saving."
              : undefined
          }
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
  isRich,
  onEnableRich,
  placeholder,
}: {
  id: string;
  label: string;
  dir: "rtl" | "ltr";
  lang: "he" | "en";
  value: string;
  onChange: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  isRich: boolean;
  onEnableRich: () => void;
  placeholder?: string;
}) {
  // Preview only when the row is rich AND contains markup — for
  // plain rows there's nothing to render that the textarea doesn't
  // already show.
  const hasMarkup = /<\/?(em|strong|mark|br|p|ul|li|s)\b/i.test(value);
  const showPreview = isRich && hasMarkup;

  // Track whether the textarea currently has a non-collapsed selection.
  // The toolbar buttons disable when nothing is selected — this avoids
  // two buggy patterns Itzik hit on 2026-05-13:
  //   1. Clicking "Brand color" with an empty caret produced an empty
  //      <em></em> at the cursor (and the public site rendered nothing,
  //      while the DB carried the orphan tag).
  //   2. Clicking the same button twice on still-selected just-wrapped
  //      text produced <em><em>…</em></em> nested. With the selection
  //      collapsed automatically after each wrap (see wrapSelection),
  //      a second click is now a no-op until the admin re-selects.
  const [hasSelection, setHasSelection] = useState(false);
  function refreshSelection() {
    const ta = textareaRef.current;
    if (!ta) return;
    setHasSelection(ta.selectionStart !== ta.selectionEnd);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold">
          {label}
        </Label>
        {isRich ? (
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() =>
                wrapSelection(textareaRef.current, "em", onChange)
              }
              label="Brand color"
              preview={<span className="italic text-rose-700">italic red</span>}
              title="Wrap selected text in <em> (brand red italic on the public site)"
              disabled={!hasSelection}
            />
            <ToolbarButton
              onClick={() =>
                wrapSelection(textareaRef.current, "strong", onChange)
              }
              label="Bold"
              preview={<span className="font-bold">bold</span>}
              title="Wrap selected text in <strong>"
              disabled={!hasSelection}
            />
            {/* Sprint 5 — <mark> is colour-only highlighting. Defaults
                to brand-rose; if the row has a colour override, the
                mark inherits the same colour via --cms-mark-color
                (set by <CmsText>). No font / weight change. */}
            <ToolbarButton
              onClick={() =>
                wrapSelection(textareaRef.current, "mark", onChange)
              }
              label="Color"
              preview={
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <Highlighter className="h-3 w-3" />
                  color
                </span>
              }
              title="Wrap selected text in <mark> (colour-only highlight — brand-rose by default, or the row's colour override)"
              disabled={!hasSelection}
            />
          </div>
        ) : (
          // Plain mode — replace the toolbar with a single toggle that
          // promotes this row to rich on Save. Phrased as a hint so
          // an admin who just wants to type text isn't pushed into
          // markup mode by accident.
          <button
            type="button"
            onClick={onEnableRich}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            title="Currently plain text — clicking this flips the row to rich text mode and reveals the <em>/<strong> toolbar. Takes effect on the next Save."
          >
            Plain text · enable rich formatting
          </button>
        )}
      </div>

      <Textarea
        id={id}
        ref={textareaRef}
        dir={dir}
        lang={lang}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Typing also collapses any previous selection — refresh so
          // the toolbar disables immediately.
          refreshSelection();
        }}
        onSelect={refreshSelection}
        onMouseUp={refreshSelection}
        onKeyUp={refreshSelection}
        onBlur={refreshSelection}
        className="min-h-[80px] resize-y text-sm leading-relaxed"
        placeholder={placeholder}
      />

      {showPreview ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </div>
          <div
            dir={dir}
            lang={lang}
            className="text-sm leading-relaxed text-slate-800 [&_em]:font-serif [&_em]:not-italic [&_em]:text-rose-700 [&_strong]:font-bold [&_mark]:bg-transparent [&_mark]:text-rose-700 [&_p]:my-1 [&_ul]:list-disc [&_ul]:ps-5 [&_s]:line-through [&_s]:text-slate-400"
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
  disabled,
}: {
  onClick: () => void;
  label: string;
  preview: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Select text in the textarea first, then click to wrap."
          : title
      }
      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-white"
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
  tag: "em" | "strong" | "mark",
  setValue: (v: string) => void,
): void {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;

  // ── DEBUG (toolbar wrap diagnostics) ─────────────────────────────
  // Itzik reported on 2026-05-16: "selecting a word and clicking the
  // toolbar wraps the WHOLE line, not just the selection". The code
  // below slices by selectionStart/End so it shouldn't be possible
  // for the wrap to span more than the selection — yet the bug is
  // user-visible. The log fires once per click and prints every
  // value that goes into the wrap decision so we can see whether
  // the textarea is reporting start=0/end=length, whether the
  // selection collapsed on button mousedown, or whether something
  // else (RTL composition, dictation, etc.) is at play. Remove
  // once we've captured a reproduction in the wild.
  // eslint-disable-next-line no-console
  console.log("[cms-toolbar] wrapSelection click", {
    tag,
    selectionStart: start,
    selectionEnd: end,
    selectedLength: end - start,
    valueLength: ta.value.length,
    selectedText: ta.value.slice(start, end),
    fullValue: ta.value,
    wrappingWholeLine: start === 0 && end === ta.value.length,
    isFocused: document.activeElement === ta,
  });

  // Guard — no selection means no-op. The toolbar button is also
  // disabled at this point (see hasSelection in LanguageEditor), but
  // we keep the runtime check in case the caller routes around it.
  if (start === end) return;

  const value = ta.value;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const opening = `<${tag}>`;
  const closing = `</${tag}>`;
  const newValue = `${before}${opening}${selected}${closing}${after}`;
  setValue(newValue);

  // Restore caret AFTER the wrapped content (not on it). Two reasons:
  //   1. If we kept the wrapped span selected, a second click on the
  //      same toolbar button would nest <em><em>…</em></em>. Itzik hit
  //      this on 2026-05-13 — collapsing the caret prevents the
  //      accidental double-wrap.
  //   2. The "hasSelection" effective state for the next render is now
  //      false, so the toolbar disables until the admin deliberately
  //      re-selects something.
  // requestAnimationFrame gives React time to flush the value
  // re-render before we touch the DOM selection — otherwise focus /
  // setSelectionRange runs before the new value lands and the cursor
  // jumps to position 0.
  requestAnimationFrame(() => {
    ta.focus();
    const caretAfter = start + opening.length + selected.length + closing.length;
    ta.setSelectionRange(caretAfter, caretAfter);
    // The onSelect handler doesn't fire from a programmatic
    // setSelectionRange. Dispatch a synthetic select event so the
    // refreshSelection callback updates hasSelection → false.
    ta.dispatchEvent(new Event("select", { bubbles: true }));
  });
}
