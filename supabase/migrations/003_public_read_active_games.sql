-- Allow public read of active games and their wheel configs (for public gameplay pages)

-- games: public read only active rows
DROP POLICY IF EXISTS "games_select_active" ON public.games;
CREATE POLICY "games_select_active"
  ON public.games FOR SELECT
  USING (is_active = true);

-- wheel_configs: public read only for active games
DROP POLICY IF EXISTS "wheel_configs_select_for_active_game" ON public.wheel_configs;
CREATE POLICY "wheel_configs_select_for_active_game"
  ON public.wheel_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.games g
      WHERE g.id = wheel_configs.game_id
        AND g.is_active = true
    )
  );

