"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function PairCodeWidget({
  pairCode,
  isHe,
  note,
  compact = false,
}: {
  pairCode: string;
  isHe: boolean;
  note?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={compact ? "" : "mt-4"}>
      <div
        className={`inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 ${
          compact ? "px-3 py-1.5" : "px-4 py-2"
        }`}
      >
        <span
          className={`font-mono tracking-[0.3em] text-fuchsia-100 ${
            compact ? "text-base" : "text-xl"
          }`}
        >
          {pairCode}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pairCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
          className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label={isHe ? "העתקת קוד" : "Copy code"}
          title={isHe ? "העתקה" : "Copy"}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      {copied ? (
        <span className="ms-3 text-xs text-emerald-200">
          {isHe ? "הועתק" : "Copied"}
        </span>
      ) : null}
      {note ? <p className="mt-2 text-xs text-white/60">{note}</p> : null}
    </div>
  );
}
