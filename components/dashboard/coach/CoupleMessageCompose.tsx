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
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { postCoachCoupleMessage } from "@/app/actions/journey-couple-channel";

interface Props {
  coupleId: string;
}

export function CoupleMessageCompose({ coupleId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await postCoachCoupleMessage({
        coupleId,
        body: trimmed,
      });
      if (!res.ok) {
        toast.error(`Send failed: ${res.error}`);
        return;
      }
      toast.success("Sent to both partners");
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
