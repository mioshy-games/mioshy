"use client";

/**
 * ExpertConversation — full-page chat surface for /my/expert.
 *
 * Visually matches Studio v12 `.conv` + `.composer`:
 *   • Them bubbles: card-tinted background, left-aligned (RTL flips to
 *     right of user). Border-bottom-right-radius cropped for "tail" feel.
 *   • Me bubbles: bright gradient pill (subtle weight 500 — not heavy).
 *
 * Reuses the existing `postGeneralChannelMessage` server action so the
 * dual-write contract (journey_messages + journey_user_messages) stays
 * intact. We don't ship reactions on the shell version — they were a
 * sidebar widget concern; the full-page surface is conversational.
 *
 * Optimistic UI: the new message is added to local state immediately,
 * then we router.refresh() to pick up the canonical row. On error we
 * roll back and surface a toast.
 *
 * Client component because of state + form handling.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { postGeneralChannelMessage } from "@/app/actions/journey-messages";
import type { JourneyMessage } from "@/lib/journey-content/messages";

interface Props {
  initialMessages: JourneyMessage[];
  viewerUserId: string;
  isHe: boolean;
  /** "כתבו הודעה למומחה…" placeholder. */
  composerPlaceholder: string;
  /** Empty-state line shown when there are zero messages. */
  emptyLabel: string;
  /** Localized "Today / היום" prefix for the date separator. */
  todayLabel: string;
  /** Localized send button label (used as aria-label only — the button
   *  itself is icon-only on the round style). */
  sendLabel: string;
}

export function ExpertConversation({
  initialMessages,
  viewerUserId,
  isHe,
  composerPlaceholder,
  emptyLabel,
  todayLabel,
  sendLabel,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<JourneyMessage[]>(
    initialMessages,
  );
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-grow textarea height as the user types (mobile-friendly multi-line).
  // Caps at ~6 lines so the composer never eats the whole screen.
  React.useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 140);
    el.style.height = `${next}px`;
  }, [draft]);

  // Auto-sync when server props refresh (router.refresh + new fetch).
  const lastIdsRef = React.useRef(messages.map((m) => m.id).join("|"));
  React.useEffect(() => {
    const next = initialMessages.map((m) => m.id).join("|");
    if (next !== lastIdsRef.current) {
      lastIdsRef.current = next;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Scroll to bottom on new messages.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    const res = await postGeneralChannelMessage({ body: trimmed });
    setPosting(false);
    if (!res.ok) {
      toast.error(
        isHe ? `שמירה נכשלה: ${res.error}` : `Send failed: ${res.error}`,
      );
      return;
    }
    setDraft("");
    router.refresh();
    composerRef.current?.focus();
  }

  // Group messages by "today / yesterday" — currently single "today"
  // separator at the top; richer grouping ships in a later iteration.
  const todayStamp = new Intl.DateTimeFormat(isHe ? "he-IL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-2">
      {/* Date separator. Single one at the top is enough until thread
          grows long enough to need per-day grouping. */}
      {messages.length > 0 ? (
        <div
          className="py-1.5 text-center text-[14px]"
          style={{ color: "var(--shell-text-3)" }}
        >
          {todayLabel} · {todayStamp}
        </div>
      ) : null}

      {/* Conversation list. aria-live="polite" announces new messages
          to screen readers as they arrive, without interrupting current
          announcements. role="log" tells assistive tech this is a
          chronological feed. */}
      <ol
        className="m-0 flex list-none flex-col gap-2 p-0"
        role="log"
        aria-live="polite"
        aria-label={isHe ? "היסטוריית שיחה" : "Conversation history"}
      >
        {messages.length === 0 ? (
          <li
            className="rounded-2xl border px-4 py-6 text-center text-[18px]"
            style={{
              background: "var(--shell-card)",
              borderColor: "var(--shell-line-soft)",
              color: "var(--shell-text-2)",
            }}
          >
            {emptyLabel}
          </li>
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              message={m}
              isMe={m.author_kind === "user" && m.author_user_id === viewerUserId}
              isHe={isHe}
            />
          ))
        )}
        <div ref={endRef} />
      </ol>

      {/* Composer — rounded multi-line textarea. Enter sends; Shift+Enter
          (or Cmd+Enter / Ctrl+Enter on Mac/Win) inserts a newline. Auto-
          grows up to ~6 lines, then scrolls. Same submit affordance as
          the existing GeneralChannelThread inside /my/journey, so users
          get one consistent behavior across surfaces. */}
      <form
        onSubmit={handlePost}
        className="mt-2 flex items-end gap-2 rounded-[22px] border px-3 py-2"
        style={{
          background: "var(--shell-card)",
          borderColor: "var(--shell-line-mid)",
        }}
      >
        <textarea
          ref={composerRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Plain Enter → submit. Shift+Enter / Cmd+Enter / Ctrl+Enter
            // → newline. Matches Slack / Linear / Notion conventions.
            if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              void handlePost(e as unknown as React.FormEvent);
            }
          }}
          dir={isHe ? "rtl" : "ltr"}
          placeholder={composerPlaceholder}
          aria-label={composerPlaceholder}
          className="min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-[16px] leading-[1.4] outline-none placeholder:opacity-60"
          style={{ color: "var(--shell-text-1)" }}
          disabled={posting}
        />
        <button
          type="submit"
          aria-label={sendLabel}
          disabled={posting || draft.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-50"
          style={{ background: "var(--shell-cta-grad)" }}
        >
          {posting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

interface BubbleProps {
  message: JourneyMessage;
  isMe: boolean;
  isHe: boolean;
}

function Bubble({ message, isMe, isHe }: BubbleProps) {
  const stamp = new Intl.DateTimeFormat(isHe ? "he-IL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.created_at));

  return (
    <li
      className={[
        "flex",
        isMe ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[20px] leading-[1.4]",
          isMe ? "rounded-es-[4px] font-medium" : "rounded-ee-[4px] border",
        ].join(" ")}
        style={
          isMe
            ? {
                background: "var(--shell-cta-grad)",
                color: "#FFFFFF",
              }
            : {
                background: "var(--shell-card)",
                borderColor: "var(--shell-line-soft)",
                color: "var(--shell-text-1)",
              }
        }
      >
        {message.body}
        <span
          className="ms-2 align-baseline text-[12px] opacity-60"
          aria-hidden
        >
          {stamp}
        </span>
      </div>
    </li>
  );
}
