"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useGameRoom } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";
import type { GameConfig, GameState } from "@/lib/snakes/types";

function normalize(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function RoomClient({ locale, roomCode }: { locale: string; roomCode: string }) {
  const router = useRouter();
  const t = useTranslations("gameRoom");
  const code = useMemo(() => normalize(roomCode), [roomCode]);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { room, players, isHost, myPlayerId, error, startGame, transferHostIfNeeded } =
    useGameRoom(code);

  const [startErr, setStartErr] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    if (room.status !== "playing") return;
    if (room.game_type === "snakes") {
      router.replace(`/${locale}/game/${code}/snakes`);
    } else {
      router.replace(`/${locale}/games/truth-or-dare`);
    }
  }, [code, locale, room, router]);

  useEffect(() => {
    void transferHostIfNeeded();
  }, [transferHostIfNeeded]);

  const canStart = isHost && players.length >= 2 && room?.status === "lobby";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-2" dir="rtl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          {t("title")} <span className="text-cyan-200">{code}</span>
        </h1>
        <p className="text-slate-300/80">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur" dir="rtl">
          <div className="text-sm font-semibold text-slate-200">{t("players")}</div>
          <div className="mt-3 space-y-2">
            {players.length ? (
              players.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3",
                    p.id === myPlayerId && "border-cyan-300/30 bg-cyan-500/10",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.avatar}</span>
                    <div className="font-semibold text-slate-100">{p.user_name}</div>
                  </div>
                  {p.is_host ? (
                    <span className="text-xs font-bold text-yellow-200">{t("host")}</span>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-300/70">{t("loading")}</div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur" dir="rtl">
          <div className="text-sm font-semibold text-slate-200">{t("actions")}</div>

          <button
            type="button"
            disabled={!canStart}
            className="mt-4 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={async () => {
              try {
                setStartErr(null);
                const { data: cfg } = await supabase
                  .from("snakes_ladders_config")
                  .select("*")
                  .eq("is_active", true)
                  .maybeSingle();

                const config: GameConfig = {
                  boardSize: (cfg?.board_size ?? 100) as number,
                  coinHeadsSteps: (cfg?.coin_heads_steps ?? 3) as number,
                  coinTailsSteps: (cfg?.coin_tails_steps ?? 1) as number,
                  penaltyType: (cfg?.penalty_type ?? "back5") as "back5" | "start",
                  penaltySteps: (cfg?.penalty_steps ?? 5) as number,
                  snakes: (cfg?.snakes ?? []) as unknown as GameConfig["snakes"],
                  ladders: (cfg?.ladders ?? []) as unknown as GameConfig["ladders"],
                  questions: (cfg?.questions ?? []) as unknown as GameConfig["questions"],
                  name: cfg?.name ?? "Default",
                };

                const positions: Record<string, number> = {};
                for (const p of players) positions[p.id] = 1;
                const initial: GameState = {
                  currentPlayerIndex: 0,
                  positions,
                  phase: "waiting_flip",
                  currentQuestion: null,
                  lastCoinResult: null,
                  lastDiceResult: null,
                  winner: null,
                  turnCount: 0,
                  log: [],
                };

                await startGame(initial, config as unknown as Record<string, unknown>);
              } catch {
                setStartErr("לא ניתן להתחיל משחק. בדקו הרשאות/קונפיג פעיל.");
              }
            }}
          >
            {t("start")}
          </button>

          <div className="mt-3 text-xs text-slate-300/80">
            {t("startHint")}
          </div>

          {(error || startErr) ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
              {startErr ?? error}
            </div>
          ) : null}
        </div>
      </div>

      {null}
    </main>
  );
}

