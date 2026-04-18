"use client";

/**
 * GameLobbyClient
 *
 * Handles the full pre-game flow:
 *   Step 1 – Choose game type + create/join room + enter name
 *   Step 2 – GameLobby: character/colour selection + locking
 *   Step 3 – Host presses Start → redirect to /game/[roomCode]/snakes
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { GameTypeSelector, type GameType } from "@/components/game/GameTypeSelector";
import { PlayerSetup } from "@/components/game/snakes/PlayerSetup";
import { GameLobby } from "@/components/game/snakes/GameLobby";
import { cn } from "@/lib/utils";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { GameState } from "@/lib/snakes/types";

export function GameLobbyClient() {
  const locale = useLocale();
  const router = useRouter();
  const [type, setType]     = useState<GameType | null>("snakes");
  const [mode, setMode]     = useState<"none" | "create" | "join">("none");
  const [joinCode, setJoinCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const {
    room,
    players,
    isHost,
    createRoom,
    joinRoom,
    startGame,
    claimCharacter,
    unlockCharacter,
    error,
  } = useGameRoom();

  const normalizedJoinCode = useMemo(
    () => joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
    [joinCode],
  );

  // ── Non-host redirect: when host starts the game, status flips to
  //    "playing" via Realtime → redirect non-host players automatically ─────
  useEffect(() => {
    if (room?.status === "playing") {
      router.push(`/${locale}/game/${room.code}/snakes`);
    }
  }, [locale, room, router]);

  // ── If we're in a room (lobby phase) → show GameLobby ───────────────────
  if (room && room.status === "lobby") {
    const handleStartGame = async () => {
      if (!isHost) return;
      setIsStarting(true);
      try {
        const initialPositions: Record<string, number> = {};
        for (const p of players) {
          initialPositions[p.id] = 1;
        }
        const initialState: GameState = {
          currentPlayerIndex: 0,
          positions: initialPositions,
          phase: "waiting_flip",
          currentQuestion: null,
          lastCoinResult: null,
          lastDiceResult: null,
          winner: null,
          turnCount: 0,
          log: [],
        };
        await startGame(initialState, {});
        // Redirect all to the game page — non-hosts will be redirected by
        // the Realtime room.status update in their own client.
        router.push(`/${locale}/game/${room.code}/snakes`);
      } finally {
        setIsStarting(false);
      }
    };

    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <GameLobby
          roomCode={room.code}
          isHost={isHost}
          onClaimCharacter={claimCharacter}
          onUnlockCharacter={unlockCharacter}
          onStartGame={handleStartGame}
          isStarting={isStarting}
        />
      </main>
    );
  }

  // ── Step 1: create / join form ───────────────────────────────────────────
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          חדר משחק 🎮
        </h1>
        <p className="text-slate-300/80">
          צור חדר חדש או הצטרף לחדר קיים
        </p>
      </div>

      <div className="mt-8">
        <GameTypeSelector value={type} onChange={setType} />
      </div>

      {/* Primary mode choice: local pass-the-phone vs remote multi-device.
          Local gets its own prominent CTA since most couples will play this
          way first (they're on one couch). */}
      <div className="mt-6" dir="rtl">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/game/local`)}
          className="group flex min-h-[88px] w-full items-center justify-between gap-4 rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-amber-500/20 p-5 text-right font-bold text-amber-50 backdrop-blur transition hover:from-amber-500/30 hover:to-rose-500/25"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎲</span>
            <div>
              <div className="text-lg">לשחק עכשיו על מכשיר אחד</div>
              <div className="mt-1 text-xs font-normal text-amber-100/80">
                מעבירים את הטלפון בין השחקנים — בלי קוד ובלי חשבון
              </div>
            </div>
          </div>
          <span className="text-xl text-amber-200 transition group-hover:translate-x-[-4px]">
            ←
          </span>
        </button>
      </div>

      <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-400" dir="rtl">
        או צרו חדר לשני מכשירים
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={cn(
            "min-h-[52px] rounded-2xl border px-5 py-3 text-sm font-bold text-slate-100 backdrop-blur transition",
            mode === "create"
              ? "border-cyan-500/60 bg-cyan-500/10"
              : "border-slate-700/60 bg-slate-950/40 hover:bg-slate-950/60",
          )}
        >
          + צור חדר חדש
        </button>

        <button
          type="button"
          onClick={() => setMode("join")}
          className={cn(
            "min-h-[52px] rounded-2xl border px-5 py-3 text-sm font-bold text-slate-100 backdrop-blur transition",
            mode === "join"
              ? "border-fuchsia-500/60 bg-fuchsia-500/10"
              : "border-slate-700/60 bg-slate-950/40 hover:bg-slate-950/60",
          )}
        >
          🔗 הצטרף לחדר קיים
        </button>
      </div>

      {mode === "join" ? (
        <div className="mt-6 rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur">
          <div className="text-sm font-semibold text-slate-200" dir="rtl">
            קוד חדר (4 תווים)
          </div>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="X7K2"
            maxLength={4}
            className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 font-mono text-xl uppercase tracking-widest text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
          />

          <div className="mt-5">
            <PlayerSetup
              onSubmit={async ({ userName }) => {
                if (normalizedJoinCode.length !== 4) return;
                const ok = await joinRoom(normalizedJoinCode, { userName });
                if (!ok) return;
                // Room + players are now in state → the lobby renders above
              }}
            />
          </div>
        </div>
      ) : null}

      {mode === "create" ? (
        <div className="mt-6">
          <PlayerSetup
            onSubmit={async ({ userName }) => {
              await createRoom(type ?? "snakes", { userName });
              // Room is now in state → the lobby renders above
            }}
          />
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200"
          dir="rtl"
        >
          {error}
        </div>
      ) : null}
    </main>
  );
}
