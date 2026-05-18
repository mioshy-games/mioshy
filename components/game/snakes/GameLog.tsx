"use client";

import { useEffect, useRef } from "react";
import type { GameLogEntry } from "@/lib/snakes/types";
import { cn } from "@/lib/utils";
import { CmsText } from "@/components/cms/CmsText";

function typeColor(type: GameLogEntry["type"]) {
  switch (type) {
    case "snake":
      return "text-red-300";
    case "ladder":
      return "text-emerald-300";
    case "penalty":
      return "text-orange-300";
    case "win":
      return "text-yellow-200";
    case "flip":
      return "text-cyan-200";
    case "question":
      return "text-purple-200";
    default:
      return "text-slate-200";
  }
}

export function GameLog({ entries }: { entries: GameLogEntry[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  return (
    <div
      ref={ref}
      className="h-56 overflow-auto rounded-2xl border border-slate-700/60 bg-slate-950/40 p-3 text-sm backdrop-blur"
      dir="rtl"
    >
      {entries.length ? (
        <div className="space-y-2">
          {entries.slice(-20).map((e, idx) => (
            <div key={`${e.timestamp}-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5">{e.avatar}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{e.playerName}</span>
                  <span className={cn("text-xs font-semibold", typeColor(e.type))}>
                    {e.action}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CmsText
          cmsKey="snakesGame.gameLog.empty"
          as="div"
          className="text-slate-300/70"
        />
      )}
    </div>
  );
}

