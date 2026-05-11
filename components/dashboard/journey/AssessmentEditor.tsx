"use client";

/**
 * AssessmentEditor - admin/clinician surface for converting a
 * journey_items row into a structured assessment. Phase 3 step 3.
 *
 * MVP version:
 *   - Kind selector (content / assessment / reflection)
 *   - JSON textarea for `assessment_payload`
 *   - Two "load template" shortcuts for the most common kinds
 *   - Inline validation errors
 *   - Save button → server action
 *   - Live preview using the same AssessmentItemForm the user sees
 *
 * A full WYSIWYG question builder is a bigger UX project; this gets us
 * to "clinicians can author assessments today" without that.
 */

import { useMemo, useState, useTransition } from "react";
import {
  setItemKindAndPayload,
  type AssessmentSaveResult,
} from "@/lib/journey-content/admin-assessment";
import type {
  JourneyItemKind,
  JourneyAssessmentPayload,
} from "@/lib/journey-content/types";
import { AssessmentItemForm } from "@/components/my/AssessmentItemForm";
import {
  AssessmentVisualBuilder,
  ValidationSummary,
  validateAssessmentPayload,
} from "./AssessmentVisualBuilder";
import { HintIcon } from "@/components/ui/hint-icon";

type EditorMode = "visual" | "json";

type Kind = JourneyItemKind;

const TEMPLATE_ASSESSMENT: JourneyAssessmentPayload = {
  version: 1,
  intro_he:
    "אבחון קצר לבחינת מצב הקשר - אורך כ-3 דקות. אין תשובה נכונה.",
  questions: [
    {
      id: "freq_connect",
      kind: "scale",
      prompt_he: "באיזו תדירות אתם מרגישים מקושרים?",
      required: true,
      scale_min: 1,
      scale_max: 7,
      scale_min_label_he: "כלל לא",
      scale_max_label_he: "מאוד מקושר",
    },
    {
      id: "main_topic",
      kind: "single_choice",
      prompt_he: "מהו הנושא הכי בוער כרגע?",
      required: true,
      options: [
        { key: "communication", label_he: "תקשורת" },
        { key: "intimacy", label_he: "אינטימיות" },
        { key: "family", label_he: "משפחה" },
        { key: "stress", label_he: "לחצים יומיומיים" },
      ],
    },
    {
      id: "open_note",
      kind: "open_text",
      prompt_he: "משהו שתרצו שהמומחה ידע?",
      required: false,
    },
  ],
};

const TEMPLATE_REFLECTION: JourneyAssessmentPayload = {
  version: 1,
  questions: [
    {
      id: "reflection",
      kind: "open_text",
      prompt_he: "מה עלה בכם השבוע סביב הנושא הזה?",
      required: true,
    },
  ],
};

