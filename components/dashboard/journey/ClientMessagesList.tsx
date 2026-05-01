/**
 * ClientMessagesList — read-only list of messages a couple's
 * partners sent through the JourneyExpertMessage UI. Phase 4 wiring.
 *
 * Lives next to ClientResponsesInbox in /dashboard/my-clients/[coupleId].
 *
 * Display rules:
 *   - Newest first
 *   - Per row: who sent (partner label), text, status pill, time
 *   - No reply UI here (one-way channel by design — see migration 051)
 *
 * The clinician acts via the existing intervention surfaces (assigning
 * content, sending reflections, etc.). This list just makes sure
 * nothing the user wrote falls through the cracks.
 */

import { Mail } from "lucide-react";
import type { UserMessageRow } from "@/lib/journey-content/user-messages";

export function ClientMessagesList({
  rows,
  partners,
}: {
  rows: UserMessageRow[];
  /** user_id → display label */
  partners: Map<string, string>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/30 p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Messages from clients
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Free-text notes the partners left through the dashboard. Newest first.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {rows.length} message{rows.length === 1 ? "" : "s"}
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No messages yet. They appear here when a client uses the
          &ldquo;Message your clinician&rdquo; channel from /my/journey.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((m) => {
            const partnerLabel =
              partners.get(m.userId) ?? m.userId.slice(0, 8);
            return (
              <li
                key={m.id}
                className="rounded-xl border border-border bg-card/60 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
                    <Mail className="size-3 text-muted-foreground" aria-hidden="true" />
                    {partnerLabel}
                  </span>
                  <time
                    dateTime={m.createdAt}
                    className="text-[11px] text-muted-foreground"
                    title={new Date(m.createdAt).toLocaleString()}
                  >
                    {formatRelative(m.createdAt)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {m.messageText}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return "over a month ago";
}
