"use client";

// ============================================================
// GeneralChannelThread - slice 6 v3 two-way thread between the user
// and the expert pool, on /my/journey. Replaces the fire-and-forget
// JourneyExpertMessage widget.
//
// Layout: thread history (oldest → newest) on top, composer at the
// bottom - opposite to PerItemThread because this is a persistent
// inbox, not a one-shot prompt response.
//
// Privacy: per Itzik #7 these messages are partner-private by
// default. The composer doesn't expose a privacy toggle (the channel
// IS the privacy boundary).
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  postGeneralChannelMessage,
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
  initialMessages: JourneyMessage[];
  viewerUserId: string;
  isHe: boolean;
}

export function GeneralChannelThread({
  initialMessages,
  viewerUserId,
  isHe,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<JourneyMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Sync from server when revalidate ships fresh data.
  const lastIdsRef = React.useRef<string>(messages.map((m) => m.id).join("|"));
  React.useEffect(() => {
    const next = initialMessages.map((m) => m.id).join("|");
    if (next !== lastIdsRef.current) {
      lastIdsRef.current = next;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await postGeneralChannelMessage({ body: trimmed });
    setPosting(false);
    if (!res.ok) {
      toast.error(
        isHe ? `שמירה נכשלה: ${res.error}` : `Save failed: ${res.error}`,
      );
      return;
    }
    setDraft("");
    toast.success(isHe ? "ההודעה נשלחה" : "Message sent");
    router.refresh();
  }

  async function handleReact(messageId: string, emoji: string) {
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
      router.refresh();
    }
  }

  return (
    <section
      className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md"
      dir={isHe ? "rtl" : "ltr"}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white/85">
            {isHe
              ? "הערוץ הפרטי שלכם עם המומחים"
              : "Your private channel with the expert pool"}
          </h2>
          <p className="mt-1 text-xs text-white/55">
            {isHe
              ? "כל מומחה במשמרת רואה ועונה. בן/בת הזוג לא רואים את הערוץ הזה."
              : "Any on-duty expert sees and replies. Your partner can't see this channel."}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
          <ShieldCheck className="size-3" aria-hidden />
          {isHe ? "פרטי" : "Private"}
        </span>
      </header>

      {/* Thread */}
      <ol
        className="mb-4 space-y-3 max-h-[420px] overflow-y-auto pe-1"
        aria-label={isHe ? "היסטוריית שיחה" : "Channel history"}
      >
        {messages.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/55">
            {isHe
              ? "אין עדיין הודעות. כתבו את ההודעה הראשונה שלכם."
              : "No messages yet. Send your first one below."}
          </li>
        ) : (
          messages.map((m) => (
            <ChannelRow
              key={m.id}
              message={m}
              viewerUserId={viewerUserId}
              isHe={isHe}
              onReact={handleReact}
            />
          ))
        )}
      </ol>

      {/* Composer (bottom - channel is persistent inbox, not one-shot) */}
      <form onSubmit={handlePost} className="space-y-2">
        <Textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          dir={isHe ? "rtl" : "ltr"}
          placeholder={
            isHe
              ? "מה ברצונכם לשתף עם המומחים?"
              : "What would you like to share with the experts?"
          }
          className="min-h-[80px] resize-y bg-white/[0.04] border-white/15 text-white placeholder:text-white/35"
          disabled={posting}
        />
        <div className="flex items-center justify-end">
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
            {isHe ? "שליחה" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ChannelRow({
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
  const tone = isExpert
    ? "border-emerald-300/30 bg-emerald-500/[0.08]"
    : "border-fuchsia-300/30 bg-fuchsia-500/[0.06]";
  const authorLabel = isExpert
    ? isHe
      ? "המומחה שלנו"
      : "Mioshy expert"
    : isHe
      ? "אתם"
      : "You";

  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(
    ([, ids]) => Array.isArray(ids) && ids.length > 0,
  );

  return (
    <li className={cn("rounded-xl border p-3 backdrop-blur-sm", tone)}>
      <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold text-white/90">{authorLabel}</span>
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
      <footer className="mt-2 flex flex-wrap items-center gap-1">
        {reactionEntries.map(([emoji, ids]) => {
          const mine = ids.includes(viewerUserId);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message.id, emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition",
                mine
                  ? "border-fuchsia-300/40 bg-fuchsia-500/15 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              )}
              aria-pressed={mine}
            >
              <span>{EMOJI_GLYPH.get(emoji) ?? emoji}</span>
              <span className="tabular-nums">{ids.length}</span>
            </button>
          );
        })}
        <ChannelReactionPicker
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

function ChannelReactionPicker({
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
        className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/55 hover:bg-white/10"
        aria-label={isHe ? "הוסיפו תגובה רגשית" : "Add reaction"}
        aria-expanded={open}
        aria-controls={`channel-reactions-${messageId}`}
      >
        +
      </button>
      {open ? (
        <div
          id={`channel-reactions-${messageId}`}
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
