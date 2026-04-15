"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { GameTypeSelector, type GameType } from "@/components/game/GameTypeSelector";
import { PlayerSetup } from "@/components/game/snakes/PlayerSetup";
import { cn } from "@/lib/utils";
import { useGameRoom } from "@/hooks/useGameRoom";

export function GameLobbyClient() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("gameLobby");
  const [type, setType] = useState<GameType | null>("snakes");
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [joinCode, setJoinCode] = useState("");

  const { createRoom, joinRoom, error } = useGameRoom();

  const normalizedJoinCode = useMemo(
    () => joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
    [joinCode],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          {t("title")}
        </h1>
        <p className="text-slate-300/80">{t("subtitle")}</p>
      </div>

      <div className="mt-8">
        <GameTypeSelector value={type} onChange={setType} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={cn(
            "min-h-[52px] rounded-2xl border border-slate-700/60 bg-slate-950/40 px-5 py-3 text-sm font-bold text-slate-100 backdrop-blur",
            "hover:bg-slate-950/60",
          )}
        >
          {t("createRoom")}
        </button>

        <button
          type="button"
          onClick={() => setMode("join")}
          className={cn(
            "min-h-[52px] rounded-2xl border border-slate-700/60 bg-slate-950/40 px-5 py-3 text-sm font-bold text-slate-100 backdrop-blur",
            "hover:bg-slate-950/60",
          )}
        >
          {t("joinRoom")}
        </button>
      </div>

      {mode === "join" ? (
        <div className="mt-6 rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur">
          <div className="text-sm font-semibold text-slate-200" dir="rtl">
            {t("roomCode")}
          </div>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="X7K2"
            className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
          />

          <div className="mt-5">
            <PlayerSetup
              onSubmit={async (playerInfo) => {
                if (normalizedJoinCode.length !== 4) return;
                const ok = await joinRoom(normalizedJoinCode, playerInfo);
                if (ok) router.push(`/${locale}/game/${normalizedJoinCode}`);
              }}
            />
          </div>
        </div>
      ) : null}

      {mode === "create" ? (
        <div className="mt-6">
          <PlayerSetup
            onSubmit={async (playerInfo) => {
              const roomCode = await createRoom(type ?? "snakes", playerInfo);
              router.push(`/${locale}/game/${roomCode}`);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200" dir="rtl">
          {error}
        </div>
      ) : null}
    </main>
  );
}

