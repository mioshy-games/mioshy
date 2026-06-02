"use client";

/**
 * ItemQuickRow
 *
 * Quick-manage row for /dashboard/journey/items. Three jobs:
 *
 *   1. Expand chevron next to the title → inline view-only preview of
 *      the lesson blocks (insight / body / task / do-don't / etc.) so
 *      admins can glance at content without opening the full editor.
 *   2. Inline active/inactive Switch — flips is_active via
 *      setJourneyItemActive and revalidates the journey layout. No
 *      navigation, no modal.
 *   3. Title is still a Link to the editor for full edits.
 *
 * The preview block is rendered as a second <TableRow> with colSpan
 * spanning every column, so the table stays a single grid (the
 * shadcn Table is just a styled <table>; nested elements break it).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button, buttonVariants } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  setJourneyItemActive,
  deleteJourneyItem,
  moveJourneyItem,
} from "@/app/dashboard/actions/journey-content";
import { cn } from "@/lib/utils";
import type { JourneyItem } from "@/lib/journey-content/types";

type CategoryLite = {
  id: string;
  name_he: string;
  program_id: string | null;
};

type LiveStats = {
  queued: number;
  delivered: number;
  completed: number;
  skipped: number;
};

interface ItemQuickRowProps {
  item: JourneyItem;
  category: CategoryLite | undefined;
  programLabel: string | null;
  stats: LiveStats | undefined;
}

/**
 * One "section" inside the expanded preview. Title is small uppercase
 * label, body is whitespace-preserved paragraph. Returns null when the
 * field is empty so we never render an empty card.
 */
function PreviewBlock({
  label,
  body,
  tone = "default",
}: {
  label: string;
  body: string | null | undefined;
  tone?: "default" | "do" | "dont" | "warn" | "task";
}) {
  const trimmed = body?.trim();
  if (!trimmed) return null;

  const toneClasses: Record<typeof tone, string> = {
    default: "border-border bg-muted/30",
    do: "border-emerald-500/20 bg-emerald-500/[0.04]",
    dont: "border-rose-500/20 bg-rose-500/[0.04]",
    warn: "border-amber-500/20 bg-amber-500/[0.04]",
    task: "border-primary/25 bg-primary/[0.05]",
  };

  const labelTone: Record<typeof tone, string> = {
    default: "text-muted-foreground",
    do: "text-emerald-700 dark:text-emerald-300",
    dont: "text-rose-700 dark:text-rose-300",
    warn: "text-amber-700 dark:text-amber-300",
    task: "text-primary",
  };

  // Direction per content — Hebrew text gets dir=rtl + right-aligned,
  // English gets dir=ltr + left-aligned. The label sits at the start of
  // the writing direction so it visually anchors the block.
  const dir = detectDir(trimmed);
  return (
    <div className={cn("rounded-md border p-3", toneClasses[tone])}>
      <div
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-wider",
          labelTone[tone],
        )}
        dir={dir}
        style={{ textAlign: dir === "rtl" ? "right" : "left" }}
      >
        {label}
      </div>
      <p
        className="whitespace-pre-line text-sm leading-relaxed text-foreground/90"
        dir={dir}
        style={{ textAlign: dir === "rtl" ? "right" : "left" }}
      >
        {trimmed}
      </p>
    </div>
  );
}

// Build-time marker so we can confirm this exact module is being served.
// Bump when making visible changes — the value renders into the DOM via
// data-build on every row and logs once per row mount.
const ITEM_QUICK_ROW_BUILD = "v4-2026-05-27-compact+rtl";

/**
 * Cheap text-direction detector — looks for ANY Hebrew/Arabic character
 * (U+0590-U+07BF). If there's even one Hebrew char we treat the string
 * as RTL; otherwise LTR. Good enough for admin previews; properly
 * mixed strings still render fine because we set dir + text-align,
 * which only affects the paragraph's primary direction.
 */
function detectDir(text: string): "rtl" | "ltr" {
  // Hebrew U+0590-U+05FF, Arabic U+0600-U+06FF, Syriac U+0700-U+074F.
  return /[֐-׿؀-ۿ܀-ݏ]/.test(text) ? "rtl" : "ltr";
}

