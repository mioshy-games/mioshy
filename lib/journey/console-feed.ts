import "server-only";

import {
  getPendingExpertMessages,
  type PendingMessageRow,
} from "./pending-messages";
import {
  listExpertClients,
  type ExpertClientSummary,
} from "@/lib/experts/queries";
import {
  getWorkflowStatesForCouples,
  type WorkflowState,
} from "./couple-workflow-state";
import {
  fetchUserIdentities,
  type UserIdentity,
} from "./console-identity";

/**
 * Left-pane "conversation feed" for the coach chat console.
 *
 * Wraps the SAME aggregation that powers /dashboard/journey/replies
 * (`getPendingExpertMessages` — general channel + per-item threads, i.e.
 * the messages clients actually send) so the console can never miss a
 * conversation that the replies inbox shows. On top of that it folds in the
 * full client roster (`listExpertClients`) so quiet couples still appear as
 * ongoing conversations, and the workflow engine (`getWorkflowStatesForCouples`)
 * for the per-couple "next step" chip.
 *
 * One row per CONVERSATION:
 *   • couple → keyed by coupleId, carries the workflow chip.
 *   • solo   → keyed by userId (no couple), NO workflow chip (renders "—").
 *     Solo users write in the general channel today and surface in /replies,
 *     so the console includes them too — otherwise it wouldn't be "one place".
 */

export interface ConsoleFeedItem {
  kind: "couple" | "solo";
  /** Stable key for React + selection highlight. */
  key: string;
  /** Set for couples; null for solo. */
  coupleId: string | null;
  /** Set for solo; null for couples. */
  userId: string | null;
  /** Display name (couple label or solo user name). */
  label: string;
  /** Secondary line — pair code (couple) or email (solo). */
  subtitle: string | null;
  /** Preview of the last client message, when any. */
  lastBody: string | null;
  /** ISO timestamp of the last client message (falls back to lastActivity). */
  lastMessageAt: string | null;
  lastContext: "general" | "per_item" | null;
  lastScheduledItemId: string | null;
  /** How many client threads are waiting for a reply (the /replies heuristic:
   *  latest writer === user). Drives the badge. NOT a persistent unread count. */
  needsReplyCount: number;
  /** Couples only — the "next step" chip. Null for solo. */
  workflow: WorkflowState | null;
}

const URGENCY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

function coupleLabel(
  summary: ExpertClientSummary | null,
  identities: Map<string, UserIdentity>,
  fallback: string | null,
  coupleId: string,
): string {
  if (summary?.displayName?.trim()) return summary.displayName.trim();
  // Real names always: full_name → email local-part, joined per partner.
  const fromMembers = (summary?.members ?? [])
    .map((m) => {
      const id = identities.get(m.userId);
      const full = id?.fullName?.trim();
      if (full) return full;
      const email = id?.email ?? m.email ?? "";
      return email.includes("@") ? email.split("@")[0].trim() : "";
    })
    .filter(Boolean)
    .join(" & ");
  if (fromMembers) return fromMembers;
  if (fallback?.trim()) return fallback.trim();
  return `Couple ${coupleId.slice(0, 8)}`;
}

export async function buildConsoleFeed(opts: {
  expertId: string;
  isAdmin: boolean;
}): Promise<ConsoleFeedItem[]> {
  const [pending, clients] = await Promise.all([
    getPendingExpertMessages({ limit: 50 }),
    listExpertClients({ expertId: opts.expertId, isAdmin: opts.isAdmin }),
  ]);

  const clientByCouple = new Map<string, ExpertClientSummary>();
  for (const c of clients) clientByCouple.set(c.coupleId, c);

  // Split pending rows: couples grouped by coupleId (a couple can have up to
  // two member rows — merge them), solo users kept individually.
  const coupleRows = new Map<string, PendingMessageRow[]>();
  const soloRows: PendingMessageRow[] = [];
  for (const r of pending.rows) {
    if (r.coupleId) {
      const arr = coupleRows.get(r.coupleId) ?? [];
      arr.push(r);
      coupleRows.set(r.coupleId, arr);
    } else {
      soloRows.push(r);
    }
  }

  // Workflow states for every couple we'll show (pending + quiet roster).
  const coupleIds = Array.from(
    new Set([...coupleRows.keys(), ...clients.map((c) => c.coupleId)]),
  );
  // Real names for every couple member (full_name → email), one batched read.
  const memberIds = clients.flatMap((c) => c.members.map((m) => m.userId));
  const [workflowMap, identities] = await Promise.all([
    getWorkflowStatesForCouples(coupleIds),
    fetchUserIdentities(memberIds),
  ]);

  const items: ConsoleFeedItem[] = [];

  for (const coupleId of coupleIds) {
    const summary = clientByCouple.get(coupleId) ?? null;
    const rows = coupleRows.get(coupleId) ?? [];

    let latest: PendingMessageRow | null = null;
    let needs = 0;
    for (const r of rows) {
      needs += r.pendingPerItemThreads + (r.pendingGeneralChannel ? 1 : 0);
      if (!latest || r.lastUserMessageAt > latest.lastUserMessageAt) latest = r;
    }

    items.push({
      kind: "couple",
      key: `couple:${coupleId}`,
      coupleId,
      userId: null,
      label: coupleLabel(summary, identities, latest?.displayName ?? null, coupleId),
      subtitle: summary?.pairCode ?? null,
      lastBody: latest?.lastBody ?? null,
      lastMessageAt: latest?.lastUserMessageAt ?? summary?.lastActivityAt ?? null,
      lastContext: latest?.lastContext ?? null,
      lastScheduledItemId: latest?.lastScheduledItemId ?? null,
      needsReplyCount: needs,
      workflow: workflowMap.get(coupleId) ?? null,
    });
  }

  for (const r of soloRows) {
    items.push({
      kind: "solo",
      key: `user:${r.userId}`,
      coupleId: null,
      userId: r.userId,
      label: r.displayName,
      subtitle: r.email,
      lastBody: r.lastBody,
      lastMessageAt: r.lastUserMessageAt,
      lastContext: r.lastContext,
      lastScheduledItemId: r.lastScheduledItemId,
      needsReplyCount:
        r.pendingPerItemThreads + (r.pendingGeneralChannel ? 1 : 0),
      workflow: null,
    });
  }

  // Sort: conversations awaiting a reply float to the top (WhatsApp-style,
  // matches the /replies "needs reply" semantics). Then by workflow urgency
  // (couples only — solo has none, sorts as neutral), then most-recent first.
  items.sort((a, b) => {
    const aWaiting = a.needsReplyCount > 0 ? 0 : 1;
    const bWaiting = b.needsReplyCount > 0 ? 0 : 1;
    if (aWaiting !== bWaiting) return aWaiting - bWaiting;

    const aUrg = a.workflow ? URGENCY_RANK[a.workflow.urgency] ?? 5 : 4;
    const bUrg = b.workflow ? URGENCY_RANK[b.workflow.urgency] ?? 5 : 4;
    if (aUrg !== bUrg) return aUrg - bUrg;

    return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
  });

  return items;
}
