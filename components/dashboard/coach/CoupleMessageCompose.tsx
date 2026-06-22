"use client";

/**
 * CoupleMessageCompose
 * ─────────────────────────────────────────────────────────
 * Layer-5 coach-side compose box for sending a couple-addressed
 * message. Mounted on /dashboard/my-clients/[coupleId].
 *
 * Distinct from the per-partner channel: this writes to the
 * couple-shared channel that BOTH partners see. UI makes that
 * clear with a "Both partners see this" line.
 *
 * Channel selector (admin-only, additive): email / WhatsApp / both.
 * Default = email, so behaviour is unchanged unless an admin opts in.
 * The `whatsapp` prop is present only when the caller is an admin AND
 * WhatsApp is configured; when absent the box is exactly as before.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, HeartHandshake, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { postCoachCoupleMessage } from "@/app/actions/journey-couple-channel";

type Channel = "email" | "whatsapp" | "both";

interface Props {
  coupleId: string;
  /** Present only for admins with WhatsApp configured. Drives the channel selector. */
  whatsapp?: {
    /** Partners reachable on WhatsApp (valid mobile + opt-in, not opted out). */
    eligibleCount: number;
    /** At least one eligible partner is inside the 24h free-text window. */
    anyWindowOpen: boolean;
  };
}

export function CoupleMessageCompose({ coupleId, whatsapp }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [pending, startTransition] = useTransition();

  const waReachable = !!whatsapp && whatsapp.eligibleCount > 0;
  const waSelected = channel === "whatsapp" || channel === "both";

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await postCoachCoupleMessage({
        coupleId,
        body: trimmed,
        channel,
      });
      if (!res.ok) {
        toast.error(`Send failed: ${res.error}`);
        return;
      }
      toast.success(
        waSelected ? "נשלח לשני בני הזוג (מייל + WhatsApp)" : "Sent to both partners",
      );
      setBody("");
      router.refresh();
    });
  };

  return (
    <section className="rounded-md border bg-card p-4 space-y-3">
      <header className="flex items-center gap-2">
        <HeartHandshake className="text-muted-foreground size-4" />
        <h3 className="text-sm font-semibold">Send to both partners</h3>
      </header>
      <p className="text-muted-foreground text-xs">
        This goes to the shared couple channel. Both partners see it,
        attributed to your coach persona. Use this for couple-level
        observations or when you want to address both at once.
      </p>

      {/* Channel selector — admin only (prop present). Default stays email. */}
      {whatsapp ? (
        <div dir="rtl" className="space-y-1.5">
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${
                  channel === key
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/15 text-muted-foreground hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {!waReachable ? (
            <p className="text-[11px] text-amber-300/80">
              אף אחד מבני הזוג לא אישר WhatsApp או חסר נייד. ההודעה תישלח במייל.
            </p>
          ) : waSelected ? (
            <p className="text-[11px] text-muted-foreground">
              {whatsapp.anyWindowOpen
                ? "חלון פתוח — ההודעה תישלח כפי שהיא ב‑WhatsApp."
                : "חלון סגור — תישלח תבנית הנדנוד עם קישור לשיחה. התוכן המלא יישאר במייל ובאפליקציה."}
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSend} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={4000}
          dir="rtl"
          placeholder="ראיתי משהו השבוע שאני רוצה לחלוק עם שניכם…"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending || body.trim().length === 0}
            className="gap-2"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send to couple
          </Button>
        </div>
      </form>
    </section>
  );
}
