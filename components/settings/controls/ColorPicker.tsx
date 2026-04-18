"use client";

import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  onChange: (color: string) => void;
  className?: string;
};

export function ColorPicker({ label, value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);

  function handleHexChange(v: string) {
    setHex(v);
    // Only propagate when valid 3 or 6 digit hex
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
      onChange(v);
    }
  }

  function handleNativeChange(v: string) {
    setHex(v);
    onChange(v);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        {/* Native color swatch */}
        <button
          type="button"
          className="w-9 h-9 rounded-md border border-border cursor-pointer overflow-hidden flex-shrink-0"
          style={{ backgroundColor: value }}
          onClick={() => inputRef.current?.click()}
          title="Pick color"
        >
          <input
            ref={inputRef}
            type="color"
            value={value.startsWith("#") ? value : "#ffffff"}
            onChange={(e) => handleNativeChange(e.target.value)}
            className="opacity-0 w-full h-full cursor-pointer"
          />
        </button>

        {/* Hex text input */}
        <Input
          value={hex}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => setHex(value)} // reset if invalid on blur
          className="h-9 font-mono text-sm uppercase"
          maxLength={7}
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
}