export function ItemQuickRow({
  item,
  category,
  programLabel,
  stats,
}: ItemQuickRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  // One-shot mount log per item via lazy useState initializer. If you
  // don't see any "[ItemQuickRow]" lines in the console, the page is
  // still serving the OLD bundle (Next dev cache or a Vercel deploy that
  // hasn't refreshed). Hard-reload (Cmd+Shift+R) or restart `next dev`.
  useState(() => {
    if (typeof window !== "undefined") {
      console.log(
        `[ItemQuickRow ${ITEM_QUICK_ROW_BUILD}] mount`,
        { id: item.id, slug: item.slug, is_active: item.is_active },
      );
    }
    return null;
  });
  // Optimistic copy of is_active so the switch feels instant — the
  // server action revalidates the layout, but we don't want the thumb
  // to lag a network round-trip behind the click.
  const [isActive, setIsActive] = useState(item.is_active);
  const [, startTransition] = useTransition();
  const [pendingToggle, setPendingToggle] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // 2026-06-02 — sort_order reorder. Calls the server action that
  // swaps this row with its same-category neighbour, then lets
  // revalidatePath redraw the list with the new positions. We disable
  // both arrow buttons during the round-trip so a panicked double-
  // click can't fire two swaps interleaved.
  function handleMove(direction: "up" | "down") {
    if (isMoving) return;
    setIsMoving(true);
    startTransition(async () => {
      try {
        await moveJourneyItem(item.id, direction);
      } catch (err) {
        // Best-effort — the page revalidates on next render anyway,
        // so a stale state will resolve on its own.
        console.error("[ItemQuickRow.handleMove]", err);
      } finally {
        setIsMoving(false);
      }
    });
  }

  const editHref = `/dashboard/journey/items/${item.id}`;

  const completionRate =
    stats && stats.delivered > 0
      ? Math.round((stats.completed / stats.delivered) * 100)
      : null;
  const skipRate =
    stats && stats.delivered > 0
      ? Math.round((stats.skipped / stats.delivered) * 100)
      : null;

  async function handleToggle(next: boolean) {
    const prev = isActive;
    setIsActive(next);
    setPendingToggle(true);
    const res = await setJourneyItemActive(item.id, next);
    setPendingToggle(false);
    if (!res.ok) {
      // Roll back on failure.
      setIsActive(prev);
      toast.error(res.error || "שמירה נכשלה");
      return;
    }
    toast.success(
      next
        ? "הפריט הופעל — יוצג שוב לזוגות"
        : "הפריט הוסתר — לא יוצג יותר. עדיין שמור במערכת.",
    );
    // Refresh server-rendered counts/badges elsewhere on the page.
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    setPendingDelete(true);
    const res = await deleteJourneyItem(item.id);
    setPendingDelete(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.error(res.error || "המחיקה נכשלה");
      return;
    }
    toast.success("הפריט נמחק לחלוטין");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <TableRow
        data-item-id={item.id}
        data-build={ITEM_QUICK_ROW_BUILD}
        className={expanded ? "border-b-0" : undefined}
      >
        {/* פריט — חץ + טייטל + שורת מטה (slug · sort · offset · audience) */}
        <TableCell>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "סגור תצוגה מקדימה" : "פתח תצוגה מקדימה"}
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                expanded && "bg-muted text-foreground",
              )}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronLeft className="size-4 rtl:rotate-180" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <Link
                href={editHref}
                className="font-medium hover:underline"
                dir="rtl"
              >
                {item.title_he}
              </Link>
              {item.title_en ? (
                <div
                  className="text-muted-foreground text-xs"
                  dir="ltr"
                  style={{ textAlign: "left" }}
                >
                  {item.title_en}
                </div>
              ) : null}
              {/* Meta line — slug + sort + offset + audience packed small */}
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <code className="font-mono">{item.slug}</code>
                <span aria-hidden>·</span>
                <span>#{item.sort_order}</span>
                <span aria-hidden>·</span>
                <span>+{item.default_offset_days}d</span>
                <span aria-hidden>·</span>
                <span>{item.audience}</span>
              </div>
            </div>
          </div>
        </TableCell>

        {/* קטגוריה */}
        <TableCell className="text-xs">
          {category ? (
            <Link
              href={`/dashboard/journey/categories/${category.id}`}
              className="hover:underline"
            >
              {programLabel ? `${programLabel} · ` : ""}
              {category.name_he}
            </Link>
          ) : (
            "-"
          )}
        </TableCell>

        {/* סטטוס — Switch+Badge */}
        <TableCell>
          <label
            className="flex cursor-pointer items-center gap-2"
            title={
              isActive
                ? "פעיל — מוצג לזוגות. כבה כדי להסתיר (לא מחיקה)."
                : "מוסתר — לא יוצג לזוגות. הפריט והנתונים שמורים."
            }
          >
            <Switch
              size="sm"
              checked={isActive}
              disabled={pendingToggle}
              onCheckedChange={handleToggle}
              aria-label={isActive ? "פעיל — לחץ כדי להסתיר" : "מוסתר — לחץ כדי להציג"}
            />
            <Badge
              variant={isActive ? "default" : "secondary"}
              className="text-[10px]"
            >
              {isActive ? "פעיל" : "מוסתר"}
            </Badge>
          </label>
        </TableCell>

        {/* Q/D/C/S */}
        <TableCell className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {stats ? (
            <span
              dir="ltr"
              title={`Queued ${stats.queued} · Delivered ${stats.delivered} · Completed ${stats.completed} (${completionRate ?? 0}%) · Skipped ${stats.skipped} (${skipRate ?? 0}%)`}
            >
              Q{stats.queued}/D{stats.delivered}/
              {completionRate !== null ? `${completionRate}%C` : "-C"}
              /{skipRate !== null ? `${skipRate}%S` : "-S"}
            </span>
          ) : (
            "-"
          )}
        </TableCell>

        {/* פעולות — סדר תצוגה + ערוך + מחק */}
        <TableCell className="text-end">
          <div className="flex items-center justify-end gap-1">
            {/* 2026-06-02 — sort_order swap. The arrows swap this row
                with its neighbour in the same category (atomic — no
                gaps, no duplicates). Lightweight: one server action
                per click, revalidates the layout, no extra client
                state. isMoving disables both buttons during the round-
                trip so a fast double-click can't race the SQL. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isMoving}
              onClick={() => handleMove("up")}
              aria-label="העבר למעלה"
              title="העבר למעלה (יוצג מוקדם יותר)"
              className="h-7 w-7"
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isMoving}
              onClick={() => handleMove("down")}
              aria-label="העבר למטה"
              title="העבר למטה (יוצג מאוחר יותר)"
              className="h-7 w-7"
            >
              <ArrowDown className="size-4" />
            </Button>
            <Link
              href={editHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex gap-1.5",
              )}
              title="פתח עורך מלא"
            >
              <Pencil className="size-3.5" />
              ערוך
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="מחק לחלוטין"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="מחק לחלוטין (cascade — לא הפיך)"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              למחוק את הפריט לחלוטין?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <strong>&ldquo;{item.title_he}&rdquo;</strong> יימחק לצמיתות
              מהקטלוג. גם כל ה-scheduled_items, התגובות וההשלמות של זוגות
              שכבר קיבלו אותו יימחקו עם cascade. הפעולה לא הפיכה.
            </p>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <div className="mb-1 font-semibold text-amber-700 dark:text-amber-300">
                רצית רק להסתיר?
              </div>
              <p className="text-foreground/80">
                סגור את הדיאלוג והשתמש בטוגל בעמודת Status — הפריט פשוט
                לא יוצג יותר, אבל היסטוריה ותגובות של זוגות שכבר קיבלו
                יישמרו.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pendingDelete}
            >
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingDelete}
              onClick={() => void handleDelete()}
            >
              מחק לחלוטין
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {expanded ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={5} className="p-0">
            <div className="space-y-3 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.slug}</span>
                <span>·</span>
                <span>קהל: {item.audience}</span>
                {item.est_minutes ? (
                  <>
                    <span>·</span>
                    <span>~{item.est_minutes} ד&apos;</span>
                  </>
                ) : null}
                {item.stage ? (
                  <>
                    <span>·</span>
                    <span>שלב {item.stage}</span>
                  </>
                ) : null}
                <span className="ms-auto">
                  <Link
                    href={editHref}
                    className="text-primary hover:underline"
                  >
                    פתח עורך מלא ←
                  </Link>
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <PreviewBlock
                  label="תובנת מומחים"
                  body={item.expert_insight_he || item.expert_insight_en}
                />
                <PreviewBlock
                  label="טעות שכיחה"
                  body={item.common_mistakes_he || item.common_mistakes_en}
                  tone="warn"
                />
                <PreviewBlock
                  label="מטאפורה"
                  body={item.metaphor_he || item.metaphor_en}
                />
                <PreviewBlock
                  label="למדוד השבוע"
                  body={item.measurement_he || item.measurement_en}
                />
                <PreviewBlock
                  label="לעשות השבוע"
                  body={item.do_this_week_he || item.do_this_week_en}
                  tone="do"
                />
                <PreviewBlock
                  label="לא לעשות השבוע"
                  body={item.dont_this_week_he || item.dont_this_week_en}
                  tone="dont"
                />
                <PreviewBlock
                  label="סימן להתקדמות"
                  body={item.progress_marker_he || item.progress_marker_en}
                />
                <PreviewBlock
                  label="משימה"
                  body={item.task_he || item.task_en}
                  tone="task"
                />
              </div>

              {/* Main body — full width below the grid. */}
              {(item.body_he?.trim() || item.body_en?.trim()) ? (
                <PreviewBlock
                  label="המאמר המלא"
                  body={item.body_he || item.body_en}
                />
              ) : null}

              {(item.challenge_he?.trim() || item.challenge_en?.trim()) ? (
                <PreviewBlock
                  label="אתגר"
                  body={item.challenge_he || item.challenge_en}
                />
              ) : null}

              {(item.source_attribution_he?.trim() ||
                item.source_attribution_en?.trim()) ? (
                <div className="pt-1 text-xs text-muted-foreground">
                  מקור: {item.source_attribution_he || item.source_attribution_en}
                </div>
              ) : null}

              {/* Safety net for legacy items with no content at all. */}
              {!item.body_he?.trim() &&
              !item.body_en?.trim() &&
              !item.task_he?.trim() &&
              !item.expert_insight_he?.trim() ? (
                <div className="text-sm italic text-muted-foreground">
                  לפריט הזה אין עדיין תוכן. פתח את העורך כדי להוסיף.
                </div>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
