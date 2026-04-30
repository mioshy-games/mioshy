"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ExperienceGameContent } from "@/lib/between-us/types";
import {
  createContentForLevel,
  deleteContent,
  duplicateContent,
  reorderContent,
  saveContent,
  toggleContentFlag,
} from "@/app/dashboard/actions/between-us-content";

type Level = "מרגש" | "מעורר" | "ללא_גבולות";

const LEVELS: { value: Level; labelHe: string; hint: string; accent: string }[] =
  [
    {
      value: "מרגש",
      labelHe: "מרגש",
      hint: "תוכן רגיש ורומנטי - מתאים לכולם",
      accent: "bg-rose-50 text-rose-900 border-rose-200",
    },
    {
      value: "מעורר",
      labelHe: "מעורר",
      hint: "תוכן מעורר - חושני ופתוח",
      accent: "bg-amber-50 text-amber-900 border-amber-200",
    },
    {
      value: "ללא_גבולות",
      labelHe: "ללא גבולות",
      hint: "תוכן מפורש - +18 בלבד",
      accent: "bg-violet-50 text-violet-900 border-violet-200",
    },
  ];

export function ContentManager({
  gameId,
  initialByLevel,
}: {
  gameId: string;
  initialByLevel: Record<Level, ExperienceGameContent[]>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExperienceGameContent | null>(null);
  const [pendingCreate, startCreate] = useTransition();
  const [activeLevel, setActiveLevel] = useState<Level>("מרגש");

  async function onAdd(level: Level) {
    startCreate(async () => {
      const res = await createContentForLevel(gameId, level);
      if (!res.ok) {
        const msg = res.error._root?.[0] ?? "Could not create";
        toast.error(msg);
        return;
      }
      toast.success("Card added");
      router.refresh();
    });
  }

  const totals = useMemo(() => {
    const t: Record<Level, { total: number; active: number; preview: number }> =
      {
        מרגש: { total: 0, active: 0, preview: 0 },
        מעורר: { total: 0, active: 0, preview: 0 },
        ללא_גבולות: { total: 0, active: 0, preview: 0 },
      };
    for (const lvl of LEVELS) {
      const rows = initialByLevel[lvl.value] ?? [];
      t[lvl.value] = {
        total: rows.length,
        active: rows.filter((r) => r.is_active).length,
        preview: rows.filter((r) => r.is_preview && r.is_active).length,
      };
    }
    return t;
  }, [initialByLevel]);

  return (
    <>
      {/* Level selector - stickier than chunky tabs */}
      <div className="bg-card overflow-x-auto rounded-lg border">
        <div className="flex min-w-max gap-1 p-1.5">
          {LEVELS.map((l) => {
            const is = l.value === activeLevel;
            const count = totals[l.value].total;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setActiveLevel(l.value)}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm transition-colors whitespace-nowrap",
                  is
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground",
                )}
                dir="rtl"
              >
                <span className="me-2">{l.labelHe}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    is ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {LEVELS.map((l) => {
        if (l.value !== activeLevel) return null;
        const rows = initialByLevel[l.value] ?? [];
        const t = totals[l.value];
        return (
          <section
            key={l.value}
            className="bg-card space-y-3 rounded-lg border p-5"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2
                  className={cn(
                    "inline-flex items-baseline gap-2 rounded-md border px-2.5 py-1 text-base font-semibold",
                    l.accent,
                  )}
                  dir="rtl"
                >
                  {l.labelHe}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs" dir="rtl">
                  {l.hint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t.total} cards · {t.active} active · {t.preview} preview
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAdd(l.value)}
                  disabled={pendingCreate}
                >
                  {pendingCreate ? (
                    <Loader2 className="me-1 size-4 animate-spin" />
                  ) : (
                    <Plus className="me-1 size-4" />
                  )}
                  New card
                </Button>
              </div>
            </header>

            {rows.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">
                No cards yet - click{" "}
                <strong className="text-foreground">New card</strong> to add the
                first one.
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {rows.map((row, idx) => (
                  <ContentRow
                    key={row.id}
                    row={row}
                    index={idx}
                    total={rows.length}
                    gameId={gameId}
                    levelRows={rows}
                    onEdit={() => setEditing(row)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {editing ? (
        <ContentEditDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          row={editing}
        />
      ) : null}
    </>
  );
}

function ContentRow({
  row,
  index,
  total,
  gameId,
  levelRows,
  onEdit,
}: {
  row: ExperienceGameContent;
  index: number;
  total: number;
  gameId: string;
  levelRows: ExperienceGameContent[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const move = (dir: "up" | "down") => {
    const newIdx = dir === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= levelRows.length) return;
    const ordered = [...levelRows];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(newIdx, 0, moved);
    startTransition(async () => {
      const res = await reorderContent(
        gameId,
        row.level,
        ordered.map((r) => r.id),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  const toggle = (field: "is_active" | "is_preview", value: boolean) => {
    startTransition(async () => {
      const res = await toggleContentFlag(row.id, field, value, gameId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  const dup = () => {
    startTransition(async () => {
      const res = await duplicateContent(row.id);
      if (!res.ok) {
        toast.error(res.error._root?.[0] ?? "Duplicate failed");
        return;
      }
      toast.success("Duplicated");
      router.refresh();
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const res = await deleteContent(row.id, gameId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted");
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        {/* Order controls */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => move("up")}
            disabled={busy || index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp className="size-4" />
          </button>
          <span className="text-muted-foreground text-center text-[10px] font-mono">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => move("down")}
            disabled={busy || index === total - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Body */}
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-start"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium" dir="rtl">
              {row.title_he || (
                <em className="text-muted-foreground">Untitled</em>
              )}
            </span>
            {row.title_en ? (
              <span className="text-muted-foreground text-xs">
                · {row.title_en}
              </span>
            ) : null}
          </div>
          <p
            className="text-muted-foreground mt-0.5 line-clamp-2 text-sm"
            dir="rtl"
          >
            {row.body_he || row.body_en || (
              <em>No body yet - click to edit</em>
            )}
          </p>
        </button>

        {/* Flags + actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggle("is_preview", !row.is_preview)}
            disabled={busy}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] uppercase tracking-wide transition-colors",
              row.is_preview
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            title={row.is_preview ? "Hide from preview" : "Show in preview"}
          >
            {row.is_preview ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
          </button>

          <Badge
            variant={row.is_active ? "default" : "secondary"}
            className="cursor-pointer select-none"
            onClick={() => toggle("is_active", !row.is_active)}
            title="Toggle active"
          >
            {row.is_active ? "Active" : "Draft"}
          </Badge>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit"
            className="h-8 w-8"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={dup}
            disabled={busy}
            aria-label="Duplicate"
            className="h-8 w-8"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            aria-label="Delete"
            className="h-8 w-8"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete card?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This removes the card from this game. Content already purchased by
            couples remains in their entitlement history, but this card will no
            longer appear.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={confirmDelete}
            >
              {busy ? <Loader2 className="me-1 size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function ContentEditDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: ExperienceGameContent;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [titleHe, setTitleHe] = useState(row.title_he ?? "");
  const [titleEn, setTitleEn] = useState(row.title_en ?? "");
  const [bodyHe, setBodyHe] = useState(row.body_he ?? "");
  const [bodyEn, setBodyEn] = useState(row.body_en ?? "");
  const [isPreview, setIsPreview] = useState(row.is_preview);
  const [isActive, setIsActive] = useState(row.is_active);
  const [orderIndex, setOrderIndex] = useState(row.order_index);

  async function onSave() {
    setSaving(true);
    const res = await saveContent(row.id, {
      game_id: row.game_id,
      level: row.level,
      order_index: orderIndex,
      title_he: titleHe,
      title_en: titleEn,
      body_he: bodyHe,
      body_en: bodyEn,
      is_preview: isPreview,
      is_active: isActive,
    });
    setSaving(false);
    if (!res.ok) {
      const firstField = Object.keys(res.error ?? {})[0];
      const firstMsg =
        (res.error as Record<string, string[] | undefined>)?.[firstField ?? ""]?.[0] ??
        "Save failed";
      toast.error(firstMsg);
      return;
    }
    toast.success("Saved");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            <span>Edit card</span>
            <span className="text-muted-foreground text-xs" dir="rtl">
              ({levelLabel(row.level)})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
            <div className="space-y-1.5">
              <Label className="text-xs">Title (HE)</Label>
              <Input
                dir="rtl"
                value={titleHe}
                onChange={(e) => setTitleHe(e.target.value)}
                maxLength={120}
                placeholder="כותרת כרטיס"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title (EN)</Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                maxLength={120}
                placeholder="Card title"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Order</Label>
              <Input
                type="number"
                min={0}
                max={9999}
                value={orderIndex}
                onChange={(e) =>
                  setOrderIndex(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label className="text-xs">Body (HE)</Label>
                <span className="text-muted-foreground text-[10px]">
                  {bodyHe.length}/4000
                </span>
              </div>
              <Textarea
                dir="rtl"
                value={bodyHe}
                onChange={(e) => setBodyHe(e.target.value)}
                rows={8}
                maxLength={4000}
                placeholder="גוף הכרטיס - מה זוג רואה כשהם פותחים אותו"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label className="text-xs">Body (EN)</Label>
                <span className="text-muted-foreground text-[10px]">
                  {bodyEn.length}/4000
                </span>
              </div>
              <Textarea
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                rows={8}
                maxLength={4000}
                placeholder="Body - what the couple sees when opening this card"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 rounded-md border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span>Active</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={isPreview} onCheckedChange={setIsPreview} />
              <span>
                Preview{" "}
                <span className="text-muted-foreground">
                  (visible to non-owners)
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? <Loader2 className="me-1 size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function levelLabel(l: Level): string {
  return l === "ללא_גבולות" ? "ללא גבולות" : l;
}
