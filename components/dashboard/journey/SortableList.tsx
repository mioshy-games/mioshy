"use client";

// ============================================================
// SortableList — reusable drag-and-drop wrapper around @dnd-kit.
//
// v3 slice 2: powers the two-level reorder UI on the category-detail
// page (subtopics within a category, items within a subtopic). The
// caller passes a stable list of items + a render function for each
// row; SortableList handles the drag math and calls onReorder with
// the new ordered ID list.
//
// Behaviour:
//   * Pointer + keyboard sensors. Keyboard activation matches dnd-kit
//     default (Space to pick up, arrow keys to move, Space to drop).
//   * RTL-safe. dnd-kit reorders by Y coordinate so direction doesn't
//     matter; we still re-assert dir on the wrapper for the drag-handle
//     placement.
//   * Optimistic UI: the local order updates immediately on drop, and
//     onReorder is fired so the server can persist. If onReorder
//     throws or returns { ok: false }, we revert to the previous
//     order and surface a toast (caller's responsibility).
//   * Disabled state: when `pending` is true the whole list is
//     non-interactive (used while the server action is in flight).
// ============================================================

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

export interface SortableItem {
  id: string;
}

export interface SortableListProps<T extends SortableItem> {
  items: T[];
  /** Called with the new ordered id list after a successful drop.
   *  Should perform the server write and resolve to ok / error. */
  onReorder: (orderedIds: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Render the row body. The drag handle is rendered separately
   *  (always at the inline-end side) — don't include it here. */
  renderRow: (item: T, opts: { isDragging: boolean }) => ReactNode;
  /** Optional className for each row's outer wrapper. */
  rowClassName?: string;
  /** Optional className for the list (ul). */
  className?: string;
  /** When true, freeze the list (used while a save is in flight). */
  disabled?: boolean;
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderRow,
  rowClassName,
  className,
  disabled = false,
}: SortableListProps<T>) {
  const [order, setOrder] = useState<T[]>(items);
  const [pending, startTransition] = useTransition();

  // Re-sync local order when the parent passes a new `items` (e.g. after
  // router.refresh). We track the previous server-canonical id list
  // and only overwrite local state when it actually changes — this
  // way an in-flight optimistic order isn't clobbered mid-drop.
  const lastServerIdsRef = useRef<string>(items.map((i) => i.id).join("|"));
  useEffect(() => {
    const nextKey = items.map((i) => i.id).join("|");
    if (nextKey !== lastServerIdsRef.current) {
      lastServerIdsRef.current = nextKey;
      setOrder(items);
    }
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // small drag threshold to avoid grabbing during clicks
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(order, oldIndex, newIndex);
    const previous = order;
    setOrder(next);

    startTransition(async () => {
      try {
        const res = await onReorder(next.map((it) => it.id));
        if (!res.ok) {
          toast.error(`Reorder failed: ${res.error}`);
          setOrder(previous);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(`Reorder failed: ${msg}`);
        setOrder(previous);
      }
    });
  }

  const isFrozen = disabled || pending;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          className={
            className ?? "flex flex-col gap-2"
          }
          aria-busy={pending || undefined}
        >
          {order.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              disabled={isFrozen}
              className={rowClassName}
            >
              {(opts) => renderRow(item, opts)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled: boolean;
  className?: string;
  children: (opts: { isDragging: boolean }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    // Lift the dragging row above its siblings so the visual hierarchy
    // matches the user's mental model of "I'm holding this card".
    zIndex: isDragging ? 30 : undefined,
    position: "relative",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        className ??
        "border-border bg-card flex items-center gap-2 rounded-lg border p-2"
      }
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        className="text-muted-foreground hover:text-foreground -m-1 cursor-grab touch-none p-1 disabled:cursor-not-allowed"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children({ isDragging })}</div>
    </li>
  );
}
