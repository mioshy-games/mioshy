"use client";

/**
 * PlayerSetup – step 1 of joining.
 *
 * Only asks for the player's name.
 * Avatar + colour are chosen in the GameLobby AFTER joining,
 * so multiple players can see what's taken in real-time before locking in.
 */

import { useMemo, useState } from "react";

export function PlayerSetup({
  onSubmit,
  disabled,
}: {
  onSubmit: (v: { userName: string }) => void;
  disabled?: boolean;
}) {
  const [userName, setUserName] = useState("");

  const canSubmit = useMemo(
    () => userName.trim().length >= 2 && !disabled,
    [disabled, userName],
  );

  return (
    <div
      className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur"
      dir="rtl"
    >
      <div className="text-lg font-bold text-slate-100">הצטרף/י למשחק</div>
      <div className="mt-1 text-sm text-slate-300/80">
        הזן/י שם - דמות וצבע ייבחרו בלובי המשחק.
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-200">
        שם
      </label>
      <input
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) {
            onSubmit({ userName: userName.trim() });
          }
        }}
        placeholder="לדוגמה: נועם"
        maxLength={20}
        className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit({ userName: userName.trim() })}
        className="mt-5 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        המשך →
      </button>
    </div>
  );
}
