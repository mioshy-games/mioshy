"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import { SnakesGameBoard } from "@/components/game/snakes/SnakesGameBoard";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import {
  FREE_PLAYS_PER_GAME,
  getUserGamePlays,
  incrementUserGamePlays,
} from "@/lib/spins";
import type { GameAdapter } from "@/lib/snakes/adapter";

/** Snakes shares a single per-user budget across every room; this is the
 *  slug we use when recording plays in `user_game_plays`. */
const SNAKES_SLUG = "snakes";

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
        // Seed the per-game counter from the server so navigating between
        // rooms keeps the budget continuous.
        const plays = await getUserGamePlays(supabase, SNAKES_SLUG);
        if (!cancelled) rollCountRef.current = plays.plays_used;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Adapter wrapping the Supabase-backed hook. The paywall is enforced in
  // updateGameState: roll events carry `lastDiceResult`, so we intercept
  // that as a billable action. Other patches (answering a question, advancing
  // turns) are free.
  const gatedUpdateGameState = useMemo(
    () =>
      async (patch: Parameters<typeof updateGameState>[0]) => {
        if (patch && "lastDiceResult" in patch && patch.lastDiceResult != null) {
          if (!subscribed && rollCountRef.current >= FREE_PLAYS_PER_GAME) {
            setSubLocked(true);
            setSubOpen(true);
            return;
          }
          rollCountRef.current += 1;
          if (userId) {
            // Fire-and-forget increment; the server weekly-resets under us.
            void incrementUserGamePlays(createBrowserSupabaseClient(), SNAKES_SLUG);
          }
          if (!subscribed && rollCountRef.current >= FREE_PLAYS_PER_GAME) {
            setSubLocked(true);
            setSubOpen(true);
          }
        }
        await updateGameState(patch);
      },
    [subscribed, updateGameState, userId],
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
    // Back to the games catalog (not the snakes lobby) — per product spec.
    router.replace(`/${locale}/games`);
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
      // Reset the draw pool so the fresh round starts with a newly shuffled
      // cycle rather than finishing off the leftovers from the prior game.
      questionPool: [],
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
        gameSlug={SNAKES_SLUG}
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
