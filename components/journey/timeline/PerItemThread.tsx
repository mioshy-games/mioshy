"use client";

// ============================================================
// PerItemThread - slice 6 v3 threading on a single item.
//
// Layout follows Update B ("every item is a prompt expecting a
// response"):
//
//     ┌─ Composer (PRIMARY, open by default) ────────┐
//     │  textarea, privacy toggle, post button       │
//     └──────────────────────────────────────────────┘
//     ┌─ Thread history (oldest → newest) ───────────┐
//     │  user / expert message cards with reactions  │
//     └──────────────────────────────────────────────┘
//
// The composer is FOCUSED on mount so the user lands directly in
// "respond now" state. Past messages are scannable below.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, ShieldCheck, Sparkle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  postPerItemMessage,
  toggleReaction,
} from "@/app/actions/journey-messages";
import type { JourneyMessage } from "@/lib/journey-content/messages";

const REACTION_PALETTE: Array<{ emoji: string; glyph: string; label: string }> = [
  { emoji: ":heart:", glyph: "❤️", label: "Heart" },
  { emoji: ":thumbsup:", glyph: "👍", label: "Thumbs up" },
  { emoji: ":thinking:", glyph: "🤔", label: "Thinking" },
  { emoji: ":sparkles:", glyph: "✨", label: "Sparkles" },
  { emoji: ":pray:", glyph: "🙏", label: "Pray" },
];

const EMOJI_GLYPH = new Map(REACTION_PALETTE.map((r) => [r.emoji, r.glyph]));

interface Props {
  scheduledItemId: string;
  initialMessages: JourneyMessage[];
  viewerUserId: string;
  isHe: boolean;
  /** Surfaced in the prompt header so the composer feels anchored
   *  in context. The page-level header already shows the full item
   *  body; this is just a one-liner reminder. */
  promptLabel?: string;
}

