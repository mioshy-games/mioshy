"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GamePlayer, GameRoom, GameState, PlayerInfo } from "@/lib/snakes/types";

type GameType = "wheel" | "snakes";

function normalizeRoomCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function generateUniqueRoomCode() {
  const supabase = createBrowserSupabaseClient();
  for (let i = 0; i < 12; i++) {
    const code = randomRoomCode();
    const { data, error } = await supabase
      .from("game_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error) continue;
    if (!data) return code;
  }
  // fallback: last try without pre-check (unique constraint protects us)
  return randomRoomCode();
}

export interface UseGameRoom {
  room: GameRoom | null;
  players: GamePlayer[];
  isHost: boolean;
  myPlayerId: string | null;
  createRoom: (gameType: GameType, playerInfo: PlayerInfo) => Promise<string>; // roomCode
  joinRoom: (code: string, playerInfo: PlayerInfo) => Promise<boolean>;
  startGame: (initialState: GameState, configSnapshot: Record<string, unknown>) => Promise<void>;
  updateGameState: (patch: Partial<GameState>) => Promise<void>;
  leaveRoom: () => Promise<void>;
  transferHostIfNeeded: () => Promise<void>;
  setRoomByCode: (code: string) => Promise<void>;
  error: string | null;
}

export function useGameRoom(initialRoomCode?: string): UseGameRoom {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHost = useMemo(() => {
    if (!room || !myPlayerId) return false;
    const me = players.find((p) => p.id === myPlayerId);
    return Boolean(me?.is_host);
  }, [players, myPlayerId, room]);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [supabase]);

  const refetch = useCallback(
    async (roomId: string) => {
      const [{ data: roomRow }, { data: playersRows }] = await Promise.all([
        supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase
          .from("game_players")
          .select("*")
          .eq("room_id", roomId)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (roomRow) setRoom(roomRow as unknown as GameRoom);
      setPlayers((playersRows ?? []) as unknown as GamePlayer[]);
    },
    [supabase],
  );

  const subscribe = useCallback(
    async (roomId: string) => {
      cleanupChannel();
      const ch = supabase.channel(`room:${roomId}`);
      channelRef.current = ch;

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRoom(null);
            setPlayers([]);
            return;
          }
          const next = payload.new as unknown as GameRoom;
          setRoom(next);
        },
      );

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `room_id=eq.${roomId}` },
        async () => {
          await refetch(roomId);
        },
      );

      await ch.subscribe();

      // Fallback polling in case Realtime isn't delivering events in this environment.
      await refetch(roomId);
      pollRef.current = setInterval(() => {
        void refetch(roomId);
      }, 2000);
    },
    [cleanupChannel, refetch, supabase],
  );

  const loadRoomByCode = useCallback(
    async (codeRaw: string) => {
      setError(null);
      const code = normalizeRoomCode(codeRaw);
      if (code.length !== 4) {
        setError("קוד חדר לא תקין");
        return;
      }
      const { data: roomRow, error: roomErr } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (roomErr || !roomRow) {
        setError("החדר לא נמצא");
        return;
      }
      const r = roomRow as unknown as GameRoom;
      setRoom(r);

      const { data: playersRows } = await supabase
        .from("game_players")
        .select("*")
        .eq("room_id", r.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      setPlayers((playersRows ?? []) as unknown as GamePlayer[]);

      await subscribe(r.id);
    },
    [subscribe, supabase],
  );

  const setRoomByCode = useCallback(
    async (code: string) => {
      await loadRoomByCode(code);
    },
    [loadRoomByCode],
  );

  const createRoom = useCallback(
    async (gameType: GameType, playerInfo: PlayerInfo) => {
      setError(null);
      const code = await generateUniqueRoomCode();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("יש להתחבר כדי ליצור חדר");
        throw new Error("not_authenticated");
      }

      const { data: inserted, error: insErr } = await supabase
        .from("game_rooms")
        .insert({
          code,
          game_type: gameType,
          status: "lobby",
          host_id: user.id,
        })
        .select("*")
        .single();
      if (insErr || !inserted) {
        setError("יצירת חדר נכשלה");
        throw insErr ?? new Error("create_room_failed");
      }

      const r = inserted as unknown as GameRoom;
      setRoom(r);

      const { data: player, error: pErr } = await supabase
        .from("game_players")
        .insert({
          room_id: r.id,
          user_id: user.id,
          user_name: playerInfo.userName,
          avatar: playerInfo.avatar,
          color: playerInfo.color,
          order_index: 0,
          is_host: true,
          position: 1,
        })
        .select("*")
        .single();
      if (pErr || !player) {
        setError("יצירת שחקן נכשלה");
        throw pErr ?? new Error("create_player_failed");
      }
      const me = player as unknown as GamePlayer;
      setMyPlayerId(me.id);

      const { data: playersRows } = await supabase
        .from("game_players")
        .select("*")
        .eq("room_id", r.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      setPlayers((playersRows ?? []) as unknown as GamePlayer[]);

      await subscribe(r.id);
      return code;
    },
    [subscribe, supabase],
  );

  const joinRoom = useCallback(
    async (codeRaw: string, playerInfo: PlayerInfo) => {
      setError(null);
      const code = normalizeRoomCode(codeRaw);
      const { data: roomRow } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (!roomRow) {
        setError("החדר לא נמצא");
        return false;
      }
      const r = roomRow as unknown as GameRoom;
      setRoom(r);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("יש להתחבר כדי להצטרף לחדר");
        return false;
      }

      const { data: existing } = await supabase
        .from("game_players")
        .select("id")
        .eq("room_id", r.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        setMyPlayerId(existing.id as string);
      } else {
        const { count } = await supabase
          .from("game_players")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id);
        const nextOrder = Number(count ?? 0);

        const { data: inserted, error: insErr } = await supabase
          .from("game_players")
          .insert({
            room_id: r.id,
            user_id: user.id,
            user_name: playerInfo.userName,
            avatar: playerInfo.avatar,
            color: playerInfo.color,
            order_index: nextOrder,
            is_host: false,
            position: 1,
          })
          .select("*")
          .single();
        if (insErr || !inserted) {
          setError("הצטרפות לחדר נכשלה");
          throw insErr ?? new Error("join_failed");
        }
        setMyPlayerId((inserted as unknown as GamePlayer).id);
      }

      const { data: playersRows } = await supabase
        .from("game_players")
        .select("*")
        .eq("room_id", r.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      setPlayers((playersRows ?? []) as unknown as GamePlayer[]);

      await subscribe(r.id);
      return true;
    },
    [subscribe, supabase],
  );

  const startGame = useCallback(
    async (initialState: GameState, configSnapshot: Record<string, unknown>) => {
      if (!room) throw new Error("no_room");
      const { error: upErr } = await supabase
        .from("game_rooms")
        .update({
          status: "playing",
          game_state: initialState as unknown as Record<string, unknown>,
          config: configSnapshot,
        })
        .eq("id", room.id);
      if (upErr) {
        setError("לא ניתן להתחיל משחק");
        throw upErr;
      }
    },
    [room, supabase],
  );

  const updateGameState = useCallback(
    async (patch: Partial<GameState>) => {
      if (!room) return;
      if (!myPlayerId) {
        setError("חסר שחקן פעיל");
        throw new Error("missing_player");
      }
      const next = { ...(room.game_state as unknown as GameState), ...patch };
      const { error: upErr } = await supabase.rpc("update_snakes_room_state", {
        room_id: room.id,
        actor_player_id: myPlayerId,
        new_game_state: next as unknown as Record<string, unknown>,
      });
      if (upErr) {
        setError(upErr.message || "עדכון משחק נכשל");
        throw upErr;
      }
    },
    [myPlayerId, room, supabase],
  );

  const leaveRoom = useCallback(async () => {
    if (!room || !myPlayerId) return;
    setError(null);
    cleanupChannel();
    await supabase.from("game_players").delete().eq("id", myPlayerId);
    setMyPlayerId(null);
    setRoom(null);
    setPlayers([]);
  }, [cleanupChannel, myPlayerId, room, supabase]);

  const transferHostIfNeeded = useCallback(async () => {
    if (!room) return;
    if (room.host_id) return;
    // If host_id is null (or host left), promote the first player as host.
    const first = players[0];
    if (!first) return;
    const { error: e1 } = await supabase
      .from("game_players")
      .update({ is_host: true })
      .eq("id", first.id);
    if (e1) return;
    // best-effort: keep host_id aligned with promoted player user_id
    if (first.user_id) {
      await supabase.from("game_rooms").update({ host_id: first.user_id }).eq("id", room.id);
    }
  }, [players, room, supabase]);

  useEffect(() => {
    if (initialRoomCode) void loadRoomByCode(initialRoomCode);
    return () => cleanupChannel();
  }, [cleanupChannel, initialRoomCode, loadRoomByCode]);

  return {
    room,
    players,
    isHost,
    myPlayerId,
    createRoom,
    joinRoom,
    startGame,
    updateGameState,
    leaveRoom,
    transferHostIfNeeded,
    setRoomByCode,
    error,
  };
}

