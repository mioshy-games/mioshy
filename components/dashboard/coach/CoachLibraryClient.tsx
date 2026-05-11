"use client";

/**
 * CoachLibraryClient
 * ─────────────────────────────────────────────────────────
 * List + create + edit + delete for the coach's library.
 * Three kinds: saved_reply, content_pin, couple_note.
 *
 * Inline edit for tight iteration — no separate detail page.
 * The full library lives on this single screen so a coach
 * scanning for the right snippet finds it without nav.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  saveCoachLibraryEntry,
  deleteCoachLibraryEntry,
} from "@/app/dashboard/actions/coach-library";
import type {
  CoachLibraryEntry,
  CoachLibraryKind,
} from "@/lib/journey-content/coach-library";

const KIND_LABEL: Record<CoachLibraryKind, string> = {
  saved_reply:  "Saved reply",
  content_pin:  "Content pin",
  couple_note:  "Couple note",
};

const TONE: Record<CoachLibraryKind, string> = {
  saved_reply:  "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  content_pin:  "border-amber-300/40 bg-amber-500/10 text-amber-100",
  couple_note:  "border-sky-300/40 bg-sky-500/10 text-sky-100",
};

interface DraftState {
  id:        string | null;
  kind:      CoachLibraryKind;
  label:     string;
  body_he:   string;
  body_en:   string;
  tags:      string;
  couple_id: string;
}

const emptyDraft: DraftState = {
  id:        null,
  kind:      "saved_reply",
  label:     "",
  body_he:   "",
  body_en:   "",
  tags:      "",
  couple_id: "",
};

export function CoachLibraryClient({
  initialEntries,
}: {
  initialEntries: CoachLibraryEntry[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<CoachLibraryKind | "all">("all");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = initialEntries.filter(
    (e) => filter === "all" || e.kind === filter,
  );

  const startNew = (kind: CoachLibraryKind = "saved_reply") => {
    setDraft({ ...emptyDraft, kind });
  };

  const startEdit = (entry: CoachLibraryEntry) => {
    setDraft({
      id:        entry.id,
      kind:      entry.kind,
      label:     entry.label,
      body_he:   entry.body_he,
      body_en:   entry.body_en ?? "",
      tags:      (entry.tags ?? []).join(", "),
      couple_id: entry.couple_id ?? "",
    });
  };

  const cancelDraft = () => setDraft(null);

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    const tags = draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    const res = await saveCoachLibraryEntry({
      id:        draft.id,
      kind:      draft.kind,
      label:     draft.label,
      body_he:   draft.body_he,
      body_en:   draft.body_en || null,
      tags,
      couple_id:
        draft.kind === "couple_note" && draft.couple_id
          ? draft.couple_id
          : null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(`Save failed: ${res.error}`);
      return;
    }
    toast.success("Saved");
    setDraft(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const res = await deleteCoachLibraryEntry(id);
    if (!res.ok) {
      toast.error(`Delete failed: ${res.error}`);
      return;
    }
    toast.success("Deleted");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Filter pills + create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "saved_reply", "content_pin", "couple_note"] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === k
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {k === "all" ? "All" : KIND_LABEL[k]}
              </button>
            ),
          )}
        </div>
        <Button
          type="button"
          onClick={() => startNew("saved_reply")}
          className="gap-1.5"
        >
          <Plus className="size-4" /> New saved reply
        </Button>
      </div>

      {/* Draft editor (inline) */}
      {draft ? (
        <section className="rounded-md border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {draft.id ? "Edit entry" : "New entry"}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(["saved_reply", "content_pin", "couple_note"] as const).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ ...draft, kind: k })}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                      draft.kind === k
                        ? TONE[k]
                        : "border-white/15 bg-white/[0.03] text-white/60"
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Quick check-in for week 1"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body_he">Hebrew body</Label>
            <Textarea
              id="body_he"
              value={draft.body_he}
              onChange={(e) => setDraft({ ...draft, body_he: e.target.value })}
              dir="rtl"
              rows={4}
              maxLength={4000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body_en">English body (optional)</Label>
            <Textarea
              id="body_en"
              value={draft.body_en}
              onChange={(e) => setDraft({ ...draft, body_en: e.target.value })}
              rows={4}
              maxLength={4000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="conflict, week-1, intimacy"
            />
          </div>

          {draft.kind === "couple_note" ? (
            <div className="space-y-1.5">
              <Label htmlFor="couple_id">Couple ID</Label>
              <Input
                id="couple_id"
                value={draft.couple_id}
                onChange={(e) =>
                  setDraft({ ...draft, couple_id: e.target.value })
                }
                placeholder="UUID"
              />
              <p className="text-muted-foreground text-[11px]">
                Notes are scoped to the couple they reference. Get the
                ID from /dashboard/my-clients.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelDraft}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {/* List */}
      <div className="rounded-md border bg-card divide-y">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            {filter === "all"
              ? "Your library is empty. Click \"New saved reply\" to start."
              : `No ${KIND_LABEL[filter as CoachLibraryKind].toLowerCase()}s yet.`}
          </p>
        ) : (
          filtered.map((entry) => (
            <article key={entry.id} className="space-y-2 p-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={TONE[entry.kind]}>
                      {KIND_LABEL[entry.kind]}
                    </Badge>
                    <h3 className="font-medium">{entry.label}</h3>
                  </div>
                  {entry.tags && entry.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/55">
                      <Tag className="size-3" />
                      {entry.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-xs text-white/55">
                  <span className="tabular-nums">
                    Used {entry.use_count}×
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="hover:text-white"
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(entry.id)}
                    className="hover:text-rose-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </header>
              <p
                className="line-clamp-3 whitespace-pre-wrap text-sm text-white/80"
                dir="rtl"
              >
                {entry.body_he}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
