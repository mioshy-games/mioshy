"use client";

/**
 * SendInterventionModule
 *
 * The "prescription" surface inside /dashboard/my-clients/[coupleId].
 * Lets the coach pick:
 *   1. WHO   - both partners | only A | only B
 *   2. WHAT  - message | task | reflection_prompt | item_assignment
 *   3. CONTENT - fields specific to the chosen WHAT
 *
 * Designed for fast workflow (≤2 clicks to send a templated note).
 * Sits inside the couple workspace so the coach never leaves
 * context to send a note.
 *
 * Calls app/actions/journey-intervention.ts → sendIntervention.
 */

import { useState, useTransition } from "react";
import { Send, AlertCircle, Check } from "lucide-react";
import { sendIntervention, type InterventionInput } from "@/app/actions/journey-intervention";

type Kind = "message" | "task" | "reflection_prompt" | "item_assignment";

interface ItemOption {
  id: string;
  title_he: string | null;
  title_en: string | null;
}

interface Props {
  coupleId: string;
  partnerALabel: string;
  partnerBLabel: string;
  /** Items the admin can pick when sending an item_assignment. */
  items: ItemOption[];
  /** Disable the "B" target if the couple has only one member. */
  hasPartnerB: boolean;
}

const KIND_OPTIONS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: "message", label: "הודעה", hint: "הודעה אישית מהמטפל" },
  { value: "task", label: "משימה", hint: "משימה ליישום" },
  { value: "reflection_prompt", label: "שאלת רפלקציה", hint: "שאלה פתוחה לחשיבה" },
  { value: "item_assignment", label: "שיוך אייטם", hint: "תוכן מתוך הקטלוג" },
];

const TARGET_OPTIONS: Array<{
  value: "both" | "a" | "b";
  label: (a: string, b: string) => string;
}> = [
  { value: "both", label: (a, b) => `שני בני הזוג (${a} + ${b})` },
  { value: "a", label: (a) => `רק ${a}` },
  { value: "b", label: (_, b) => `רק ${b}` },
];

export function SendInterventionModule({
  coupleId,
  partnerALabel,
  partnerBLabel,
  items,
  hasPartnerB,
}: Props) {
  const [target, setTarget] = useState<"both" | "a" | "b">("both");
  const [kind, setKind] = useState<Kind>("message");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");

  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setBody("");
    setDueAt("");
    setItemId("");
    setAdminNote("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Build the discriminated payload per kind. We do the validation
    // here friendliness-wise - the server-action zod schema will
    // re-validate and reject anything bad anyway.
    let payload: InterventionInput["payload"];

    if (kind === "message") {
      if (!title.trim() || !body.trim()) {
        setError("נושא וגוף הודעה הם שדות חובה.");
        return;
      }
      payload = { kind: "message", title: title.trim(), body: body.trim() };
    } else if (kind === "task") {
      if (!title.trim()) {
        setError("כותרת המשימה היא שדה חובה.");
        return;
      }
      payload = {
        kind: "task",
        title: title.trim(),
        description: body.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      };
    } else if (kind === "reflection_prompt") {
      if (!title.trim() || !body.trim()) {
        setError("כותרת ושאלת רפלקציה הם שדות חובה.");
        return;
      }
      payload = {
        kind: "reflection_prompt",
        title: title.trim(),
        prompt: body.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      };
    } else if (kind === "item_assignment") {
      if (!itemId) {
        setError("יש לבחור אייטם.");
        return;
      }
      payload = {
        kind: "item_assignment",
        itemId,
        scheduledFor: dueAt ? new Date(dueAt).toISOString() : undefined,
      };
    } else {
      setError("Unsupported kind");
      return;
    }

    startTransition(async () => {
      const res = await sendIntervention({
        coupleId,
        target,
        adminNote: adminNote.trim() || undefined,
        payload,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`נשלח ל־${res.data?.recipients} מקבלים.`);
      reset();
    });
  };

  return (
    <section
      aria-label="Send intervention"
      className="bg-card rounded-lg border p-5"
    >
      <header className="flex items-center gap-2">
        <Send className="size-4" />
        <h2 className="text-base font-semibold">שליחת התערבות</h2>
      </header>
      <p className="text-muted-foreground mt-0.5 text-xs">
        ברגע שהשליחה נסגרת - המקבל יראה את התוכן בפיד שלו. ההערה מטה
        נשמרת לאודיט ואינה גלויה למשתמש.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {/* WHO */}
        <fieldset>
          <legend className="text-xs font-medium">מקבל</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((opt) => {
              const disabled = opt.value !== "a" && !hasPartnerB && opt.value === "b";
              return (
                <label
                  key={opt.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                    target === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <input
                    type="radio"
                    name="target"
                    value={opt.value}
                    checked={target === opt.value}
                    onChange={() => setTarget(opt.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  {opt.label(partnerALabel, partnerBLabel)}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* WHAT */}
        <fieldset>
          <legend className="text-xs font-medium">סוג ההתערבות</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KIND_OPTIONS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => {
                  setKind(k.value);
                  reset();
                }}
                className={`rounded-md border p-2 text-right ${
                  kind === k.value
                    ? "border-primary bg-primary/5 ring-primary ring-1"
                    : "bg-background hover:bg-accent"
                }`}
              >
                <div className="text-xs font-semibold">{k.label}</div>
                <div className="text-muted-foreground mt-0.5 text-[10px]">
                  {k.hint}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* CONTENT - kind-dependent */}
        <div className="space-y-3 border-t pt-3">
          {kind === "item_assignment" ? (
            <>
              <label className="block text-xs font-medium">
                אייטם
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  required
                  className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">- בחרו -</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title_he ?? it.title_en ?? it.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium">
                תאריך/זמן (אופציונלי)
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-medium">
                {kind === "reflection_prompt" ? "כותרת השאלה" : "כותרת"}
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
                />
              </label>

              <label className="block text-xs font-medium">
                {kind === "message"
                  ? "תוכן ההודעה"
                  : kind === "reflection_prompt"
                  ? "שאלת הרפלקציה"
                  : "תיאור (אופציונלי)"}
                {kind !== "task" && <span className="text-rose-700"> *</span>}
                <textarea
                  rows={kind === "message" ? 5 : 4}
                  required={kind !== "task"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  className="bg-background mt-1 w-full rounded-md border p-2 text-sm"
                />
              </label>

              {(kind === "task" || kind === "reflection_prompt") && (
                <label className="block text-xs font-medium">
                  תאריך יעד (אופציונלי)
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  />
                </label>
              )}
            </>
          )}

          <label className="block text-xs font-medium">
            הערה לאדמין (לא נראית למשתמש)
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={2000}
              placeholder="למשל: סיבת השליחה / קונטקסט קליני"
              className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
            />
          </label>
        </div>

        {error && (
          <div className="text-rose-700 inline-flex items-center gap-1.5 text-xs">
            <AlertCircle className="size-3.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="text-emerald-700 inline-flex items-center gap-1.5 text-xs">
            <Check className="size-3.5" />
            {success}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-medium disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {pending ? "שולח…" : "שלח התערבות"}
          </button>
        </div>
      </form>
    </section>
  );
}
