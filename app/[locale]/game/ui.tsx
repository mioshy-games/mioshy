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
  isHe,
}: {
  draft: PlayerDraft;
  index: number;
  otherDraft?: PlayerDraft;
  onChange: (patch: Partial<PlayerDraft>) => void;
  isHe: boolean;
}) {
  const takenAvatars = new Set(otherDraft ? [otherDraft.avatar] : []);
  const takenColors  = new Set(otherDraft ? [otherDraft.color]  : []);

  return (
    <div className="rounded-3xl border border-amber-100/15 bg-stone-950/55 p-4 backdrop-blur" dir={isHe ? "rtl" : "ltr"}>
      <div className="mb-3 text-sm font-bold text-amber-50">
        {isHe ? `שחקן ${index + 1}` : `Player ${index + 1}`}
      </div>

      <input
        value={draft.userName}
        onChange={(e) => onChange({ userName: e.target.value })}
        placeholder={
          isHe
            ? index === 0
              ? "השם שלך…"
              : "שם השחקן השני…"
            : index === 0
              ? "Your name…"
              : "Second player's name…"
        }
        maxLength={20}
        className="w-full rounded-2xl border border-amber-100/15 bg-stone-900/60 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
      />

      {/* Avatar row */}
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-semibold text-amber-100/70">
          {isHe ? "אוואטר" : "Avatar"}
        </div>
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
        <div className="mb-1.5 text-xs font-semibold text-amber-100/70">
          {isHe ? "צבע" : "Color"}
        </div>
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
  const isHe    = locale === "he";
  const router  = useRouter();
  const [type]  = useState<GameType>("snakes");

  // Track page view once on mount
  useEffect(() => { track("game_lobby_opened", { game_type: "snakes" }); }, []);

  // Player drafts — both always visible. Itzik 2026-05-05: merged the
  // previous "play locally" CTA + "create room" form into a single
  // 2-player setup with two action buttons. No add-player toggle.
  const [players1, setPlayers1] = useState<PlayerDraft>(() => buildDefault(0));
  const [players2, setPlayers2] = useState<PlayerDraft>(() => buildDefault(1));

  // Join-room state
  const [joinMode,  setJoinMode]  = useState(false);
  const [joinCode,  setJoinCode]  = useState("");
  const [joinName,  setJoinName]  = useState("");

  const [isStarting, setIsStarting] = useState(false);
  const [regOpen,    setRegOpen]    = useState(false);

  // Pending action — held until the user registers, then retried.
  // Two flavors: "create" (host opens a room) and "join" (guest enters
  // an existing room via code). Both flows can hit the not_authenticated
  // error and need the same registration → retry behavior. Itzik
  // 2026-05-05: the previous code only handled create; guests joining via
  // code were stuck on a "must register" message with no UI to do so.
  const pendingRef = useRef<
    | { kind: "create"; p1: PlayerDraft; p2: PlayerDraft | null }
    | { kind: "join"; code: string; userName: string }
    | null
  >(null);

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

  // After registration: retry whatever the user was trying to do — open
  // a fresh room (create) or join one with a code (join).
  const handleRegistered = useCallback(async () => {
    setRegOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    try {
      if (pending.kind === "create") {
        await createRoom(type, {
          userName: pending.p1.userName.trim(),
          avatar: pending.p1.avatar,
          color: pending.p1.color,
        });
      } else {
        // kind === "join"
        await joinRoom(pending.code, { userName: pending.userName });
      }
    } catch {
      // errors surfaced by the hook
    }
  }, [createRoom, joinRoom, type]);

  // ── Mode A: play locally (same device) ─────────────────────────────────────
  // Stash both players in sessionStorage AND a one-shot autostart flag, then
  // route to /game/local. The local lobby page reads the drafts + auto-starts
  // immediately so the user doesn't see a second setup screen.
  const handleStartLocal = () => {
    const p1 = players1;
    const p2 = players2;
    if (!p1.userName.trim() || !p2.userName.trim()) return;
    try {
      sessionStorage.setItem("local_p1", JSON.stringify(p1));
      sessionStorage.setItem("local_p2", JSON.stringify(p2));
      // One-shot flag — /game/local consumes + clears this on mount.
      // Without it, refreshing /game/local would auto-start with stale data.
      sessionStorage.setItem("local_auto_start", "1");
    } catch {
      /* ignore — fall back to manual start in /game/local */
    }
    router.push(`/${locale}/game/local`);
  };

  // ── Mode B: send code to a partner on another device ───────────────────────
  // Creates a remote room with player 1's identity. The partner joins later
  // via the room code on their own device, where THEY pick their own name +
  // avatar + color. Player 2's local draft is unused here (the partner picks
  // their own); we keep its setup visible so users who change their mind and
  // press "play locally" don't lose state.
  const handleSendCode = async () => {
    const p1 = players1;
    if (!p1.userName.trim()) return;
    try {
      await createRoom(type, {
        userName: p1.userName.trim(),
        avatar: p1.avatar,
        color: p1.color,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "not_authenticated") {
        pendingRef.current = { kind: "create", p1, p2: null };
        setRegOpen(true);
      }
    }
  };

  // ── Join-room handler ──────────────────────────────────────────────────────
  // Catches not_authenticated like handleSendCode: stash params, open
  // the registration modal (which also exposes a login flow), retry
  // automatically once the user is authenticated. Itzik 2026-05-05.
  const handleJoin = async () => {
    if (normalizedJoinCode.length !== 4 || !joinName.trim()) return;
    try {
      await joinRoom(normalizedJoinCode, { userName: joinName.trim() });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "not_authenticated") {
        pendingRef.current = {
          kind: "join",
          code: normalizedJoinCode,
          userName: joinName.trim(),
        };
        setRegOpen(true);
      }
    }
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
  const canStartLocal =
    players1.userName.trim().length >= 2 && players2.userName.trim().length >= 2;
  const canSendCode = players1.userName.trim().length >= 2;
  const canJoin   = normalizedJoinCode.length === 4 && joinName.trim().length >= 2;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-10" dir={isHe ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-50">
            {isHe ? "נחשים וסולמות 🐍🌈" : "Snakes & Ladders 🐍🌈"}
          </h1>
          <p className="text-sm text-slate-300/80">
            {isHe
              ? "הגדירו את שני השחקנים — ואז בחרו איך לשחק."
              : "Set up both players — then choose how to play."}
          </p>
        </div>

        {/* ── Unified setup ── always 2 players, two action buttons. */}
        {!joinMode && (
          <div className="mt-6 space-y-4">
            <PlayerCard
              draft={players1}
              index={0}
              otherDraft={players2}
              onChange={(patch) => setPlayers1((p) => ({ ...p, ...patch }))}
              isHe={isHe}
            />
            <PlayerCard
              draft={players2}
              index={1}
              otherDraft={players1}
              onChange={(patch) => setPlayers2((p) => ({ ...p, ...patch }))}
              isHe={isHe}
            />

            {/* Two action buttons — local (primary) + send-code (secondary).
                Local is the strongest CTA because it's frictionless: no
                code, no second device, just hand the phone back and forth. */}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canStartLocal}
                onClick={handleStartLocal}
                className="min-h-[56px] rounded-2xl bg-gradient-to-r from-amber-400 to-rose-400 px-5 py-3 text-base font-bold text-stone-900 shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 hover:brightness-105"
              >
                <span className="block">
                  {isHe ? "🎲 להתחיל לשחק" : "🎲 Start playing"}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-stone-900/75">
                  {isHe
                    ? "על המכשיר הזה — מעבירים את הטלפון"
                    : "On this device — pass the phone around"}
                </span>
              </button>
              <button
                type="button"
                disabled={!canSendCode}
                onClick={() => void handleSendCode()}
                className="min-h-[56px] rounded-2xl border border-amber-300/40 bg-stone-950/55 px-5 py-3 text-base font-bold text-amber-50 backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-amber-300/70 hover:bg-stone-900/60"
              >
                <span className="block">
                  {isHe
                    ? "📱 לשלוח קוד לבן/בת הזוג"
                    : "📱 Send a code to your partner"}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-amber-100/65">
                  {isHe
                    ? "כל אחד על המכשיר שלו"
                    : "Each on their own device"}
                </span>
              </button>
            </div>

            {/* Switch to join */}
            <button
              type="button"
              onClick={() => setJoinMode(true)}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 transition"
            >
              {isHe
                ? "יש לי קוד חדר - אני רוצה להצטרף"
                : "I have a room code — let me join"}
            </button>
          </div>
        )}

        {/* ── Join-room section ── */}
        {joinMode && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-700/60 bg-slate-950/40 p-5 backdrop-blur" dir={isHe ? "rtl" : "ltr"}>
              <div className="mb-3 text-base font-bold text-slate-100">
                {isHe ? "הצטרפות לחדר" : "Join a room"}
              </div>

              <label className="block text-sm font-semibold text-slate-200">
                {isHe ? "קוד חדר (4 תווים)" : "Room code (4 chars)"}
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="X7K2"
                maxLength={4}
                className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 font-mono text-xl uppercase tracking-widest text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              />

              <label className="mt-4 block text-sm font-semibold text-slate-200">
                {isHe ? "השם שלך" : "Your name"}
              </label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder={isHe ? "לדוגמה: נועם" : "e.g. Sarah"}
                maxLength={20}
                className="mt-2 w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              />

              <button
                type="button"
                disabled={!canJoin}
                onClick={() => void handleJoin()}
                className="mt-5 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isHe ? "הצטרף ←" : "Join →"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setJoinMode(false)}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 transition"
            >
              {isHe ? "← אני רוצה לפתוח חדר חדש" : "← I want to open a new room"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && error !== "יש להתחבר כדי ליצור חדר" && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200" dir={isHe ? "rtl" : "ltr"}>
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
