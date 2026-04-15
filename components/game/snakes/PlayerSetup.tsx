"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const avatars = ["💜", "🖤", "🔥", "✨", "😈", "🥂", "🌙", "💋", "🌈", "🧿"];
const colors = ["#c084fc", "#60a5fa", "#4ade80", "#f87171", "#fb923c", "#facc15"];

export function PlayerSetup({
  onSubmit,
  disabled,
}: {
  onSubmit: (v: { userName: string; avatar: string; color: string }) => void;
  disabled?: boolean;
}) {
  const [userName, setUserName] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]!);
  const [color, setColor] = useState(colors[0]!);

  const canSubmit = useMemo(() => userName.trim().length >= 2 && !disabled, [disabled, userName]);

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur" dir="rtl">
      <div className="text-lg font-bold text-slate-100">הגדר שחקן</div>
      <div className="mt-1 text-sm text-slate-300/80">
        בחר/י שם, אוואטר וצבע — ואז הצטרף/י לחדר.
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-200">שם</label>
      <input
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="לדוגמה: נועם"
        className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-sm font-semibold text-slate-200">אוואטר</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {avatars.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={cn(
                  "h-10 w-10 rounded-full border text-lg",
                  "bg-white/5 hover:bg-white/10",
                  a === avatar ? "border-cyan-300/50 ring-2 ring-cyan-300/20" : "border-white/10",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-200">צבע</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-10 w-10 rounded-full border",
                  c === color ? "ring-2 ring-white/15" : "",
                )}
                style={{
                  backgroundColor: `${c}33`,
                  borderColor: c,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit({ userName: userName.trim(), avatar, color })}
        className="mt-5 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        הצטרף/י
      </button>
    </div>
  );
}

