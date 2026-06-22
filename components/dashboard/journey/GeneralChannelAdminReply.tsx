"use client";

// ============================================================
// GeneralChannelAdminReply - slice "expert onboarding" PR2.
//
// Per-couple workspace surface for replying inside each partner's
// PRIVATE general channel. The general channel is the catch-all
// thread a user opens with the expert pool when they want to ask
// something that's not tied to a specific item ("how do I refer
// my partner to a therapist?", "we had a fight last night, what
// should I do?").
//
// Per Itzik #4 (PR2 brief):
//   * Per-partner tabs (or sections) - alice's channel and bob's
//     channel are SEPARATE, never merged. Each tab owns one user_id.
//   * Composer at the bottom of each tab → postExpertReplyToChannel.
//   * Sits next to the per-item ClinicianResponseRow column on
//     /dashboard/my-clients/[coupleId] with the same visual weight.
//
// Threaded view shows everything in journey_messages where
// channel_user_id = the partner's user_id, including the user's own
// posts (gray) and prior expert replies (emerald). Sorted ascending,
// rendered top-to-bottom.
//
// Empty state copy clarifies that the channel is per-partner and
// private - it is NOT a "couple shared chat".
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Lock, Mail, MessageCircle } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { postExpertReplyToChannel } from "@/app/actions/journey-messages";
import type { JourneyMessage } from "@/lib/journey-content/messages";
import { HintIcon } from "@/components/ui/hint-icon";

const MAX_LEN = 4000;

interface PartnerChannel {
  userId: string;
  label: string;
  messages: JourneyMessage[];
  /** Present only for admins with WhatsApp configured. Drives the channel
   *  selector for this partner's private channel. */
  whatsapp?: { eligible: boolean; windowOpen: boolean };
}

type Channel = "email" | "whatsapp" | "both";

export function GeneralChannelAdminReply({
  partners,
}: {
  partners: PartnerChannel[];
}) {
  const initialTab = partners[0]?.userId ?? "";
  const [tab, setTab] = React.useState<string>(initialTab);

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-sm text-white/60">
        No partner accounts on this couple yet - the general channel
        opens once a partner signs in.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-white">
            General channel
          </h3>
          <HintIcon topic="channel.admin_reply" />
          <span className="text-[11px] text-white/45">
            ·
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/55">
            <Lock className="h-3 w-3" aria-hidden />
            Per-partner, private
          </span>
          <HintIcon topic="channel.privacy_isolation" />
        </div>
      </header>

      {partners.length === 1 ? (
        <ChannelPanel partner={partners[0]} />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex-col">
          <TabsList className="bg-slate-950/40">
            {partners.map((p) => (
              <TabsTrigger
                key={p.userId}
                value={p.userId}
                className="text-xs"
              >
                {p.label}
                {p.messages.length > 0 ? (
                  <span className="ms-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/10 px-1 text-[10px] font-semibold text-white/70">
                    {p.messages.length}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {partners.map((p) => (
            <TabsContent
              key={p.userId}
              value={p.userId}
              className="mt-3 outline-none"
            >
              <ChannelPanel partner={p} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function ChannelPanel({ partner }: { partner: PartnerChannel }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [channel, setChannel] = React.useState<Channel>("email");
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const waReachable = !!partner.whatsapp?.eligible;
  const waSelected = channel === "whatsapp" || channel === "both";

  // Messages are sorted oldest→newest, so the latest sit at the bottom of the
  // scroller. Jump to the bottom on open (and when new messages arrive) so the
  // expert lands on the most recent exchange — at least the last few replies
  // are visible without having to scroll.
  const listRef = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [partner.userId, partner.messages.length]);

  const trimmed = body.trim();
  const tooLong = body.length > MAX_LEN;
  const disabled = pending || trimmed.length === 0 || tooLong;

  async function handleSend() {
    if (disabled) return;
    setPending(true);
    setFeedback(null);
    const res = await postExpertReplyToChannel({
      channelUserId: partner.userId,
      body,
      channel,
    });
    setPending(false);
    if (!res.ok) {
      setFeedback(res.error ?? "Error");
      return;
    }
    setBody("");
    setFeedback("נשלח");
    setTimeout(() => setFeedback(null), 4000);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Thread */}
      {partner.messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.015] p-4 text-center text-xs text-white/55">
          {partner.label} hasn&apos;t messaged the general channel yet.
          You can still write the first message below - it will open
          their channel.
        </div>
      ) : (
        <ul ref={listRef} className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {partner.messages.map((m) => (
            <ChannelMessageRow key={m.id} message={m} />
          ))}
        </ul>
      )}

      {/* Composer */}
      <div className="rounded-lg border border-white/[0.08] bg-slate-950/40 p-3">
        {/* Channel selector — admin only (whatsapp prop present). Default email. */}
        {partner.whatsapp ? (
          <div dir="rtl" className="mb-2 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "email", label: "מייל", Icon: Mail, disabled: false },
                { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle, disabled: !waReachable },
                { key: "both", label: "שניהם", Icon: Send, disabled: !waReachable },
              ] as const).map(({ key, label, Icon, disabled }) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => setChannel(key)}
                  aria-pressed={channel === key}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
                    "focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40",
                    channel === key
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-white/15 text-white/60 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {!waReachable ? (
              <p className="text-[11px] text-amber-300/80">
                הלקוח לא אישר WhatsApp או חסר נייד. ההודעה תישלח במייל.
              </p>
            ) : waSelected ? (
              <p className="text-[11px] text-white/50">
                {partner.whatsapp.windowOpen
                  ? "חלון פתוח — ההודעה תישלח כפי שהיא ב-WhatsApp."
                  : "חלון סגור — תישלח תבנית הנדנוד עם קישור לשיחה. התוכן המלא יישאר במייל ובאפליקציה."}
              </p>
            ) : null}
          </div>
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={MAX_LEN + 200 /* visible warning band */}
          placeholder={`כתבו תגובה ל-${partner.label}…`}
          dir="rtl"
          className={[
            "w-full resize-y rounded-md border bg-slate-950/60 p-2",
            "text-sm text-white placeholder:text-white/30",
            "focus:outline-none focus:ring-2 focus:ring-white/20",
            tooLong ? "border-rose-500/40" : "border-white/10",
          ].join(" ")}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className={[
              "text-[11px] tabular-nums",
              tooLong ? "text-rose-300" : "text-white/40",
            ].join(" ")}
          >
            {(MAX_LEN - body.length).toLocaleString()} תווים
          </span>
          <div className="flex items-center gap-2">
            {feedback ? (
              <span className="text-[11px] text-emerald-200/80">
                {feedback}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={disabled}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                disabled
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-white text-slate-950 hover:bg-white/90",
              ].join(" ")}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              שליחה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelMessageRow({ message }: { message: JourneyMessage }) {
  const isExpert = message.author_kind === "expert";
  const ts = new Date(message.created_at);
  const timeLabel = ts.toLocaleString();
  return (
    <li
      className={[
        "rounded-lg border p-3",
        isExpert
          ? "border-emerald-400/15 bg-emerald-500/[0.04]"
          : "border-white/[0.08] bg-white/[0.025]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={[
            "uppercase tracking-wider",
            isExpert ? "text-emerald-200/80" : "text-white/45",
          ].join(" ")}
        >
          {isExpert ? "מומחה" : "לקוח"}
        </span>
        <time className="text-white/40" dateTime={message.created_at}>
          {timeLabel}
        </time>
      </div>
      <p
        dir="auto"
        className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/85"
      >
        {message.body}
      </p>
    </li>
  );
}
