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
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

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
  // Default to PRIVATE (2026-06-02 — Itzik): users were confused
  // about who reads per-item messages. The thread is now framed as a
  // 1:1 line to the expert, so a private default matches the framing.
  // Users who want their partner to read along can still flip the toggle.
  const [isPrivate, setIsPrivate] = React.useState(true);
  const [posting, setPosting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Raw-string consumers — toast messages, textarea placeholder, aria
  // labels, sender labels (used inside MessageRow logic below).
  const saveFailedTpl = useCmsText("journeyTimeline.thread.saveFailed").text;
  const reactionFailedTpl = useCmsText("journeyTimeline.thread.reactionFailed").text;
  const postedMsg = useCmsText("journeyTimeline.thread.posted").text;
  const composerPlaceholder = useCmsText("journeyTimeline.thread.composerPlaceholder").text;
  const historyAria = useCmsText("journeyTimeline.thread.historyAria").text;

  // Sync local state when the parent revalidates with fresh server data.
  const lastMsgIdsRef = React.useRef<string>(messages.map((m) => m.id).join("|"));
  React.useEffect(() => {
    const nextKey = initialMessages.map((m) => m.id).join("|");
    if (nextKey !== lastMsgIdsRef.current) {
      lastMsgIdsRef.current = nextKey;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // 2026-06-02 (Itzik): auto-focus removed.
  // The composer sits at the BOTTOM of the page (under LessonView +
  // Complete card + thread history). Programmatically focusing it on
  // mount makes iOS/Android scroll the textarea into view, which
  // jumped the user past the lesson content. We want the page to land
  // at the top so the user reads the chapter first; if they want to
  // write to the expert, they tap the textarea themselves.

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
      toast.error(saveFailedTpl.replace("{error}", res.error));
      return;
    }
    setDraft("");
    toast.success(postedMsg);
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
      toast.error(reactionFailedTpl.replace("{error}", res.error));
      router.refresh(); // pull authoritative state
      return;
    }
  }

  return (
    <div className="space-y-6" dir={isHe ? "rtl" : "ltr"}>
      {/* Header — frames the whole surface as a 1:1 line to the
          expert about THIS chapter. Replaces the old optional
          promptLabel which was easy to miss. */}
      <header
        className="rounded-2xl border px-4 py-3 sm:px-5"
        style={{
          borderColor: "rgba(252,202,101,0.35)",
          background: "linear-gradient(160deg, rgba(252,202,101,0.10) 0%, rgba(184,143,50,0.04) 100%)",
        }}
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#FAF6F7]">
          <Sparkle className="size-4 text-amber-200" aria-hidden />
          <CmsText cmsKey="journeyTimeline.thread.expertHeader" />
        </div>
        <CmsText
          cmsKey="journeyTimeline.thread.expertSubheader"
          as="p"
          className="mt-1 text-[12px] text-white/65"
        />
        {promptLabel ? (
          <p className="mt-2 text-[12px] italic text-white/55">{promptLabel}</p>
        ) : null}
      </header>

      {/* Composer - primary affordance, open by default */}
      <form onSubmit={handlePost} className="space-y-3">
        <Textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          dir={isHe ? "rtl" : "ltr"}
          placeholder={composerPlaceholder}
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
                  <CmsText cmsKey="journeyTimeline.thread.privateLabel" />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden />
                  <CmsText cmsKey="journeyTimeline.list.shared" />
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
            <CmsText cmsKey="journeyTimeline.thread.send" />
          </Button>
        </div>
      </form>

      {/* Thread history */}
      <ol className="space-y-3" aria-label={historyAria}>
        {messages.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/55">
            <CmsText cmsKey="journeyTimeline.thread.empty" />
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

  // Sender-label strings via CMS. Resolved here so the avatar-initial
  // fallback below can read the same value.
  const senderMioshy = useCmsText("journeyTimeline.thread.senderMioshy").text;
  const senderYou = useCmsText("journeyTimeline.thread.senderYou").text;
  const senderPartner = useCmsText("journeyTimeline.thread.senderPartner").text;

  // Chat-bubble layout (Itzik #68 2026-05-07):
  //   • Expert messages anchor to the inline-start (RTL: right, LTR: left)
  //     with the expert/Mioshy badge so the source is unmistakable.
  //   • User messages anchor to the inline-end and are visually softer.
  // The layout is RTL-aware via flexbox justify-* (which respects `dir`).
  const align = isExpert ? "justify-start" : "justify-end";
  const bubbleTone = isExpert
    ? "border-[#FCCA65]/40 bg-gradient-to-br from-[#FCCA65]/15 via-[#FCCA65]/8 to-transparent text-white"
    : isMine
      ? "border-white/15 bg-white/[0.06] text-white"
      : "border-amber-300/25 bg-amber-400/[0.06] text-white";

  // Sender label & avatar — Layer 2 surfaces the specific coach's
  // persona (display name + avatar) when expert_persona is present.
  // Falls back to the CMS-managed generic 'Mioshy' label for legacy
  // unattributed expert messages.
  const expertPersona = message.expert_persona ?? null;
  const expertDisplayName = expertPersona
    ? (isHe
        ? expertPersona.display_name_he
        : expertPersona.display_name_en) ||
      expertPersona.display_name_he
    : null;
  const senderLabel = isExpert
    ? expertDisplayName ?? senderMioshy
    : isMine
      ? senderYou
      : senderPartner;
  const avatarInitial = isExpert
    ? (expertDisplayName ?? senderMioshy).slice(0, 1)
    : isMine
      ? "·"
      : senderPartner.slice(0, 1);
  const expertAvatarUrl = expertPersona?.avatar_url ?? null;

  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(
    ([, ids]) => Array.isArray(ids) && ids.length > 0,
  );

  return (
    <li className={cn("flex gap-2", align)}>
      {/* Expert avatar — only shown on the start side */}
      {isExpert ? (
        expertAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expertAvatarUrl}
            alt={senderLabel}
            className="mt-1 h-9 w-9 shrink-0 self-start rounded-full border-2 border-[#FCCA65]/40 object-cover"
          />
        ) : (
          // High-contrast avatar (Itzik 2026-06-02). The previous
          // white-text-on-burgundy gradient was unreadable against
          // the dark page background. New scheme: solid warm-cream
          // fill with the burgundy persona-initial — contrast ratio
          // ~10:1 — plus a subtle burgundy ring so it still reads
          // as "Mioshy-branded".
          <span
            aria-hidden
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-[15px] font-bold"
            style={{
              background: "#FAF6F7",
              color: "#8A1F33",
              border: "2px solid rgba(252,202,101,0.55)",
              boxShadow: "0 6px 16px -8px rgba(252,202,101,0.55)",
            }}
          >
            {avatarInitial}
          </span>
        )
      ) : null}

      <div className={cn("max-w-[80%] sm:max-w-[72%]", isExpert ? "" : "text-end")}>
        {/* Sender label — small, above bubble */}
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px]",
            isExpert ? "" : "justify-end",
          )}
        >
          <span
            className={cn(
              "font-bold uppercase tracking-wider",
              isExpert ? "text-[#FAF6F7]/85" : "text-white/55",
            )}
          >
            {senderLabel}
          </span>
          {message.is_private ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/65">
              <ShieldCheck className="size-3" aria-hidden />
              <CmsText cmsKey="journeyTimeline.thread.privateBadge" />
            </span>
          ) : null}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl border px-4 py-2.5 backdrop-blur-sm",
            bubbleTone,
            // Soften the corner that points toward the avatar so the
            // bubble feels attached to the speaker, like iMessage.
            isExpert ? "rounded-ss-md" : "rounded-se-md",
          )}
        >
          <p className="whitespace-pre-wrap text-[17px] leading-[1.55] text-white/95">
            {message.body}
          </p>
        </div>

        {/* Footer: timestamp + reactions */}
        <footer
          className={cn(
            "mt-1.5 flex flex-wrap items-center gap-1.5",
            isExpert ? "" : "justify-end",
          )}
        >
          <time className="text-[10px] text-white/40" dateTime={message.created_at}>
            {new Date(message.created_at).toLocaleString(isHe ? "he-IL" : "en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
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
                    ? "border-[#FCCA65]/40 bg-[#FCCA65]/15 text-white"
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
      </div>
    </li>
  );
}

function ReactionPicker({
  messageId,
  existing,
  viewerUserId,
  onPick,
}: {
  messageId: string;
  existing: Record<string, string[]>;
  viewerUserId: string;
  onPick: (emoji: string) => void;
  isHe: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const addReactionLabel = useCmsText("journeyTimeline.thread.addReaction").text;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/55 hover:bg-white/10"
        aria-label={addReactionLabel}
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
