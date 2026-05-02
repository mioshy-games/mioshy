"use client";

// ============================================================
// GroupMemberPicker — slice 7 v3 admin UI for managing group
// membership.
//
// Layout:
//   ┌─ search input + result list (live, debounced) ──┐
//   │  hit row: name/email · "Add user" · "Add couple" │
//   └─────────────────────────────────────────────────┘
//   ┌─ current members table (remove per row) ────────┐
//
// Members are users only; the "Add couple" button on a hit row
// surfaces only when the user has a couple_members entry, and
// resolves to inserting both partners. (Locked in slice 1 spec.)
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCoupleAsGroupMembers,
  addGroupMember,
  removeGroupMember,
  searchGroupCandidates,
  type UserSearchHit,
} from "@/app/dashboard/actions/journey-groups";
import type { GroupMemberRow } from "@/lib/journey-content/queries";

interface Props {
  groupId: string;
  initialMembers: GroupMemberRow[];
}

export function GroupMemberPicker({ groupId, initialMembers }: Props) {
  const router = useRouter();
  const [members, setMembers] = React.useState<GroupMemberRow[]>(initialMembers);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<UserSearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null); // user_id or "couple:<id>"

  // Sync from server when revalidate ships.
  const lastIdsRef = React.useRef<string>(
    initialMembers.map((m) => m.user_id).join("|"),
  );
  React.useEffect(() => {
    const next = initialMembers.map((m) => m.user_id).join("|");
    if (next !== lastIdsRef.current) {
      lastIdsRef.current = next;
      setMembers(initialMembers);
    }
  }, [initialMembers]);

  // Debounced search.
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

  const memberIdSet = React.useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members],
  );

  async function handleAddUser(hit: UserSearchHit) {
    setBusy(hit.user_id);
    const res = await addGroupMember({ groupId, userId: hit.user_id });
    setBusy(null);
    if (!res.ok) {
      toast.error(`Add failed: ${res.error}`);
      return;
    }
    toast.success(
      `Added ${hit.full_name || hit.email || hit.user_id.slice(0, 8)}`,
    );
    router.refresh();
  }

  async function handleAddCouple(hit: UserSearchHit) {
    if (!hit.couple_id) return;
    const key = `couple:${hit.couple_id}`;
    setBusy(key);
    const res = await addCoupleAsGroupMembers({
      groupId,
      coupleId: hit.couple_id,
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(`Add couple failed: ${res.error}`);
      return;
    }
    toast.success(`Added ${res.added} partner${res.added === 1 ? "" : "s"}`);
    router.refresh();
  }

  async function handleRemove(member: GroupMemberRow) {
    setBusy(member.user_id);
    const res = await removeGroupMember({ groupId, userId: member.user_id });
    setBusy(null);
    if (!res.ok) {
      toast.error(`Remove failed: ${res.error}`);
      return;
    }
    toast.success(`Removed ${member.full_name || member.email || "member"}`);
    router.refresh();
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="border-b border-border p-4">
        <h2 className="font-semibold">Members</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Members are users (not couples). &quot;Add couple&quot; inserts both partners.
        </p>
      </header>

      <div className="space-y-4 p-4">
        {/* Search */}
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
            <ul className="bg-muted/30 mt-2 divide-y divide-border rounded-lg border">
              {hits.map((hit) => {
                const inGroup = memberIdSet.has(hit.user_id);
                const userBusy = busy === hit.user_id;
                const coupleBusy = busy === `couple:${hit.couple_id}`;
                return (
                  <li
                    key={hit.user_id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">
                        {hit.full_name || hit.email || `${hit.user_id.slice(0, 8)}…`}
                      </div>
                      {hit.full_name && hit.email ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {hit.email}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant={inGroup ? "ghost" : "outline"}
                        size="sm"
                        disabled={inGroup || userBusy}
                        onClick={() => void handleAddUser(hit)}
                      >
                        {userBusy ? (
                          <Loader2 className="me-1 size-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="me-1 size-3.5" />
                        )}
                        {inGroup ? "Member" : "Add user"}
                      </Button>
                      {hit.couple_id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={coupleBusy}
                          onClick={() => void handleAddCouple(hit)}
                        >
                          {coupleBusy ? (
                            <Loader2 className="me-1 size-3.5 animate-spin" />
                          ) : (
                            <Users className="me-1 size-3.5" />
                          )}
                          Add couple
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : query.trim().length >= 2 && !searching ? (
            <p className="text-muted-foreground mt-2 text-xs">No matches.</p>
          ) : null}
        </div>

        {/* Current members */}
        <div>
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
            Current members ({members.length})
          </div>
          {members.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
              No members yet. Use the search above to add someone.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border">
              {members.map((m) => {
                const userBusy = busy === m.user_id;
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.full_name || m.email || `${m.user_id.slice(0, 8)}…`}
                      </div>
                      {m.full_name && m.email ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {m.email}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove member"
                      disabled={userBusy}
                      onClick={() => void handleRemove(m)}
                    >
                      {userBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
