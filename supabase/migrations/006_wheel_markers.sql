-- Wheel divider width + marker configuration (per game)

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS divider_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS divider_width integer NOT NULL DEFAULT 2;

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS marker_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill from previous columns when present
UPDATE public.wheel_configs
SET divider_enabled = COALESCE(divider_enabled, show_divider, true)
WHERE divider_enabled IS NULL;