export function PerItemThread({
  scheduledItemId,
  initialMessages,
  viewerUserId,
  isHe,
  promptLabel,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<JourneyMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Sync local state when the parent revalidates with fresh server data.
  const lastMsgIdsRef = React.useRef<string>(messages.map((m) => m.id).join("|"));
  React.useEffect(() => {
    const nextKey = initialMessages.map((m) => m.id).join("|");
    if (nextKey !== lastMsgIdsRef.current) {
      lastMsgIdsRef.current = nextKey;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Focus composer on mount per Update B (primary affordance).
  React.useEffect(() => {
    const t = window.setTimeout(() => composerRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await postPerItemMessage({
      scheduledItemId,
      body: trimmed,
      isPrivate,
    });
    setPosting(false);
    if (!res.ok) {
      toast.error(
        isHe ? `שמירה נכשלה: ${res.error}` : `Save failed: ${res.error}`,
      );
      return;
    }
    setDraft("");
    toast.success(isHe ? "התגובה נשמרה" : "Response posted");
    router.refresh();
  }

  async function handleReact(messageId: string, emoji: string) {
    // Optimistic - patch the local message's reactions.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const cur = { ...(m.reactions ?? {}) };
        const list = Array.isArray(cur[emoji]) ? [...cur[emoji]] : [];
        const idx = list.indexOf(viewerUserId);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(viewerUserId);
        if (list.length === 0) delete cur[emoji];
        else cur[emoji] = list;
        return { ...m, reactions: cur };
      }),
    );
    const res = await toggleReaction({ messageId, emoji });
    if (!res.ok) {
      toast.error(
        isHe ? `שמירה נכשלה: ${res.error}` : `Reaction failed: ${res.error}`,
      );
      router.refresh(); // pull authoritative state
      return;
    }
  }

  return (
    <div className="space-y-6" dir={isHe ? "rtl" : "ltr"}>
      {/* Composer - primary affordance, open by default */}
      <form onSubmit={handlePost} className="space-y-3">
        {promptLabel ? (
          <div className="flex items-center gap-2 text-xs text-white/55">
            <Sparkle className="size-3.5 text-fuchsia-300/80" aria-hidden />
            <span>{promptLabel}</span>
          </div>
        ) : null}
        <Textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          dir={isHe ? "rtl" : "ltr"}
          placeholder={
            isHe
              ? "מה עולה לכם מהפריט הזה? תגובה למומחים שלנו…"
              : "What surfaces for you here? Send a note to our experts…"
          }
          className="min-h-[110px] resize-y bg-white/[0.04] border-white/15 text-white placeholder:text-white/35"
          disabled={posting}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/65">
            <Switch
              id={`private-${scheduledItemId}`}
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={posting}
            />
            <Label
              htmlFor={`private-${scheduledItemId}`}
              className="cursor-pointer text-xs text-white/65"
            >
              {isPrivate ? (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {isHe ? "פרטי - רק אתם והמומחים" : "Private - only you + experts"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden />
                  {isHe ? "משותף עם בן/בת הזוג" : "Shared with your partner"}
                </span>
              )}
            </Label>
          </div>
          <Button
            type="submit"
            disabled={posting || draft.trim().length === 0}
            className="min-w-[120px]"
          >
            {posting ? (
              <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="me-2 size-4" aria-hidden />
            )}
            {isHe ? "שלחו" : "Send"}
          </Button>
        </div>
      </form>

      {/* Thread history */}
      <ol className="space-y-3" aria-label={isHe ? "היסטוריית שיחה" : "Thread history"}>
        {messages.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/55">
            {isHe
              ? "עדיין אין הודעות בשיחה הזו. התגובה שלכם תפתח אותה."
              : "No messages in this thread yet. Your response opens it."}
          </li>
        ) : (
          messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              viewerUserId={viewerUserId}
              isHe={isHe}
              onReact={handleReact}
            />
          ))
        )}
      </ol>
    </div>
  );
}

function MessageRow({
  message,
  viewerUserId,
  isHe,
  onReact,
}: {
  message: JourneyMessage;
  viewerUserId: string;
  isHe: boolean;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const isExpert = message.author_kind === "expert";
  const isMine = message.author_user_id === viewerUserId;
  const tone = isExpert
    ? "border-emerald-300/30 bg-emerald-500/[0.08]"
    : isMine
      ? "border-fuchsia-300/30 bg-fuchsia-500/[0.06]"
      : "border-white/10 bg-white/[0.04]";
  const authorLabel = isExpert
    ? isHe
      ? "המומחה שלנו"
      : "Mioshy expert"
    : isMine
      ? isHe
        ? "אתם"
        : "You"
      : isHe
        ? "בן/בת הזוג"
        : "Your partner";

  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(
    ([, ids]) => Array.isArray(ids) && ids.length > 0,
  );

  return (
    <li className={cn("rounded-xl border p-4 backdrop-blur-sm", tone)}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-white/90">
          {authorLabel}
          {message.is_private ? (
            <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/65">
              <ShieldCheck className="size-3" aria-hidden />
              {isHe ? "פרטי" : "Private"}
            </span>
          ) : null}
        </span>
        <time className="text-white/45" dateTime={message.created_at}>
          {new Date(message.created_at).toLocaleString(isHe ? "he-IL" : "en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
        {message.body}
      </p>
      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {reactionEntries.map(([emoji, ids]) => {
          const mine = ids.includes(viewerUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message.id, emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                mine
                  ? "border-fuchsia-300/40 bg-fuchsia-500/15 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              )}
              aria-pressed={mine}
              aria-label={`${emoji} (${ids.length})`}
            >
              <span>{EMOJI_GLYPH.get(emoji) ?? emoji}</span>
              <span className="tabular-nums">{ids.length}</span>
            </button>
          );
        })}
        <ReactionPicker
          messageId={message.id}
          existing={reactions}
          viewerUserId={viewerUserId}
          onPick={(emoji) => onReact(message.id, emoji)}
          isHe={isHe}
        />
      </footer>
    </li>
  );
}

function ReactionPicker({
  messageId,
  existing,
  viewerUserId,
  onPick,
  isHe,
}: {
  messageId: string;
  existing: Record<string, string[]>;
  viewerUserId: string;
  onPick: (emoji: string) => void;
  isHe: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/55 hover:bg-white/10"
        aria-label={isHe ? "הוסיפו תגובה רגשית" : "Add reaction"}
        aria-expanded={open}
        aria-controls={`reactions-${messageId}`}
      >
        +
      </button>
      {open ? (
        <div
          id={`reactions-${messageId}`}
          role="menu"
          className="absolute z-30 mt-1 flex gap-1 rounded-full border border-white/15 bg-slate-950/90 p-1 shadow-xl backdrop-blur"
        >
          {REACTION_PALETTE.map((r) => {
            const mine = (existing[r.emoji] ?? []).includes(viewerUserId);
            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => {
                  onPick(r.emoji);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-base hover:bg-white/10",
                  mine && "bg-white/10",
                )}
                aria-label={r.label}
                role="menuitem"
              >
                {r.glyph}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
