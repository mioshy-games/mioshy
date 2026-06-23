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
  personName,
  type UserIdentity,
} from "./console-identity";
import { loadSoloRoster } from "./console-roster";

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

/**
 * Feed bands (top → bottom), so a conversation is never lost after a reply:
 *   • "awaiting" — needs a reply now (couples + solo). Floats to the very top.
 *   • "active"   — subscribers (every couple + solo journey owners) already
 *     answered. Persisted, sorted by recent activity.
 *   • "no_sub"   — solo users with NO journey subscription. Always kept (their
 *     message history persists them) in a collapsible band; they jump to
 *     "awaiting" the moment a new message arrives.
 */
export type ConsoleFeedLayer = "awaiting" | "active" | "no_sub";

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
  /** Active journey subscription. Always true for couples. */
  isSubscriber: boolean;
  /** Which band this row renders in. */
  layer: ConsoleFeedLayer;
}

function layerFor(item: {
  kind: "couple" | "solo";
  needsReplyCount: number;
  isSubscriber: boolean;
}): ConsoleFeedLayer {
  if (item.needsReplyCount > 0) return "awaiting";
  if (item.kind === "couple" || item.isSubscriber) return "active";
  return "no_sub";
}

const LAYER_RANK: Record<ConsoleFeedLayer, number> = {
  awaiting: 0,
  active: 1,
  no_sub: 2,
};

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
  const [pending, clients, soloRoster] = await Promise.all([
    getPendingExpertMessages({ limit: 50 }),
    listExpertClients({ expertId: opts.expertId, isAdmin: opts.isAdmin }),
    loadSoloRoster(),
  ]);

  const clientByCouple = new Map<string, ExpertClientSummary>();
  for (const c of clients) clientByCouple.set(c.coupleId, c);

  // Couple pending rows grouped by coupleId (a couple can have up to two member
  // rows — merge them). Solo pending rows are merged with the roster below.
  const coupleRows = new Map<string, PendingMessageRow[]>();
  for (const r of pending.rows) {
    if (r.coupleId) {
      const arr = coupleRows.get(r.coupleId) ?? [];
      arr.push(r);
      coupleRows.set(r.coupleId, arr);
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

    const needsReplyCount = needs;
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
      needsReplyCount,
      workflow: workflowMap.get(coupleId) ?? null,
      isSubscriber: true, // a couple in the journey is a journey subscriber
      layer: layerFor({ kind: "couple", needsReplyCount, isSubscriber: true }),
    });
  }

  // SOLO — driven by the persistent roster (all solo journey subscribers + all
  // solo users who ever wrote), merged with pending state for the reply badge
  // and preview. This is what keeps a solo conversation after the coach replies.
  const pendingSoloByUser = new Map<string, PendingMessageRow>();
  for (const r of pending.rows) {
    if (!r.coupleId) pendingSoloByUser.set(r.userId, r);
  }
  // Union: every roster user, plus any pending solo user missing from it.
  const soloUserIds = new Set<string>(soloRoster.map((e) => e.userId));
  const rosterByUser = new Map(soloRoster.map((e) => [e.userId, e]));
  for (const uid of pendingSoloByUser.keys()) soloUserIds.add(uid);

  for (const userId of soloUserIds) {
    const entry = rosterByUser.get(userId) ?? null;
    const p = pendingSoloByUser.get(userId) ?? null;
    const needsReplyCount = p
      ? p.pendingPerItemThreads + (p.pendingGeneralChannel ? 1 : 0)
      : 0;
    const isSubscriber = entry?.isSubscriber ?? false;
    const label = personName({
      fullName: entry?.fullName,
      email: entry?.email ?? p?.email,
      userId,
      emptyFallback: p?.displayName,
    });
    items.push({
      kind: "solo",
      key: `user:${userId}`,
      coupleId: null,
      userId,
      label,
      subtitle: entry?.email ?? p?.email ?? null,
      lastBody: p?.lastBody ?? null,
      lastMessageAt: p?.lastUserMessageAt ?? entry?.lastActivityAt ?? null,
      lastContext: p?.lastContext ?? null,
      lastScheduledItemId: p?.lastScheduledItemId ?? null,
      needsReplyCount,
      workflow: null,
      isSubscriber,
      layer: layerFor({ kind: "solo", needsReplyCount, isSubscriber }),
    });
  }

  // Three-layer sort: awaiting → active → no_sub. Within "awaiting" keep the
  // urgency-then-recency order; the other bands sort by most-recent activity.
  items.sort((a, b) => {
    if (LAYER_RANK[a.layer] !== LAYER_RANK[b.layer])
      return LAYER_RANK[a.layer] - LAYER_RANK[b.layer];

    if (a.layer === "awaiting") {
      const aUrg = a.workflow ? URGENCY_RANK[a.workflow.urgency] ?? 5 : 4;
      const bUrg = b.workflow ? URGENCY_RANK[b.workflow.urgency] ?? 5 : 4;
      if (aUrg !== bUrg) return aUrg - bUrg;
    }

    return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
  });

  return items;
}
