"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGameRoom } from "@/hooks/useGameRoom";
import { useSnakesGame } from "@/hooks/useSnakesGame";
import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import { CoinFlip } from "@/components/game/snakes/CoinFlip";
import { QuestionModal } from "@/components/game/snakes/QuestionModal";
import { GameLog } from "@/components/game/snakes/GameLog";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import confetti from "canvas-confetti";

function normalize(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function SnakesGameClient({ locale, roomCode }: { locale: string; roomCode: string }) {
  const router = useRouter();
  const t = useTranslations("snakesGame");
  const code = useMemo(() => normalize(roomCode), [roomCode]);
  const { room, players, myPlayerId, error, updateGameState, leaveRoom, transferHostIfNeeded } =
    useGameRoom(code);
  const { state, config, currentPlayer, isMyTurn, flip, answer } = useSnakesGame({
    room,
    players,
    myPlayerId,
    updateGameState,
  });

  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  const flipCountRef = useRef(0);

  useEffect(() => {
    if (!room) return;
    if (room.status !== "playing") {
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
    const key = `mioshy:snakes:${room.id}:${userId}:flips_v1`;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    flipCountRef.current = Number(raw ?? "0") || 0;
  }, [room?.id, userId]);

  useEffect(() => {
    if (!currentPlayer) return;
    setToast(t("turnOf", { name: currentPlayer.user_name }));
    const timeout = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timeout);
  }, [currentPlayer, t]);

  if (!room || !state || !config) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="text-slate-200" dir="rtl">
          {t("loading")}
        </div>
      </main>
    );
  }

  const winner =
    state.winner ? players.find((p) => p.id === state.winner) ?? null : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
            {t("title")} <span className="text-cyan-200">{code}</span>
          </h1>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            onClick={async () => {
              await leaveRoom();
              router.replace(`/${locale}/game`);
            }}
          >
            {t("leave")}
          </button>
        </div>
        <p className="text-sm text-slate-300/80">
          {config.name ? t("configNamed", { name: config.name }) : t("configActive")}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex justify-center">
          <SnakesBoard config={config} positions={state.positions ?? {}} players={players} />
        </div>

        <aside className="space-y-4" dir="rtl">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-4 backdrop-blur">
            <div className="text-sm font-semibold text-slate-200">{t("players")}</div>
            <div className="mt-3 space-y-2">
              {players.map((p, idx) => {
                const active = idx === state.currentPlayerIndex;
                const pos = state.positions?.[p.id] ?? 1;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2",
                      active && "border-cyan-300/30 bg-cyan-500/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="font-semibold text-slate-100">{p.user_name}</span>
                    </div>
                    <span className="text-xs text-slate-300/80">{pos}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-4 backdrop-blur">
            <div className="text-sm font-semibold text-slate-200">{t("action")}</div>
            <div className="mt-4 flex justify-center">
              {isMyTurn ? (
                <CoinFlip
                  onFlip={async () => {
                    if (!room?.id || !userId) {
                      setSubLocked(true);
                      setSubOpen(true);
                      return;
                    }
                    if (!subscribed && flipCountRef.current >= 3) {
                      setSubLocked(true);
                      setSubOpen(true);
                      return;
                    }
                    await flip();
                    if (!subscribed) {
                      flipCountRef.current += 1;
                      const key = `mioshy:snakes:${room.id}:${userId}:flips_v1`;
                      window.localStorage.setItem(key, String(flipCountRef.current));
                      if (flipCountRef.current >= 3) {
                        setSubLocked(true);
                        setSubOpen(true);
                      }
                    }
                  }}
                  disabled={state.phase !== "waiting_flip"}
                  result={state.lastCoinResult}
                  playerColor={currentPlayer?.color ?? "#60a5fa"}
                />
              ) : (
                <div className="text-sm text-slate-300/80">
                  {t("waiting")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-4 backdrop-blur">
            <div className="text-sm font-semibold text-slate-200">{t("log")}</div>
            <div className="mt-3">
              <GameLog entries={state.log ?? []} />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </aside>
      </div>

      <QuestionModal
        open={state.phase === "question"}
        question={state.currentQuestion}
        playerName={currentPlayer?.user_name ?? ""}
        avatar={currentPlayer?.avatar ?? "💜"}
        penalty={{ penaltyType: config.penaltyType, penaltySteps: config.penaltySteps }}
        onAnswer={answer}
      />

      {state.phase === "ended" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700/60 bg-[rgba(2,6,23,0.92)] p-6 text-slate-100 shadow-2xl">
            <div className="text-center">
              <div className="text-5xl">{winner?.avatar ?? "🏆"}</div>
              <div className="mt-4 text-2xl font-extrabold">
                {winner ? `${winner.user_name} ניצח/ה!` : "יש מנצח!"}
              </div>
              <p className="mt-2 text-sm text-slate-300/80">
                המשחק הסתיים. המארח יכול להתחיל משחק חדש.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-[48px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/10"
                onClick={() => router.replace(`/${locale}/game/${code}`)}
              >
                חזרה ללובי
              </button>
              <button
                type="button"
                className="min-h-[48px] rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                disabled={!myPlayerId || !players.find((p) => p.id === myPlayerId)?.is_host}
                onClick={async () => {
                  // confetti first (client-only)
                  confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
                  // reset to lobby state; host can press start again
                  await updateGameState({
                    phase: "waiting_flip",
                    currentQuestion: null,
                    lastCoinResult: null,
                    winner: null,
                    turnCount: 0,
                    currentPlayerIndex: 0,
                    positions: Object.fromEntries(players.map((p) => [p.id, 1])),
                    log: [],
                  });
                  router.replace(`/${locale}/game/${code}`);
                }}
              >
                משחק חדש (מארח)
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {toast ? (
        <div
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-semibold text-slate-100 backdrop-blur"
          dir="rtl"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}

