"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  linkExpertToCoupleByEmail,
  unlinkExpertFromCouple,
} from "@/app/dashboard/actions/experts";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LinkExpertForm({ coupleId }: { coupleId: string }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        startTransition(async () => {
          const res = await linkExpertToCoupleByEmail({
            email: email.trim(),
            coupleId,
            notes: notes.trim() || undefined,
          });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Expert linked");
          setEmail("");
          setNotes("");
          router.refresh();
        });
      }}
      className="border-border flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-xs"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="expert@example.com"
        className="border-input bg-background focus-visible:ring-ring flex-1 rounded-md border px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2"
        required
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="border-input bg-background focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Linking…" : "Link expert"}
      </Button>
    </form>
  );
}

export function UnlinkExpertButton({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm("Unlink this expert from the couple?")) return;
        startTransition(async () => {
          const res = await unlinkExpertFromCouple(linkId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Unlinked");
          router.refresh();
        });
      }}
      disabled={pending}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "ms-auto h-6 px-2 text-xs",
      )}
    >
      <X className="size-3" />
      Unlink
    </button>
  );
}
