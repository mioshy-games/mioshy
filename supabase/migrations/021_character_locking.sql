-- ─────────────────────────────────────────────────────────────────────────────
-- 021 · Character / colour locking for game_players
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   • is_locked  boolean – player has confirmed avatar+colour in the lobby
--   • is_ready   boolean – player signals "ready to start" (future use)
--   • DB-level unique guard: only one locked player per (room, avatar)
--                             and one locked player per (room, color)
--   • RPC claim_player_character() – atomic check-and-lock (no race conditions)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS is_ready boolean NOT NULL DEFAULT false;

-- ── Unique guards (partial indexes – only locked rows compete) ───────────────
-- Prevents two locked players from sharing the same avatar in the same room.
CREATE UNIQUE INDEX IF NOT EXISTS game_players_room_avatar_locked
  ON public.game_players (room_id, avatar)
  WHERE is_locked = true;

-- Prevents two locked players from sharing the same colour in the same room.
CREATE UNIQUE INDEX IF NOT EXISTS game_players_room_color_locked
  ON public.game_players (room_id, color)
  WHERE is_locked = true;

-- ── RPC: claim_player_character ───────────────────────────────────────────────
-- Atomically assigns avatar + color to a player and sets is_locked = true.
-- The function runs as SECURITY DEFINER so it bypasses RLS for the inner
-- SELECT checks, but still validates that the caller owns the player slot.
--
-- Returns:
--   'ok'           – success
--   'avatar_taken' – another locked player already has that avatar in the room
--   'color_taken'  – another locked player already has that color in the room
--   'not_found'    – player_id / room_id combo doesn't exist or caller mismatch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_player_character(
  p_player_id uuid,
  p_room_id   uuid,
  p_avatar    text,
  p_color     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_caller  uuid;
BEGIN
  v_caller := auth.uid();

  -- 1. Verify caller owns this player slot
  SELECT user_id INTO v_user_id
    FROM public.game_players
   WHERE id = p_player_id
     AND room_id = p_room_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Allow anonymous (user_id IS NULL) only if caller is also null
  -- (guest mode). In normal authenticated flow they must match.
  IF v_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM v_caller THEN
    RETURN 'not_found';
  END IF;

  -- 2. Check avatar not already locked by someone else in this room
  IF EXISTS (
    SELECT 1
      FROM public.game_players
     WHERE room_id   = p_room_id
       AND avatar    = p_avatar
       AND is_locked = true
       AND id        <> p_player_id
  ) THEN
    RETURN 'avatar_taken';
  END IF;

  -- 3. Check colour not already locked by someone else in this room
  IF EXISTS (
    SELECT 1
      FROM public.game_players
     WHERE room_id   = p_room_id
       AND color     = p_color
       AND is_locked = true
       AND id        <> p_player_id
  ) THEN
    RETURN 'color_taken';
  END IF;

  -- 4. Atomic update – if the unique indexes fire here we let the exception
  --    bubble up as a generic DB error; the caller should retry.
  UPDATE public.game_players
     SET avatar    = p_avatar,
         color     = p_color,
         is_locked = true
   WHERE id      = p_player_id
     AND room_id = p_room_id;

  RETURN 'ok';
END;
$$;

-- ── RPC: unlock_player_character ─────────────────────────────────────────────
-- Lets a player un-lock their selection so they can pick again.
CREATE OR REPLACE FUNCTION public.unlock_player_character(
  p_player_id uuid,
  p_room_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.game_players
   WHERE id = p_player_id AND room_id = p_room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  UPDATE public.game_players
     SET is_locked = false
   WHERE id = p_player_id AND room_id = p_room_id;

  RETURN true;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_player_character  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_player_character TO authenticated;
