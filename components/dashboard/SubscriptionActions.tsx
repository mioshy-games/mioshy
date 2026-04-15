"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSubscriptionStatus } from "@/app/dashboard/actions/subscriptions";

export function SubscriptionActions({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "active" | "paused" | "cancelled") {
    setBusy(true);
    const res = await setSubscriptionStatus(subscriptionId, next);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Subscription set to ${next}`);
    window.location.reload();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || status === "active"}
        onClick={() => void setStatus("active")}
      >
        Resume
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || status === "paused"}
        onClick={() => void setStatus("paused")}
      >
        Pause
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={busy || status === "cancelled"}
        onClick={() => void setStatus("cancelled")}
      >
        Cancel
      </Button>
    </div>
  );
}

