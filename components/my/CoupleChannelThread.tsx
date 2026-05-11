"use client";

/**
 * CoupleChannelThread
 * ─────────────────────────────────────────────────────────
 * Layer-5 shared couple-channel UI. Both partners post + read;
 * coach replies are signed with their persona (Layer 2 pattern).
 *
 * Visually distinct from per-item / per-user threads:
 *   - 3 "voices" instead of 2: me / partner / coach
 *   - Coach messages anchored start, partner messages bubble end,
 *     "my" messages bubble start (so each partner sees their own
 *     messages on the same side they post from)
 *   - No is_private toggle — couple channel is shared by definition
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { postPartnerCoupleMessage } from "@/app/actions/journey-couple-channel";
import type { CoupleChannelMessage } from "@/lib/journey-content/couple-channel";

interface Props {
  isHe:           boolean;
  coupleId:       string;
  viewerUserId:   string;
  initialMessages: CoupleChannelMessage[];
  /** Resolved label for the OTHER partner (locale-resolved name or fallback). */
  partnerLabel:   string;
}

export function CoupleChannelThread({
  isHe,
  coupleId,
  viewerUserId,
  initialMessages,
  partnerLabel,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<CoupleChannelMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  // Sync from server when revalidate ships fresh data.
  const lastIdsRef = React.useRef<string>(messages.map((m) => m.id).join("|"));
  React.useEffect(() => {
    const next = initialMessages.map((m) => m.id).join("|");
    if (next !== lastIdsRef.current) {
      lastIdsRef.current = next;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await postPartnerCoupleMessage({ coupleId, body: trimmed });
    setPosting(false);
    if (!res.ok) {
      toast.error(isHe ? "השליחה נכשלה — נסו שוב" : "Send failed — try again");
      return;
    }
    setDraft("");
    router.refresh();
  };

  return (
    <section
      dir={isHe ? "rtl" : "ltr"}
      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-bold tracking-wider text-white/85">
          {isHe ? "השיחה ביניכם" : "Your shared channel"}
        </h3>
        <p className="text-[11px] text-white/55">
          {isHe
            ? "שלושתכם רואים: אתם, בן/בת הזוג, והמומחה"
            : "Three of you here: you, your partner, and the coach"}
        </p>
      </header>

      <ol className="mb-4 max-h-[420px] space-y-3 overflow-y-auto pe-1">
        {messages.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-[14px] text-white/55">
            {isHe
              ? "אין כאן עדיין שום הודעה. תוכלו להתחיל."
              : "Nothing here yet. You can start."}
          </li>
        ) : (
          messages.map((m) => (
            <CoupleRow
              key={m.id}
              message={m}
              viewerUserId={viewerUserId}
              partnerLabel={partnerLabel}
              isHe={isHe}
            />
          ))
        )}
      </ol>

      <form onSubmit={(e) => void onSend(e)} className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          dir={isHe ? "rtl" : "ltr"}
          rows={3}
          maxLength={4000}
          placeholder={
            isHe
              ? "מה רוצים להגיד לשניהם?"
              : "What do you want to say to both of them?"
          }
          className="min-h-[80px] resize-y border-white/15 bg-white/[0.04] text-white placeholder:text-white/35"
          disabled={posting}
        />
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={posting || draft.trim().length === 0}
            className="min-w-[120px] gap-2"
          >
            {posting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isHe ? "שליחה" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function CoupleRow({
  message,
  viewerUserId,
  partnerLabel,
  isHe,
}: {
  message:      CoupleChannelMessage;
  viewerUserId: string;
  partnerLabel: string;
  isHe:         boolean;
}) {
  const isExpert = message.author_kind === "expert";
  const isMine   = message.author_user_id === viewerUserId && !isExpert;

  // Three lanes: expert anchored start, mine anchored start (so the
  // user's own bubble lands on their natural side), partner anchored
  // end. Visual differentiation by tone color.
  const align = isExpert ? "justify-start" : isMine ? "justify-start" : "justify-end";

  const tone = isExpert
    ? "border-[#B83C4D]/40 bg-gradient-to-br from-[#B83C4D]/15 via-[#B83C4D]/8 to-transparent text-white"
    : isMine
      ? "border-white/15 bg-white/[0.06] text-white"
      : "border-amber-300/25 bg-amber-400/[0.06] text-white";

  // Sender label: coach name (Layer-2 persona) / "you" / partner's
  // resolved label.
  const expertPersona = message.expert_persona ?? null;
  const expertDisplayName = expertPersona
    ? (isHe
        ? expertPersona.display_name_he
        : expertPersona.display_name_en) ||
      expertPersona.display_name_he
    : null;

  const senderLabel = isExpert
    ? expertDisplayName ?? (isHe ? "המומחה שלכם" : "Your coach")
    : isMine
      ? isHe
        ? "אתם"
        : "You"
      : partnerLabel;

  const expertAvatarUrl = expertPersona?.avatar_url ?? null;
  const avatarInitial = isExpert
    ? (expertDisplayName ?? (isHe ? "מ" : "M")).slice(0, 1)
    : senderLabel.slice(0, 1);

  return (
    <li className={cn("flex gap-2", align)}>
      {isExpert ? (
        expertAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expertAvatarUrl}
            alt={senderLabel}
            className="mt-1 h-9 w-9 shrink-0 self-start rounded-full border-2 border-[#B83C4D]/40 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-[15px] font-bold text-[#FAF6F7]"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 8px 20px -8px rgba(184,60,77,0.6)",
            }}
          >
            {avatarInitial}
          </span>
        )
      ) : null}

      <div className={cn("max-w-[80%] sm:max-w-[72%]", isExpert ? "" : "")}>
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px]",
            !isExpert && !isMine ? "justify-end" : "",
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
        </div>

        <div
          className={cn(
            "rounded-2xl border px-4 py-2.5 backdrop-blur-sm",
            tone,
            isExpert || isMine ? "rounded-ss-md" : "rounded-se-md",
          )}
        >
          <p className="whitespace-pre-wrap text-[15px] leading-[1.55] text-white/95">
            {message.body}
          </p>
        </div>

        <time
          className={cn(
            "mt-1 block text-[10px] text-white/40",
            !isExpert && !isMine ? "text-end" : "",
          )}
          dateTime={message.created_at}
        >
          {new Date(message.created_at).toLocaleString(isHe ? "he-IL" : "en-US", {
            month:  "short",
            day:    "numeric",
            hour:   "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </li>
  );
}
