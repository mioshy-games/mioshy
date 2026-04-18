"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
};

export function ToggleRow({ label, description, checked, onCheckedChange, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1", className)}>
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm font-medium cursor-pointer">{label}</Label>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
