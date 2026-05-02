"use client";

// ============================================================
// PushComposer — slice 8 admin page for pushing items to a
// recipient (user / couple / group). Three steps stacked vertically:
//
//   1. Recipient picker (kind radio + typeahead/select)
//   2. Item picker (filterable multi-select)
//   3. Reason note + submit (with row-count preview)
//
// Submit calls pushItemsToRecipient → fans out N×M pending_pushes
// rows. The cadence engine consumes them on each member's next slot.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  pushItemsToRecipient,
  searchCouples,
  type CouplePickerHit,
  type GroupPickerHit,
} from "@/app/dashboard/actions/journey-push";
import { HintIcon } from "@/components/ui/hint-icon";
import {
  searchGroupCandidates,
  type UserSearchHit,
} from "@/app/dashboard/actions/journey-groups";

type RecipientKind = "user" | "couple" | "group";

interface ItemRow {
  id: string;
  title_he: string;
  title_en: string | null;
  category_id: string;
  subtopic_id: string | null;
  is_active: boolean;
}

interface CategoryRow {
  id: string;
  name_he: string;
}

interface SubtopicRow {
  id: string;
  name_he: string;
  category_id: string;
}

interface Props {
  items: ItemRow[];
  categories: CategoryRow[];
  subtopics: SubtopicRow[];
  groups: GroupPickerHit[];
}

interface RecipientPick {
  kind: RecipientKind;
  id: string;
  /** Human label shown in the summary footer. */
  label: string;
  /** Approximate target count for the row preview. For couple it's
   *  always 2; for group it's the member_count from the picker hit;
   *  for user it's 1. */
  approxTargetCount: number;
}