export function AssessmentEditor({
  itemId,
  initialKind,
  initialPayload,
}: {
  itemId: string;
  initialKind: Kind;
  initialPayload: JourneyAssessmentPayload | null;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [mode, setMode] = useState<EditorMode>("visual");
  // Visual mode keeps the payload as a structured object; JSON mode
  // mirrors it as text. They sync on switch via a useEffect-free flow:
  // each render re-derives the inactive view from the active one.
  const [visualPayload, setVisualPayload] = useState<JourneyAssessmentPayload | null>(
    initialPayload,
  );
  const [jsonText, setJsonText] = useState<string>(
    initialPayload ? JSON.stringify(initialPayload, null, 2) : "",
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "saved" }
    | { kind: "error"; message: string }
    | null
  >(null);

  // The single source of truth for the current payload depends on the
  // active mode. Visual: visualPayload. JSON: parsed jsonText.
  const parsed = useMemo<{
    payload: JourneyAssessmentPayload | null;
    error: string | null;
  }>(() => {
    if (kind === "content") return { payload: null, error: null };
    if (mode === "visual") {
      return { payload: visualPayload, error: null };
    }
    if (!jsonText.trim()) {
      return { payload: null, error: "JSON is empty" };
    }
    try {
      const obj = JSON.parse(jsonText) as JourneyAssessmentPayload;
      return { payload: obj, error: null };
    } catch (e) {
      return {
        payload: null,
        error: e instanceof Error ? e.message : "Invalid JSON",
      };
    }
  }, [kind, mode, jsonText, visualPayload]);

  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    if (next === "json") {
      // Going visual → JSON: serialize the current visual payload
      setJsonText(visualPayload ? JSON.stringify(visualPayload, null, 2) : "");
    } else {
      // Going JSON → visual: try to parse the JSON
      try {
        if (jsonText.trim()) {
          const obj = JSON.parse(jsonText) as JourneyAssessmentPayload;
          setVisualPayload(obj);
        } else {
          setVisualPayload(null);
        }
      } catch {
        // If JSON is broken we keep the previous visualPayload - the
        // user can fix it in JSON view first.
      }
    }
    setMode(next);
  };

  const loadTemplate = (template: JourneyAssessmentPayload) => {
    setJsonText(JSON.stringify(template, null, 2));
    setVisualPayload(template);
    setFeedback(null);
  };

  const save = () => {
    if (pending) return;
    startTransition(async () => {
      const result: AssessmentSaveResult = await setItemKindAndPayload({
        itemId,
        kind,
        payload: kind === "content" ? null : parsed.payload,
      });
      if (result.ok) {
        setFeedback({ kind: "saved" });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({
          kind: "error",
          message: result.message ?? "Save failed",
        });
      }
    });
  };

  // Phase 5 V2 — block save when the visual payload has validation
  // issues. JSON mode trusts the JSON; visual mode runs the structured
  // check. Content mode never validates (no payload).
  const validationIssues =
    kind === "content" || mode !== "visual"
      ? []
      : validateAssessmentPayload(parsed.payload);

  const canSave =
    !pending &&
    (kind === "content" || (parsed.payload !== null && !parsed.error)) &&
    validationIssues.length === 0;

  return (
    <section className="rounded-2xl border border-border bg-card/30 p-5">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Assessment / Reflection editor
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Convert this content item into an assessment or reflection
          prompt. Clients filling it in answer through the structured
          form on the user side; their answers flow into the same
          response Inbox alongside content responses.
        </p>
      </header>

      {/* Kind selector */}
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Item kind
          </label>
          <HintIcon topic="item.kind" />
        </span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          disabled={pending}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="content">content (default - body / video)</option>
          <option value="assessment">assessment (structured questions)</option>
          <option value="reflection">reflection (single open prompt)</option>
        </select>
      </div>

      {/* Templates + mode toggle + editor */}
      {kind !== "content" ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadTemplate(TEMPLATE_ASSESSMENT)}
              disabled={pending}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              Load assessment template
            </button>
            <button
              type="button"
              onClick={() => loadTemplate(TEMPLATE_REFLECTION)}
              disabled={pending}
              className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              Load reflection template
            </button>

            {/* Mode toggle - Visual is the friendly default */}
            <div className="ms-auto inline-flex overflow-hidden rounded-full border border-border">
              <button
                type="button"
                onClick={() => switchMode("visual")}
                className={[
                  "px-3 py-1 text-[11px] font-semibold",
                  mode === "visual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => switchMode("json")}
                className={[
                  "px-3 py-1 text-[11px] font-semibold",
                  mode === "json"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                JSON
              </button>
            </div>
          </div>

          <div className="mt-3">
            {mode === "visual" ? (
              <AssessmentVisualBuilder
                payload={visualPayload}
                onChange={(next) => {
                  setVisualPayload(next);
                  setJsonText(JSON.stringify(next, null, 2));
                }}
              />
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  assessment_payload (JSONB)
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  disabled={pending}
                  rows={16}
                  spellCheck={false}
                  className="w-full rounded-md border border-border bg-background p-2 font-mono text-[12px] leading-relaxed"
                  placeholder='{ "version": 1, "questions": [ ... ] }'
                />
                {parsed.error ? (
                  <p className="mt-1 text-xs text-destructive">{parsed.error}</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Phase 5 V2 — validation summary (visual mode only) */}
          {mode === "visual" ? (
            <div className="mt-4">
              <ValidationSummary issues={validationIssues} />
            </div>
          ) : null}

          {/* Live preview */}
          {parsed.payload ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview (user view)
              </p>
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <AssessmentItemForm
                  isHe={true}
                  scheduledItemId={`preview-${itemId}`}
                  payload={parsed.payload}
                />
              </div>
              <p className="mt-2 text-[11px] italic text-muted-foreground">
                Preview is live - submitting it would write to a fake
                scheduled-item id and silently fail RLS. This is intentional.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Save bar */}
      <div className="mt-5 flex items-center justify-between">
        <span
          className={[
            "text-xs",
            feedback?.kind === "saved"
              ? "text-emerald-600"
              : feedback?.kind === "error"
                ? "text-destructive"
                : "text-muted-foreground",
          ].join(" ")}
        >
          {feedback?.kind === "saved"
            ? "Saved"
            : feedback?.kind === "error"
              ? feedback.message
              : kind === "content"
                ? "Saving sets kind=content and clears any payload."
                : "Validate JSON, then Save."}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={[
            "rounded-full px-4 py-1.5 text-xs font-semibold",
            canSave
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}
