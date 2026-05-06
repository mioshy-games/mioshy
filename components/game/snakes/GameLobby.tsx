"use client";

/**
 * GameLobby
 *
 * Real-time multiplayer lobby for the Snakes & Ladders game.
 *
 * Layout (two-column on md+, stacked on mobile):
 *   LEFT  – Players list  – who's in the room, their locked avatar+colour
 *   RIGHT – Character selection grid + Lock-in button
 *
 * Behaviour:
 *   • Avatars and colours that are locked by OTHER players appear disabled
 *     with a 🔒 badge and cannot be selected.
 *   • The local player's current draft is highlighted in cyan.
 *   • Clicking "Lock In" calls claimCharacter() → RPC → immediate Realtime
 *     update so every other client sees the lock.
 *   • Locked players show a ✅ badge; the host can start once they're ready.
 *   • "Change" button unlocks the local player so they can re-pick.
 */

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  useGameRoomStore,
  selectMyPlayer,
  selectIsMyPlayerLocked,
} from "@/lib/store/useGameRoomStore";
import type { UseGameRoom } from "@/hooks/useGameRoom";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AVATARS = ["💜", "🖤", "🔥", "✨", "😈", "🥂", "🌙", "💋", "🌈", "🧿"];
const COLORS  = [
  { hex: "#c084fc", name: "סגול" },
  { hex: "#60a5fa", name: "כחול" },
  { hex: "#4ade80", name: "ירוק" },
  { hex: "#f87171", name: "אדום" },
  { hex: "#fb923c", name: "כתום" },
  { hex: "#facc15", name: "צהוב" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PlayerCard({
  name,
  avatar,
  color,
  isLocked,
  isHost,
  isMe,
}: {
  name: string;
  avatar: string;
  color: string;
  isLocked: boolean;
  isHost: boolean;
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
        isMe
          ? "border-cyan-400/40 bg-cyan-500/10"
          : "border-slate-700/50 bg-slate-800/30",
      )}
    >
      {/* Avatar circle */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg"
        style={{ borderColor: color, backgroundColor: `${color}22` }}
      >
        {isLocked ? avatar : "❓"}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">
          {name}
          {isHost && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-bold text-amber-400">
              מארח
            </span>
          )}
          {isMe && (
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-xs font-bold text-cyan-400">
              אני
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          {isLocked ? (
            <span className="text-emerald-400">✅ נעול</span>
          ) : (
            <span className="text-slate-500">בוחר/ת…</span>
          )}
        </div>
      </div>

      {/* Colour swatch */}
      {isLocked && (
        <div
          className="h-4 w-4 shrink-0 rounded-full border border-white/10"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface GameLobbyProps {
  roomCode: string;
  isHost: boolean;
  /** Wired from useGameRoom */
  onClaimCharacter: UseGameRoom["claimCharacter"];
  onUnlockCharacter: UseGameRoom["unlockCharacter"];
  /** Called when the host presses Start */
  onStartGame: () => void | Promise<void>;
  /** Feedback during start */
  isStarting?: boolean;
}

export function GameLobby({
  roomCode,
  isHost,
  onClaimCharacter,
  onUnlockCharacter,
  onStartGame,
  isStarting = false,
}: GameLobbyProps) {
  const locale = useLocale();
  const isHe = locale === "he";

  // ── Store ─────────────────────────────────────────────────────────────────
  const players      = useGameRoomStore((s) => s.players);
  const takenAvatars = useGameRoomStore((s) => s.takenAvatars);
  const takenColors  = useGameRoomStore((s) => s.takenColors);
  const draftAvatar  = useGameRoomStore((s) => s.draftAvatar);
  const draftColor   = useGameRoomStore((s) => s.draftColor);
  const isLocking    = useGameRoomStore((s) => s.isLocking);
  const lockError    = useGameRoomStore((s) => s.lockError);
  const myPlayerId   = useGameRoomStore((s) => s.myPlayerId);
  const isMyLocked   = useGameRoomStore(selectIsMyPlayerLocked);
  const myPlayer     = useGameRoomStore(selectMyPlayer);

  const setDraftAvatar = useGameRoomStore((s) => s.setDraftAvatar);
  const setDraftColor  = useGameRoomStore((s) => s.setDraftColor);
  const setLockError   = useGameRoomStore((s) => s.setLockError);

  // Copy room code feedback
  const [copied, setCopied] = useState(false);

  // Pre-fill draft with player's currently locked values when they arrive
  useEffect(() => {
    if (myPlayer?.is_locked) {
      setDraftAvatar(myPlayer.avatar);
      setDraftColor(myPlayer.color);
    }
  }, [myPlayer, setDraftAvatar, setDraftColor]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAvatarClick = (a: string) => {
    if (isMyLocked) return;
    if (takenAvatars.has(a)) return;
    setDraftAvatar(a);
    setLockError(null);
  };

  const handleColorClick = (c: string) => {
    if (isMyLocked) return;
    if (takenColors.has(c)) return;
    setDraftColor(c);
    setLockError(null);
  };

  const handleLockIn = async () => {
    if (isMyLocked || isLocking) return;
    await onClaimCharacter(draftAvatar, draftColor);
  };

  const handleChange = async () => {
    if (!isMyLocked || isLocking) return;
    await onUnlockCharacter();
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const allLocked = players.length > 1 && players.every((p) => p.is_locked);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-5" dir={isHe ? "rtl" : "ltr"}>

      {/* ── Room code banner ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-700/50 bg-slate-900/50 px-5 py-3">
        <div>
          <div className="text-xs text-slate-400">{isHe ? "קוד חדר" : "Room code"}</div>
          <div className="mt-0.5 text-3xl font-black tracking-widest text-white">
            {roomCode}
          </div>
          <div className="mt-1 text-[11px] text-slate-400/80">
            {isHe
              ? "שתפו את הקוד עם בן/בת הזוג שיצטרפ/ו"
              : "Share the code with your partner so they can join"}
          </div>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          {copied
            ? isHe ? "הועתק ✓" : "Copied ✓"
            : isHe ? "העתק" : "Copy"}
        </button>
      </div>

      {/* ── Video-chat tip ─ Itzik 2026-05-05 ─ bilingual */}
      <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/[0.06] to-rose-500/[0.04] px-5 py-3.5 backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl" aria-hidden>📹</span>
          <div className="flex-1 text-sm leading-relaxed text-amber-100/90">
            <span className="font-semibold text-amber-100">
              {isHe ? "טיפ: פותחים שיחת וידאו" : "Tip: open a video call"}
            </span>
            <span className="text-amber-100/75">
              {" "}
              {isHe
                ? "במקביל למשחק - Zoom / FaceTime / WhatsApp - שתראו אחד את השני בזמן שאתם משחקים. החוויה שלמה ככה."
                : "alongside the game - Zoom / FaceTime / WhatsApp - so you can see each other while you play. The experience is complete that way."}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* LEFT – Players list */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            שחקנים ({players.length})
          </h2>

          {players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
              ממתין לשחקנים…
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.user_name}
                  avatar={p.avatar}
                  color={p.color}
                  isLocked={p.is_locked}
                  isHost={p.is_host}
                  isMe={p.id === myPlayerId}
                />
              ))}
            </div>
          )}

          {/* Start game (host only) */}
          {isHost && (
            <button
              type="button"
              disabled={players.length < 1 || isStarting}
              onClick={() => void onStartGame()}
              className={cn(
                "mt-2 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition",
                "bg-gradient-to-r from-fuchsia-600 to-violet-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "hover:brightness-110 active:scale-[0.98]",
                !allLocked && "opacity-80",
              )}
            >
              {isStarting
                ? isHe ? "מתחיל…" : "Starting…"
                : allLocked
                  ? isHe ? "🚀 התחל משחק" : "🚀 Start game"
                  : isHe ? "התחל משחק (לא כולם נעלו)" : "Start game (not everyone locked in)"}
            </button>
          )}
        </div>

        {/* RIGHT – Character picker */}
        <div className="space-y-5">

          {/* Status banner */}
          {isMyLocked ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <span className="text-xl">✅</span>
              <div>
                <div className="text-sm font-bold text-emerald-300">נעלת את הבחירה!</div>
                <div className="text-xs text-emerald-400/70">ממתין/ת שהמארח יתחיל</div>
              </div>
              <button
                type="button"
                onClick={() => void handleChange()}
                disabled={isLocking}
                className="mr-auto rounded-xl border border-emerald-600/50 bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-800/40 disabled:opacity-50"
              >
                שנה
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <div className="text-sm font-semibold text-cyan-300">בחר/י דמות וצבע</div>
              <div className="text-xs text-slate-400">
                לחץ/י על אוואטר וצבע, ואז &quot;נעל בחירה&quot;
              </div>
            </div>
          )}

          {/* Avatar grid */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              אוואטר
            </div>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => {
                const taken  = takenAvatars.has(a);
                const active = draftAvatar === a;
                const locked = isMyLocked && myPlayer?.avatar === a;
                return (
                  <div key={a} className="relative">
                    <button
                      type="button"
                      disabled={taken || isMyLocked}
                      onClick={() => handleAvatarClick(a)}
                      className={cn(
                        "relative h-12 w-12 rounded-2xl border text-xl transition",
                        taken
                          ? "cursor-not-allowed border-slate-700 bg-slate-800/30 opacity-40 grayscale"
                          : isMyLocked && !locked
                          ? "cursor-default border-slate-700 bg-slate-800/30 opacity-40"
                          : active
                          ? "border-cyan-400/60 bg-cyan-500/15 ring-2 ring-cyan-400/30"
                          : "border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/60",
                      )}
                      aria-label={a}
                    >
                      {a}
                    </button>
                    {taken && (
                      <span className="pointer-events-none absolute -right-1 -top-1 text-sm">
                        🔒
                      </span>
                    )}
                    {locked && (
                      <span className="pointer-events-none absolute -right-1 -top-1 text-sm">
                        ✅
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Colour grid */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              צבע
            </div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(({ hex, name }) => {
                const taken  = takenColors.has(hex);
                const active = draftColor === hex;
                const locked = isMyLocked && myPlayer?.color === hex;
                return (
                  <div key={hex} className="relative">
                    <button
                      type="button"
                      disabled={taken || isMyLocked}
                      onClick={() => handleColorClick(hex)}
                      className={cn(
                        "relative h-12 w-12 rounded-2xl border transition",
                        taken
                          ? "cursor-not-allowed opacity-30 grayscale"
                          : isMyLocked && !locked
                          ? "cursor-default opacity-30"
                          : active
                          ? "ring-2 ring-white/40 ring-offset-1 ring-offset-slate-900"
                          : "hover:scale-105",
                      )}
                      style={{
                        backgroundColor: `${hex}33`,
                        borderColor: hex,
                      }}
                      aria-label={name}
                    />
                    {taken && (
                      <span className="pointer-events-none absolute -right-1 -top-1 text-sm">
                        🔒
                      </span>
                    )}
                    {locked && (
                      <span className="pointer-events-none absolute -right-1 -top-1 text-sm">
                        ✅
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview of draft selection */}
          {!isMyLocked && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl"
                style={{ borderColor: draftColor, backgroundColor: `${draftColor}22` }}
              >
                {draftAvatar}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-200">
                  {myPlayer?.user_name ?? (isHe ? "אתה/את" : "You")}
                </div>
                <div className="text-xs text-slate-400">
                  {isHe ? "בחירה נוכחית" : "Current selection"}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {lockError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300">
              ⚠️ {lockError}
            </div>
          )}

          {/* Lock-in button */}
          {!isMyLocked && (
            <button
              type="button"
              disabled={isLocking}
              onClick={() => void handleLockIn()}
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition",
                "bg-gradient-to-r from-cyan-500 to-blue-600",
                "hover:brightness-110 active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isLocking
                ? isHe ? "נועל…" : "Locking…"
                : isHe ? "🔒 נעל בחירה" : "🔒 Lock in choice"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
