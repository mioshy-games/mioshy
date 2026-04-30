"use client";

/**
 * GameLobbyClient - redesigned pre-game flow
 *
 * New flow (registration deferred):
 *   1. Page loads → show player setup immediately (up to 2 players)
 *   2. Player 1 + optional Player 2 fill in names, avatars, colours
 *   3. "Create Room" → if not authenticated → RegistrationModal → createRoom
 *   4. Room is created → GameLobby (lock-in + start)
 *
 *   "Join Room" is a secondary option shown below the create form.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import type { GameType } from "@/components/game/GameTypeSelector";
import { GameLobby } from "@/components/game/snakes/GameLobby";
import { cn } from "@/lib/utils";
import { useGameRoom } from "@/hooks/useGameRoom";
import { RegistrationModal } from "@/components/RegistrationModal";
import type { GameState } from "@/lib/snakes/types";
import { track } from "@/lib/analytics";

// ─── Avatar / colour palettes ────────────────────────────────────────────────
const AVATARS = ["💜", "🖤", "🔥", "✨", "😈", "🥂", "🌙", "💋", "🌈", "🧿"];
const COLORS = [
  { hex: "#c084fc", name: "סגול" },
  { hex: "#60a5fa", name: "כחול" },
  { hex: "#4ade80", name: "ירוק" },
  { hex: "#f87171", name: "אדום" },
  { hex: "#fb923c", name: "כתום" },
  { hex: "#facc15", name: "צהוב" },
];

interface PlayerDraft {
  userName: string;
  avatar: string;
  color: string;
}

function buildDefault(index: number): PlayerDraft {
  return {
    userName: "",
    avatar: AVATARS[index % AVATARS.length],
    color: COLORS[index % COLORS.length].hex,
  };
}

// ─── Mini player card (name + avatar + colour) ────────────────────────────────
function PlayerCard({
  draft,
  index,
  otherDraft,
  onChange,
}: {
  draft: PlayerDraft;
  index: number;
  otherDraft?: PlayerDraft;
  onChange: (patch: Partial<PlayerDraft>) => void;
}) {
  const takenAvatars = new Set(otherDraft ? [otherDraft.avatar] : []);
  const takenColors  = new Set(otherDraft ? [otherDraft.color]  : []);

  return (
    <div className="rounded-3xl border border-amber-100/15 bg-stone-950/55 p-4 backdrop-blur" dir="rtl">
      <div className="mb-3 text-sm font-bold text-amber-50">שחקן {index + 1}</div>

      <input
        value={draft.userName}
        onChange={(e) => onChange({ userName: e.target.value })}
        placeholder={index === 0 ? "השם שלך…" : "שם השחקן השני…"}
        maxLength={20}
        className="w-full rounded-2xl border border-amber-100/15 bg-stone-900/60 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
      />

      {/* Avatar row */}
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-semibold text-amber-100/70">אוואטר</div>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => {
            const taken  = takenAvatars.has(a);
            const chosen = draft.avatar === a;
            return (
              <button
                type="button"
                key={a}
                disabled={taken}
                onClick={() => onChange({ avatar: a })}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition",
                  chosen
                    ? "border-amber-300/70 bg-amber-300/15 ring-2 ring-amber-300/40"
                    : taken
                    ? "cursor-not-allowed border-white/5 bg-white/5 opacity-30"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colour row */}
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-semibold text-amber-100/70">צבע</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(({ hex, name }) => {
            const taken  = takenColors.has(hex);
            const chosen = draft.color === hex;
            return (
              <button
                type="button"
                key={hex}
                disabled={taken}
                onClick={() => onChange({ color: hex })}
                aria-label={name}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition",
                  chosen
                    ? "scale-110 border-amber-200/90 shadow-lg"
                    : taken
                    ? "cursor-not-allowed border-white/10 opacity-30"
                    : "border-white/20 hover:scale-105",
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────
export function GameLobbyClient() {
  const locale  = useLocale();
  const router  = useRouter();
  const [type]  = useState<GameType>("snakes");

  // Track page view once on mount
  useEffect(() => { track("game_lobby_opened", { game_type: "snakes" }); }, []);

  // Player drafts: always show Player 1, toggle Player 2
  const [players1, setPlayers1] = useState<PlayerDraft>(() => buildDefault(0));
  const [players2, setPlayers2] = useState<PlayerDraft>(() => buildDefault(1));
  const [showP2,   setShowP2]   = useState(false);

  // Join-room state
  const [joinMode,  setJoinMode]  = useState(false);
  const [joinCode,  setJoinCode]  = useState("");
  const [joinName,  setJoinName]  = useState("");

  const [isStarting, setIsStarting] = useState(false);
  const [regOpen,    setRegOpen]    = useState(false);

  // Pending create payload - held until user registers, then retried
  const pendingRef = useRef<{ p1: PlayerDraft; p2: PlayerDraft | null } | null>(null);

  const {
    room,
    players: roomPlayers,
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

  // Redirect all clients when game starts
  useEffect(() => {
    if (room?.status === "playing") {
      router.push(`/${locale}/game/${room.code}/snakes`);
    }
  }, [locale, room, router]);

  // After registration: retry the pending create
  const handleRegistered = useCallback(async () => {
    setRegOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    try {
      await createRoom(type, {
        userName: pending.p1.userName.trim(),
        avatar: pending.p1.avatar,
        color: pending.p1.color,
      });
    } catch {
      // errors handled by hook
    }
  }, [createRoom, type]);

  // ── Create-room handler ────────────────────────────────────────────────────
  const handleCreate = async () => {
    const p1 = players1;
    const p2 = showP2 && players2.userName.trim() ? players2 : null;

    if (!p1.userName.trim()) return;

    // If 2 players set up for same device → route to local game with state
    // (remote createRoom only supports one authenticated user per session)
    if (p2) {
      // Store names in sessionStorage so the local game page can pre-fill them
      try {
        sessionStorage.setItem("local_p1", JSON.stringify(p1));
        sessionStorage.setItem("local_p2", JSON.stringify(p2));
      } catch { /* ignore */ }
      router.push(`/${locale}/game/local`);
      return;
    }

    try {
      await createRoom(type, {
        userName: p1.userName.trim(),
        avatar: p1.avatar,
        color: p1.color,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "not_authenticated") {
        pendingRef.current = { p1, p2 };
        setRegOpen(true);
      }
    }
  };

  // ── Join-room handler ──────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (normalizedJoinCode.length !== 4 || !joinName.trim()) return;
    await joinRoom(normalizedJoinCode, { userName: joinName.trim() });
  };

  // ── GameLobby (after room created) ────────────────────────────────────────
  if (room && room.status === "lobby") {
    const handleStartGame = async () => {
      if (!isHost) return;
      setIsStarting(true);
      try {
        const initialPositions: Record<string, number> = {};
        for (const p of roomPlayers) initialPositions[p.id] = 1;
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
        track("game_start", { game_type: "snakes", mode: "remote", player_count: roomPlayers.length });
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

  // ── Setup form ─────────────────────────────────────────────────────────────
  const canCreate = players1.userName.trim().length >= 2;
  const canJoin   = normalizedJoinCode.length === 4 && joinName.trim().length >= 2;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-10" dir="rtl">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-50">
            נחשים וסולמות 🐍🌈
          </h1>
          <p className="text-sm text-slate-300/80">
            הגדירו שחקנים, בחרו דמות - ואז צרו חדר.
          </p>
        </div>

        {/* Local (same-device) quick-start CTA */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/game/local`)}
            className="group flex min-h-[80px] w-full items-center justify-between gap-4 rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-amber-500/15 p-5 text-right font-bold text-amber-50 backdrop-blur transition hover:from-amber-500/25 hover:to-rose-500/20"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎲</span>
              <div>
                <div className="text-base">לשחק על מכשיר אחד (מקומי)</div>
                <div className="mt-0.5 text-xs font-normal text-amber-100/70">
                  בלי קוד, בלי חשבון - מעבירים את הטלפון
                </div>
              </div>
            </div>
            <span className="text-xl text-amber-200 transition group-hover:-translate-x-1">←</span>
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700/60" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            או צרו חדר לשני מכשירים
          </span>
          <div className="h-px flex-1 bg-slate-700/60" />
        </div>

        {/* ── Create-room section ── */}
        {!joinMode && (
          <div className="space-y-4">
            {/* Player 1 */}
            <PlayerCard
              draft={players1}
              index={0}
              otherDraft={showP2 ? players2 : undefined}
              onChange={(patch) => setPlayers1((p) => ({ ...p, ...patch }))}
            />

            {/* Player 2 toggle */}
            {!showP2 ? (
              <button
                type="button"
                onClick={() => setShowP2(true)}
                className="w-full rounded-2xl border border-dashed border-white/20 py-3 text-sm font-semibold text-slate-300 hover:border-amber-300/40 hover:text-amber-200 transition"
              >
                + הוסף שחקן שני (לאותו מכשיר)
              </button>
            ) : (
              <div className="relative">
                <PlayerCard
                  draft={players2}
                  index={1}
                  otherDraft={players1}
                  onChange={(patch) => setPlayers2((p) => ({ ...p, ...patch }))}
                />
                <button
                  type="button"
                  onClick={() => setShowP2(false)}
                  className="absolute left-4 top-4 text-xs font-bold text-rose-300/80 hover:text-rose-200"
                >
                  הסר
                </button>
              </div>
            )}

            {/* Create button */}
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => void handleCreate()}
              className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-amber-400 to-rose-400 px-5 py-3 text-base font-bold text-stone-900 shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-105"
            >
              צור חדר וקבל קוד ←
            </button>

            {/* Switch to join */}
            <button
              type="button"
              onClick={() => setJoinMode(true)}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 transition"
            >
              יש לי קוד חדר - אני רוצה להצטרף
            </button>
          </div>
        )}

        {/* ── Join-room section ── */}
        {joinMode && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur" dir="rtl">
              <div className="mb-3 text-base font-bold text-slate-100">הצטרפות לחדר</div>

              <label className="block text-sm font-semibold text-slate-200">קוד חדר (4 תווים)</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="X7K2"
                maxLength={4}
                className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 font-mono text-xl uppercase tracking-widest text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              />

              <label className="mt-4 block text-sm font-semibold text-slate-200">השם שלך</label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="לדוגמה: נועם"
                maxLength={20}
                className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              />

              <button
                type="button"
                disabled={!canJoin}
                onClick={() => void handleJoin()}
                className="mt-5 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                הצטרף ←
              </button>
            </div>

            <button
              type="button"
              onClick={() => setJoinMode(false)}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 transition"
            >
              ← אני רוצה לפתוח חדר חדש
            </button>
          </div>
        )}

        {/* Error */}
        {error && error !== "יש להתחבר כדי ליצור חדר" && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200" dir="rtl">
            {error}
          </div>
        )}
      </main>

      {/* Registration modal - shown only when unauthenticated user tries to create */}
      <RegistrationModal
        open={regOpen}
        onOpenChange={setRegOpen}
        onSuccess={() => void handleRegistered()}
      />
    </>
  );
}
