"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocalSnakesStore } from "@/lib/store/useLocalSnakesStore";
import { useLocalGameRoom } from "@/hooks/useLocalGameRoom";
import { SnakesGameBoard } from "@/components/game/snakes/SnakesGameBoard";
import { DEFAULT_SNAKES_CONFIG } from "@/lib/snakes/defaultConfig";
import { unlockAudio } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

const AVATAR_OPTIONS = ["💜", "💛", "💙", "💚", "🌸", "🔥", "🌊", "🌙", "⭐", "🦋"];
const COLOR_OPTIONS = [
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#22d3ee", // cyan
  "#84cc16", // lime
];

interface DraftPlayer {
  id: string; // local-only id used for keying the draft row
  userName: string;
  avatar: string;
  color: string;
}

function draftId() {
  return `draft_${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaults(index: number): DraftPlayer {
  return {
    id: draftId(),
    userName: "",
    avatar: AVATAR_OPTIONS[index % AVATAR_OPTIONS.length],
    color: COLOR_OPTIONS[index % COLOR_OPTIONS.length],
  };
}

/**
 * LocalGameClient - full single-device pass-the-phone flow.
 *
 *   Lobby → add at least two players, pick avatars/colors → start.
 *   Game  → same SnakesGameBoard as remote mode, backed by useLocalGameRoom.
 *
 * The local store only lives in memory, so a refresh drops the session -
 * that's acceptable for ephemeral play and avoids privacy concerns.
 */
export function LocalGameClient() {
  const router = useRouter();
  const locale = useLocale();
  const adapter = useLocalGameRoom();
  const {
    createRoom: storeCreateRoom,
    addPlayer: storeAddPlayer,
    removePlayer: storeRemovePlayer,
    startGame: storeStartGame,
    players: storePlayers,
    room: storeRoom,
  } = useLocalSnakesStore();

  // ── Pre-fill from sessionStorage + auto-start flag ──────────────────────
  // Coming from /game (the unified setup screen)? Both players are already
  // configured there. Read them in, and if `local_auto_start` was set by
  // /game, skip the lobby entirely and start the game on mount. If the
  // user navigated here directly (no flag), show the lobby as before so
  // they can still configure 2-6 players manually.
  //
  // BOOT MODE — computed synchronously during the very first render so
  // we KNOW from frame 1 whether to skip the lobby UI. Without this,
  // the lobby flashes for a moment between mount and the auto-start
  // useEffect firing (Itzik feedback round 3, 2026-05-05).
  const [bootSnapshot] = useState(() => {
    try {
      const raw1 = sessionStorage.getItem("local_p1");
      const raw2 = sessionStorage.getItem("local_p2");
      const auto = sessionStorage.getItem("local_auto_start");
      if (raw1 && raw2) {
        const p1 = JSON.parse(raw1) as { userName: string; avatar: string; color: string };
        const p2 = JSON.parse(raw2) as { userName: string; avatar: string; color: string };
        sessionStorage.removeItem("local_p1");
        sessionStorage.removeItem("local_p2");
        sessionStorage.removeItem("local_auto_start");
        return {
          drafts: [
            { id: `draft_${Math.random().toString(36).slice(2, 8)}`, userName: p1.userName, avatar: p1.avatar, color: p1.color },
            { id: `draft_${Math.random().toString(36).slice(2, 8)}`, userName: p2.userName, avatar: p2.avatar, color: p2.color },
          ],
          autoStart: auto === "1",
        };
      }
    } catch { /* ignore */ }
    return { drafts: [buildDefaults(0), buildDefaults(1)], autoStart: false };
  });
  const [autoStartPending, setAutoStartPending] = useState<boolean>(bootSnapshot.autoStart);
  const [drafts, setDrafts] = useState<DraftPlayer[]>(bootSnapshot.drafts);
  const [err, setErr] = useState<string | null>(null);

  // Build a fresh lobby room when the page loads, so state is clean every visit.
  useEffect(() => {
    if (!storeRoom) {
      storeCreateRoom(DEFAULT_SNAKES_CONFIG);
    }
  }, [storeCreateRoom, storeRoom]);

  // Auto-redirect to the unified /game setup whenever the user lands
  // here WITHOUT a fresh auto-start payload AND there's no active game
  // in progress — Itzik 2026-05-05: the standalone local lobby was
  // confusing on refresh / back-button. The unified /game screen is
  // now the single setup entry point. We allow this page to stay
  // visible only when:
  //   1. autoStartPending (we're in the middle of starting from /game), OR
  //   2. storeRoom is "playing" / "ended" (an active game is live).
  // In all other cases — redirect to /game.
  useEffect(() => {
    if (autoStartPending) return;
    if (storeRoom?.status === "playing" || storeRoom?.status === "ended") return;
    router.replace(`/${locale}/game`);
  }, [autoStartPending, storeRoom, router, locale]);

  // Auto-start when the unified /game setup primed sessionStorage with
  // local_auto_start. We wait for the room to exist (above effect creates
  // it) and the drafts to be valid, then fire handleStart once. The
  // `autoStartPending` flag is the single source of truth so React
  // double-mounts in dev mode can't trigger this twice.
  useEffect(() => {
    if (!autoStartPending) return;
    if (!storeRoom) return;
    handleStart();
    setAutoStartPending(false);
    // We intentionally exclude handleStart from deps — it captures fresh
    // drafts on every render and we only want this to fire once after
    // mount. autoStartPending is the gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartPending, storeRoom]);

  const updateDraft = (id: string, patch: Partial<DraftPlayer>) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addDraft = () => {
    if (drafts.length >= 6) return;
    setDrafts((ds) => [...ds, buildDefaults(ds.length)]);
  };

  const removeDraft = (id: string) => {
    setDrafts((ds) => (ds.length <= 2 ? ds : ds.filter((d) => d.id !== id)));
  };

  const canStart = useMemo(() => {
    if (drafts.length < 2) return false;
    const names = drafts.map((d) => d.userName.trim());
    if (names.some((n) => !n)) return false;
    const avatars = drafts.map((d) => d.avatar);
    const colors = drafts.map((d) => d.color);
    if (new Set(avatars).size !== avatars.length) return false;
    if (new Set(colors).size !== colors.length) return false;
    return true;
  }, [drafts]);

  const handleStart = () => {
    setErr(null);
    if (!canStart) {
      // When auto-start fails validation (bad sessionStorage data), don't
      // show the user a confusing red error — just clear the flag and let
      // them set things up manually.
      if (autoStartPending) {
        setAutoStartPending(false);
        return;
      }
      setErr(
        locale === "he"
          ? "ודאו שיש לפחות שני שחקנים עם שמות, ולכל אחד אוואטר וצבע ייחודיים."
          : "Make sure both players have names and that each has a unique avatar and color.",
      );
      return;
    }
    unlockAudio(); // iOS AudioContext needs a user-gesture unlock
    track("game_start", { game_type: "snakes", mode: "local", player_count: drafts.length });

    // Reset players in the store & push the drafts as players.
    // (createRoom above gave us a fresh lobby; clear any prior players.)
    for (const p of storePlayers) storeRemovePlayer(p.id);

    const playerIds: string[] = [];
    for (const d of drafts) {
      const id = storeAddPlayer({
        userName: d.userName.trim(),
        avatar: d.avatar,
        color: d.color,
      });
      playerIds.push(id);
    }

    // Flip room → playing with seeded GameState.
    const positions: Record<string, number> = {};
    for (const id of playerIds) positions[id] = 1;
    storeStartGame({
      currentPlayerIndex: 0,
      positions,
      phase: "waiting_flip",
      currentQuestion: null,
      lastCoinResult: null,
      lastDiceResult: null,
      winner: null,
      turnCount: 0,
      log: [],
    });
  };

  const handlePlayAgain = async () => {
    // Reset gameplay state but keep the same players.
    const positions: Record<string, number> = {};
    for (const p of storePlayers) positions[p.id] = 1;
    storeStartGame({
      currentPlayerIndex: 0,
      positions,
      phase: "waiting_flip",
      currentQuestion: null,
      lastCoinResult: null,
      lastDiceResult: null,
      winner: null,
      turnCount: 0,
      log: [],
    });
  };

  const handleExit = async () => {
    await adapter.leaveRoom();
    router.push(`/${locale}/game`);
  };

  // Once the room is playing, defer to the shared board.
  if (storeRoom && (storeRoom.status === "playing" || storeRoom.status === "ended")) {
    return (
      <SnakesGameBoard adapter={adapter} onExit={handleExit} onPlayAgain={handlePlayAgain} />
    );
  }

  // Auto-start path — we arrived here from /game with sessionStorage
  // primed. Don't flash the lobby UI; render a minimal loading state
  // until the room transitions to "playing" and the branch above takes
  // over. If something goes wrong during validation, handleStart
  // clears autoStartPending → falls through to the lobby below so the
  // user can correct things manually.
  if (autoStartPending) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4" dir={locale === "he" ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9A961]/30 border-t-[#E6CB85]" />
          <div className="font-['Playfair_Display',Georgia,serif] text-sm text-[#C9A961]/70">
            {locale === "he" ? "מכינים את המשחק…" : "Preparing the game…"}
          </div>
        </div>
      </main>
    );
  }

  // Otherwise: lobby.
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10" dir="rtl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-amber-50">
          משחק מקומי 🎲
        </h1>
        <p className="text-slate-300/80">
          הוסיפו 2–6 שחקנים, בחרו אוואטר וצבע, והתחילו לשחק על אותו מכשיר.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {drafts.map((d, idx) => (
          <div
            key={d.id}
            className="rounded-3xl border border-amber-100/15 bg-stone-950/55 p-4 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-amber-50">
                שחקן {idx + 1}
              </div>
              {drafts.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  className="text-xs font-bold text-rose-300/80 hover:text-rose-200"
                >
                  הסר
                </button>
              ) : null}
            </div>

            <input
              value={d.userName}
              onChange={(e) => updateDraft(d.id, { userName: e.target.value })}
              placeholder="שם"
              maxLength={20}
              className="mt-3 w-full rounded-2xl border border-amber-100/15 bg-stone-900/60 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
            />

            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-amber-100/80">אוואטר</div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((a) => {
                  const takenByOther = drafts.some((x) => x.id !== d.id && x.avatar === a);
                  const chosen = d.avatar === a;
                  return (
                    <button
                      type="button"
                      key={a}
                      disabled={takenByOther}
                      onClick={() => updateDraft(d.id, { avatar: a })}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition",
                        chosen
                          ? "border-amber-300/70 bg-amber-300/10"
                          : takenByOther
                            ? "cursor-not-allowed border-white/5 bg-white/5 opacity-35"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-amber-100/80">צבע</div>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const takenByOther = drafts.some((x) => x.id !== d.id && x.color === c);
                  const chosen = d.color === c;
                  return (
                    <button
                      type="button"
                      key={c}
                      disabled={takenByOther}
                      onClick={() => updateDraft(d.id, { color: c })}
                      aria-label={c}
                      className={cn(
                        "h-9 w-9 rounded-full border-2 transition",
                        chosen
                          ? "scale-110 border-amber-200/90 shadow-lg"
                          : takenByOther
                            ? "cursor-not-allowed border-white/10 opacity-35"
                            : "border-white/20 hover:scale-105",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addDraft}
            disabled={drafts.length >= 6}
            className="min-h-[48px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + הוסף שחקן
          </button>

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="min-h-[48px] flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-rose-400 px-5 py-3 text-sm font-bold text-stone-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            להתחיל משחק 🎲
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
            {err}
          </div>
        ) : null}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/game`)}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← לכל אפשרויות המשחק
        </button>
      </div>
    </main>
  );
}