export function PushComposer({
  items,
  categories,
  subtopics,
  groups,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = React.useState<RecipientKind>("user");
  const [recipient, setRecipient] = React.useState<RecipientPick | null>(null);

  // Item filters + selection
  const [itemSearch, setItemSearch] = React.useState("");
  const [filterCategoryId, setFilterCategoryId] = React.useState<string>("");
  const [filterSubtopicId, setFilterSubtopicId] = React.useState<string>("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Filter items based on category + subtopic + free text
  const filteredItems = React.useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    return items.filter((it) => {
      if (filterCategoryId && it.category_id !== filterCategoryId) return false;
      if (filterSubtopicId === "__none__" && it.subtopic_id !== null) return false;
      if (
        filterSubtopicId &&
        filterSubtopicId !== "__none__" &&
        it.subtopic_id !== filterSubtopicId
      )
        return false;
      if (term.length > 0) {
        const t = `${it.title_he} ${it.title_en ?? ""}`.toLowerCase();
        if (!t.includes(term)) return false;
      }
      return true;
    });
  }, [items, itemSearch, filterCategoryId, filterSubtopicId]);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = items.filter((it) => selectedSet.has(it.id));

  // Subtopics scoped to the picked filter category. When category
  // changes, reset the subtopic filter.
  const subtopicsForFilter = subtopics.filter(
    (s) => !filterCategoryId || s.category_id === filterCategoryId,
  );
  React.useEffect(() => {
    setFilterSubtopicId("");
  }, [filterCategoryId]);

  function toggleItem(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function handleSubmit() {
    if (!recipient) {
      toast.error("Pick a recipient");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Pick at least one item");
      return;
    }
    setSubmitting(true);
    const res = await pushItemsToRecipient({
      recipient: { kind: recipient.kind, id: recipient.id },
      itemIds: selectedIds,
      reasonNote: reason,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(`Push failed: ${res.error}`);
      return;
    }
    toast.success(
      `Pushed ${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} to ${res.targetCount} recipient${res.targetCount === 1 ? "" : "s"} (${res.rowsCreated} pending row${res.rowsCreated === 1 ? "" : "s"})`,
    );
    setSelectedIds([]);
    setReason("");
    router.refresh();
  }

  const previewRowCount = recipient
    ? recipient.approxTargetCount * selectedIds.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Step 1 — recipient */}
      <section className="bg-card rounded-lg border p-5">
        <header className="mb-4">
          <span className="inline-flex items-center gap-1.5">
            <h2 className="text-lg font-semibold">1. Recipient</h2>
            <HintIcon topic="push.recipient_kind" />
          </span>
          <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 text-xs">
            <span>
              Pushes ride the recipient's next delivery slot — they don't
              deliver instantly.
            </span>
            <HintIcon topic="push.delivery_slot_explanation" />
          </p>
        </header>

        <div className="mb-4 inline-flex rounded-lg border p-1">
          {(["user", "couple", "group"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setRecipient(null);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm capitalize transition-colors",
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>

        {kind === "user" ? (
          <UserPickerInline
            selected={recipient?.kind === "user" ? recipient : null}
            onPick={(hit) =>
              setRecipient({
                kind: "user",
                id: hit.user_id,
                label: hit.full_name || hit.email || hit.user_id.slice(0, 8),
                approxTargetCount: 1,
              })
            }
            onClear={() => setRecipient(null)}
          />
        ) : kind === "couple" ? (
          <CouplePickerInline
            selected={recipient?.kind === "couple" ? recipient : null}
            onPick={(hit) =>
              setRecipient({
                kind: "couple",
                id: hit.couple_id,
                label: coupleLabel(hit),
                approxTargetCount: 2,
              })
            }
            onClear={() => setRecipient(null)}
          />
        ) : (
          <GroupPickerInline
            groups={groups}
            selected={recipient?.kind === "group" ? recipient : null}
            onPick={(hit) =>
              setRecipient({
                kind: "group",
                id: hit.group_id,
                label: hit.label_he,
                approxTargetCount: hit.member_count,
              })
            }
            onClear={() => setRecipient(null)}
          />
        )}
      </section>

      {/* Step 2 — items */}
      <section className="bg-card rounded-lg border p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">2. Items</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Selected: <strong>{selectedIds.length}</strong>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="ms-2 text-xs underline hover:no-underline"
                >
                  Clear
                </button>
              ) : null}
            </p>
          </div>
        </header>

        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Filter by title…"
              className="ps-8"
            />
          </div>
          <Select
            value={filterCategoryId || "__all__"}
            onValueChange={(v) =>
              setFilterCategoryId(v === "__all__" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name_he}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterSubtopicId || "__all__"}
            onValueChange={(v) =>
              setFilterSubtopicId(v === "__all__" ? "" : v)
            }
            disabled={!filterCategoryId}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={filterCategoryId ? "All subtopics" : "Pick a category"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All subtopics</SelectItem>
              <SelectItem value="__none__">Direct (no subtopic)</SelectItem>
              {subtopicsForFilter.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_he}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-border max-h-[420px] overflow-y-auto rounded-lg border">
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              No items match these filters.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((it) => {
                const checked = selectedSet.has(it.id);
                return (
                  <li
                    key={it.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/40",
                      checked && "bg-primary/5",
                    )}
                    onClick={() => toggleItem(it.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(it.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4"
                      aria-label={`Select ${it.title_he}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {it.title_he}
                      </div>
                      {it.title_en ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {it.title_en}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selected items chip row — visible across filters so the
            admin can see what they've staged even if a filter hides
            some of the selected items. */}
        {selectedItems.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedItems.map((it) => (
              <Badge
                key={it.id}
                variant="secondary"
                className="inline-flex items-center gap-1"
              >
                <span className="max-w-[200px] truncate">{it.title_he}</span>
                <button
                  type="button"
                  onClick={() => toggleItem(it.id)}
                  className="hover:text-destructive"
                  aria-label={`Remove ${it.title_he}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </section>

      {/* Step 3 — reason + submit */}
      <section className="bg-card rounded-lg border p-5">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">3. Reason note (optional)</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Surfaces only on the dashboard side — users don't see this.
          </p>
        </header>
        <Label htmlFor="reason" className="sr-only">
          Reason note
        </Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why this push, for the next clinician on duty…"
          className="mb-4"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="text-muted-foreground text-xs">
            {recipient ? (
              <>
                Will create <strong>{previewRowCount}</strong> pending push
                row{previewRowCount === 1 ? "" : "s"} (
                {selectedIds.length} item{selectedIds.length === 1 ? "" : "s"} ×{" "}
                {recipient.approxTargetCount} target
                {recipient.approxTargetCount === 1 ? "" : "s"} via{" "}
                <strong>{recipient.label}</strong>).
              </>
            ) : (
              <>Pick a recipient and at least one item to enable the push.</>
            )}
          </div>
          <Button
            type="button"
            disabled={submitting || !recipient || selectedIds.length === 0}
            onClick={() => void handleSubmit()}
            className="min-w-[140px]"
          >
            {submitting ? (
              <Loader2 className="me-2 size-4 animate-spin" />
            ) : (
              <Send className="me-2 size-4" />
            )}
            Push
          </Button>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// Recipient picker variants (inline because they share state with
// the parent and pulling them into separate files would require a
// callback/event protocol that doesn't pay rent yet).
// ------------------------------------------------------------

function UserPickerInline({
  selected,
  onPick,
  onClear,
}: {
  selected: RecipientPick | null;
  onPick: (hit: UserSearchHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<UserSearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const results = await searchGroupCandidates(trimmed);
        setHits(results);
      } catch (e) {
        toast.error(`Search failed: ${e instanceof Error ? e.message : "?"}`);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  if (selected) {
    return <SelectedRecipientPill recipient={selected} onClear={onClear} />;
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="ps-8"
        />
        {searching ? (
          <Loader2
            className="text-muted-foreground absolute end-2 top-1/2 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : null}
      </div>
      {hits.length > 0 ? (
        <ul className="bg-muted/30 mt-2 max-h-[260px] divide-y divide-border overflow-y-auto rounded-lg border">
          {hits.map((h) => (
            <li
              key={h.user_id}
              className="hover:bg-muted/60 flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors"
              onClick={() => onPick(h)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {h.full_name || h.email || `${h.user_id.slice(0, 8)}…`}
                </div>
                {h.full_name && h.email ? (
                  <div className="text-muted-foreground truncate text-xs">
                    {h.email}
                  </div>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">Pick</span>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 && !searching ? (
        <p className="text-muted-foreground mt-2 text-xs">No matches.</p>
      ) : null}
    </div>
  );
}

function CouplePickerInline({
  selected,
  onPick,
  onClear,
}: {
  selected: RecipientPick | null;
  onPick: (hit: CouplePickerHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<CouplePickerHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const results = await searchCouples(trimmed);
        setHits(results);
      } catch (e) {
        toast.error(`Search failed: ${e instanceof Error ? e.message : "?"}`);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  if (selected) {
    return <SelectedRecipientPill recipient={selected} onClear={onClear} />;
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by display name, pair code, or member email…"
          className="ps-8"
        />
        {searching ? (
          <Loader2
            className="text-muted-foreground absolute end-2 top-1/2 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : null}
      </div>
      {hits.length > 0 ? (
        <ul className="bg-muted/30 mt-2 max-h-[260px] divide-y divide-border overflow-y-auto rounded-lg border">
          {hits.map((h) => (
            <li
              key={h.couple_id}
              className="hover:bg-muted/60 flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors"
              onClick={() => onPick(h)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {coupleLabel(h)}
                </div>
                {h.member_emails.length > 0 ? (
                  <div className="text-muted-foreground truncate text-xs">
                    {h.member_emails.join(", ")}
                  </div>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">Pick</span>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 && !searching ? (
        <p className="text-muted-foreground mt-2 text-xs">No matches.</p>
      ) : null}
    </div>
  );
}

function GroupPickerInline({
  groups,
  selected,
  onPick,
  onClear,
}: {
  groups: GroupPickerHit[];
  selected: RecipientPick | null;
  onPick: (hit: GroupPickerHit) => void;
  onClear: () => void;
}) {
  if (selected) {
    return <SelectedRecipientPill recipient={selected} onClear={onClear} />;
  }
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No active groups. Create one in /dashboard/journey/groups first.
      </p>
    );
  }
  return (
    <Select onValueChange={(v) => {
      const g = groups.find((x) => x.group_id === v);
      if (g) onPick(g);
    }}>
      <SelectTrigger>
        <SelectValue placeholder="Pick a group…" />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectItem key={g.group_id} value={g.group_id}>
            {g.label_he} · {g.member_count} member{g.member_count === 1 ? "" : "s"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SelectedRecipientPill({
  recipient,
  onClear,
}: {
  recipient: RecipientPick;
  onClear: () => void;
}) {
  return (
    <div className="bg-primary/5 border-primary/20 inline-flex items-center gap-2 rounded-lg border p-3">
      <Badge variant="outline" className="text-[10px] uppercase">
        {recipient.kind}
      </Badge>
      <span className="text-sm font-medium">{recipient.label}</span>
      <span className="text-muted-foreground text-xs">
        · {recipient.approxTargetCount} target
        {recipient.approxTargetCount === 1 ? "" : "s"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Clear recipient"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function coupleLabel(h: CouplePickerHit): string {
  if (h.display_name && h.display_name.trim().length > 0) return h.display_name;
  if (h.member_emails.length > 0) return h.member_emails.join(" + ");
  if (h.pair_code) return `Pair ${h.pair_code}`;
  return `Couple ${h.couple_id.slice(0, 8)}…`;
}
