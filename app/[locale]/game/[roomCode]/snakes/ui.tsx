"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import { SnakesGameBoard } from "@/components/game/snakes/SnakesGameBoard";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import type { GameAdapter } from "@/lib/snakes/adapter";

function normalize(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * SnakesGameClient — the REMOTE route's entry point.
 *
 * This is now a thin wrapper: it owns the Supabase-backed game room hook,
 * auth, subscription gating, and routing. It delegates the entire gameplay
 * UI to `<SnakesGameBoard>` via a GameAdapter. The local route does the
 * same with `useLocalGameRoom`, which is why the UI component is unaware
 * of the transport.
 */
export function SnakesGameClient({ locale, roomCode }: { locale: string; roomCode: string }) {
  const router = useRouter();
  const code = useMemo(() => normalize(roomCode), [roomCode]);
  const {
    room,
    players,
    myPlayerId,
    error,
    updateGameState,
    leaveRoom,
    transferHostIfNeeded,
    isHost,
  } = useGameRoom(code);

  const [userId, setUserId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  const rollCountRef = useRef(0);

  useEffect(() => {
    if (!room) return;
    if (room.status !== "playing" && room.status !== "ended") {
      router.replace(`/${locale}/game/${code}`);
      return;
    }
    if (room.game_type !== "snakes") {
      router.replace(`/${locale}/games/truth-or-dare`);
    }
  }, [code, locale, room, router]);

  useEffect(() => {
    void transferHostIfNeeded();
  }, [transferHostIfNeeded]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const active = await hasActiveSubscription(supabase, uid);
        if (!cancelled) setSubscribed(active);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room?.id || !userId) return;
    const key = `mioshy:snakes:${room.id}:${userId}:rolls_v1`;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    rollCountRef.current = Number(raw ?? "0") || 0;
  }, [room?.id, userId]);

  // Adapter wrapping the Supabase-backed hook. The paywall is enforced in
  // updateGameState: roll events carry `lastDiceResult`, so we intercept
  // that as a billable action. Other patches (answering a question, advancing
  // turns) are free.
  const gatedUpdateGameState = useMemo(
    () =>
      async (patch: Parameters<typeof updateGameState>[0]) => {
        if (patch && "lastDiceResult" in patch && patch.lastDiceResult != null) {
          if (!subscribed && rollCountRef.current >= 3) {
            setSubLocked(true);
            setSubOpen(true);
            return;
          }
          rollCountRef.current += 1;
          if (room?.id && userId) {
            const key = `mioshy:snakes:${room.id}:${userId}:rolls_v1`;
            window.localStorage.setItem(key, String(rollCountRef.current));
          }
          if (!subscribed && rollCountRef.current >= 3) {
            setSubLocked(true);
            setSubOpen(true);
          }
        }
        await updateGameState(patch);
      },
    [room?.id, subscribed, updateGameState, userId],
  );

  const adapter: GameAdapter = useMemo(
    () => ({
      mode: "remote",
      room,
      players,
      myPlayerId,
      updateGameState: gatedUpdateGameState,
      leaveRoom,
      error,
    }),
    [room, players, myPlayerId, gatedUpdateGameState, leaveRoom, error],
  );

  const handleExit = async () => {
    await leaveRoom();
    router.replace(`/${locale}/game`);
  };

  const handlePlayAgain = async () => {
    if (!isHost) return;
    await updateGameState({
      phase: "waiting_flip",
      currentQuestion: null,
      lastCoinResult: null,
      lastDiceResult: null,
      winner: null,
      turnCount: 0,
      currentPlayerIndex: 0,
      positions: Object.fromEntries(players.map((p) => [p.id, 1])),
      log: [],
    });
    router.replace(`/${locale}/game/${code}`);
  };

  return (
    <>
      <SnakesGameBoard
        adapter={adapter}
        onExit={handleExit}
        onPlayAgain={isHost ? handlePlayAgain : undefined}
      />
      <SubscriptionModal
        open={subOpen}
        onOpenChange={(v) => setSubOpen(v)}
        locked={subLocked}
        userId={userId}
        onRequireAuth={async () => {
          router.push(`/${locale}/auth`);
          return null;
        }}
        onSubscribed={() => {
          setSubscribed(true);
          setSubLocked(false);
          setSubOpen(false);
        }}
        mode="paywall"
      />
    </>
  );
}
