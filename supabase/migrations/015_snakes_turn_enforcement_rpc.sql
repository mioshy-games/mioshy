-- Enforce "only current player can write" for snakes game_state updates

CREATE OR REPLACE FUNCTION public.update_snakes_room_state(
  room_id uuid,
  actor_player_id uuid,
  new_game_state jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  actor public.game_players%ROWTYPE;
  room public.game_rooms%ROWTYPE;
  idx int;
  current_pid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO room FROM public.game_rooms WHERE id = room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room not found';
  END IF;

  SELECT * INTO actor FROM public.game_players WHERE id = actor_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player not found';
  END IF;
  IF actor.room_id <> room_id THEN
    RAISE EXCEPTION 'player not in room';
  END IF;
  IF actor.user_id IS NULL OR actor.user_id <> uid THEN
    RAISE EXCEPTION 'not your player';
  END IF;

  idx := COALESCE(NULLIF((room.game_state->>'currentPlayerIndex')::int, NULL), 0);

  SELECT gp.id INTO current_pid
  FROM public.game_players gp
  WHERE gp.room_id = room_id
  ORDER BY gp.order_index ASC, gp.created_at ASC
  OFFSET idx
  LIMIT 1;

  IF current_pid IS NULL THEN
    RAISE EXCEPTION 'no current player';
  END IF;
  IF current_pid <> actor_player_id THEN
    RAISE EXCEPTION 'not your turn';
  END IF;

  UPDATE public.game_rooms
  SET game_state = new_game_state
  WHERE id = room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_snakes_room_state(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_snakes_room_state(uuid, uuid, jsonb) TO authenticated;

