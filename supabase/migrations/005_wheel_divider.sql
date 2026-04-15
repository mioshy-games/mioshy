-- Per-game wheel slice divider configuration

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS show_divider boolean NOT NULL DEFAULT true;

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS divider_color text NOT NULL DEFAULT '#ffffff';

