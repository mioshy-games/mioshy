"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, Pencil } from "lucide-react";
import { toggleGameActive } from "@/app/dashboard/actions/games";

export function GameActions({
  gameId,
  isActive,
}: {
  gameId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState(false);

  async function onToggle(checked: boolean) {
    setLoading(true);
    const res = await toggleGameActive(gameId, checked);
    setLoading(false);
    if (res.ok) {
      setActive(checked);
      toast.success(checked ? "Game activated" : "Game deactivated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function duplicate() {
    setLoading(true);
    try {
      const res = await fetch(`/dashboard/games/${gameId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Duplicate failed");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      toast.success("Game duplicated");
      router.push(`/dashboard/games/${id}/edit`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Active</span>
        <Switch
          checked={active}
          disabled={loading}
          onCheckedChange={(v) => void onToggle(v)}
        />
      </div>
      <Link
        href={`/dashboard/games/${gameId}/edit`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex gap-1.5",
        )}
      >
        <Pencil className="size-3.5" />
        Edit
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            loading && "pointer-events-none opacity-50",
          )}
          disabled={loading}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void duplicate()}>
            Duplicate game
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
