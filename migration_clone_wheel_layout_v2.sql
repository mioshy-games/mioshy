-- =====================================================================
-- MIGRATION v2: Clone FULL wheel layout (sizes/positions/border/spin)
--               from canonical to two targets - preserving colors+text.
-- =====================================================================
-- This SUPERSEDES migration_clone_wheel_layout.sql (v1 only touched
-- wheel_configs and missed the game_settings table where border width,
-- pointer style, spin speed, inner circle size, particles & shape live).
--
-- Touched tables:
--   public.wheel_configs   - slices/marker/divider structure
--   public.game_settings   - border, motion, shape, particles, wheel.*
--                            (size/shadow/outline structure, no colors)
--
-- Canonical (source of layout):
--   game_id = d45883a5-38c4-4760-91a7-7589b6246dbc
--
-- Targets:
--   game_id = 1cafc28f-b5b9-4b41-a59d-9bb20ea162a8
--   game_id = 886a3507-7bc7-4f3e-9756-05b75c59e701
--
-- Run: psql "$DATABASE_URL" -f migration_clone_wheel_layout_v2.sql
-- =====================================================================

BEGIN;

-- ============================================================
-- PART 1: wheel_configs (same as v1) - slices, marker, divider
-- ============================================================
DO $$
DECLARE
  v_canonical_game_id uuid := 'd45883a5-38c4-4760-91a7-7589b6246dbc'::uuid;
  v_target_ids uuid[] := ARRAY[
    '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8'::uuid,
    '886a3507-7bc7-4f3e-9756-05b75c59e701'::uuid
  ];

  v_c_inner_circle    boolean;
  v_c_divider_enabled boolean;
  v_c_divider_width   int;
  v_c_slices          jsonb;
  v_c_marker_config   jsonb;
  v_c_player_config   jsonb;

  v_target_id  uuid;
  v_t_slices   jsonb;
  v_t_marker   jsonb;
  v_t_player   jsonb;
  v_new_slices     jsonb;
  v_new_marker     jsonb;
  v_new_player     jsonb;
  v_new_categories jsonb;
  v_canon_slice  jsonb;
  v_target_slice jsonb;
  v_canon_cat    jsonb;
  v_target_cat   jsonb;
  v_idx int;
BEGIN
  SELECT inner_circle, divider_enabled, divider_width,
         slices, marker_config, player_config
    INTO v_c_inner_circle, v_c_divider_enabled, v_c_divider_width,
         v_c_slices, v_c_marker_config, v_c_player_config
    FROM public.wheel_configs WHERE game_id = v_canonical_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wheel_configs canonical missing for game_id %', v_canonical_game_id;
  END IF;

  FOREACH v_target_id IN ARRAY v_target_ids LOOP
    SELECT slices, marker_config, player_config
      INTO v_t_slices, v_t_marker, v_t_player
      FROM public.wheel_configs WHERE game_id = v_target_id;

    IF NOT FOUND THEN
      RAISE WARNING 'wheel_configs target % NOT FOUND - skipping', v_target_id;
      CONTINUE;
    END IF;

    -- Build slices: canonical structure + target colors/labels
    v_new_slices := '[]'::jsonb;
    v_idx := 0;
    FOR v_canon_slice IN SELECT * FROM jsonb_array_elements(v_c_slices) LOOP
      v_target_slice := v_t_slices -> v_idx;
      IF v_target_slice IS NULL
         OR (v_target_slice ->> 'question_type') IS DISTINCT FROM (v_canon_slice ->> 'question_type')
      THEN
        SELECT s INTO v_target_slice
          FROM jsonb_array_elements(v_t_slices) s
         WHERE s ->> 'question_type' = v_canon_slice ->> 'question_type'
         LIMIT 1;
      END IF;
      v_new_slices := v_new_slices || jsonb_build_array(
        jsonb_build_object(
          'id',            v_canon_slice ->> 'id',
          'question_type', v_canon_slice ->> 'question_type',
          'color',         COALESCE(v_target_slice ->> 'color',    v_canon_slice ->> 'color'),
          'label_he',      COALESCE(v_target_slice ->> 'label_he', v_canon_slice ->> 'label_he'),
          'label_en',      COALESCE(v_target_slice ->> 'label_en', v_canon_slice ->> 'label_en')
        )
      );
      v_idx := v_idx + 1;
    END LOOP;

    -- marker_config: structure from canonical, color from target
    v_new_marker := jsonb_build_object(
      'marker_type',     v_c_marker_config ->> 'marker_type',
      'marker_size',     (v_c_marker_config ->> 'marker_size')::int,
      'marker_count',    (v_c_marker_config ->> 'marker_count')::int,
      'marker_position', (v_c_marker_config ->> 'marker_position')::int,
      'marker_color',    COALESCE(v_t_marker ->> 'marker_color', v_c_marker_config ->> 'marker_color')
    );

    -- player_config: canonical structure + target category colors/labels
    v_new_categories := '[]'::jsonb;
    FOR v_canon_cat IN SELECT * FROM jsonb_array_elements(v_c_player_config -> 'categories') LOOP
      SELECT c INTO v_target_cat
        FROM jsonb_array_elements(v_t_player -> 'categories') c
       WHERE c ->> 'key' = v_canon_cat ->> 'key' LIMIT 1;
      v_new_categories := v_new_categories || jsonb_build_array(
        jsonb_build_object(
          'id',       v_canon_cat ->> 'id',
          'key',      v_canon_cat ->> 'key',
          'color',    COALESCE(v_target_cat ->> 'color',    v_canon_cat ->> 'color'),
          'label_he', COALESCE(v_target_cat ->> 'label_he', v_canon_cat ->> 'label_he'),
          'label_en', COALESCE(v_target_cat ->> 'label_en', v_canon_cat ->> 'label_en')
        )
      );
    END LOOP;
    v_new_player := jsonb_build_object(
      'desired_total_slices', (v_c_player_config ->> 'desired_total_slices')::int,
      'player_repetitions',   (v_c_player_config ->> 'player_repetitions')::int,
      'categories',           v_new_categories
    );

    UPDATE public.wheel_configs
       SET inner_circle    = v_c_inner_circle,
           divider_enabled = v_c_divider_enabled,
           divider_width   = v_c_divider_width,
           slices          = v_new_slices,
           marker_config   = v_new_marker,
           player_config   = v_new_player
     WHERE game_id = v_target_id;

    RAISE NOTICE '[wheel_configs] Updated %: % slices, % cats',
                 v_target_id, jsonb_array_length(v_new_slices),
                 jsonb_array_length(v_new_categories);
  END LOOP;
END $$;

-- ============================================================
-- PART 2: game_settings - border, motion, shape, particles,
--         wheel.* (size/shadow/outline/inner/divider/marker structure)
-- ============================================================
-- Strategy: take canonical's settings JSONB as the base, then surgically
-- preserve every COLOR path from the target's settings. Anything the
-- target has under a "color"-named key wins; everything else (structure,
-- sizes, positions, durations) comes from canonical.
DO $$
DECLARE
  v_canonical_game_id uuid := 'd45883a5-38c4-4760-91a7-7589b6246dbc'::uuid;
  v_target_ids uuid[] := ARRAY[
    '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8'::uuid,
    '886a3507-7bc7-4f3e-9756-05b75c59e701'::uuid
  ];

  v_c_settings jsonb;
  v_t_settings jsonb;
  v_new        jsonb;
  v_target_id  uuid;
BEGIN
  SELECT settings INTO v_c_settings
    FROM public.game_settings WHERE game_id = v_canonical_game_id;

  IF v_c_settings IS NULL THEN
    RAISE WARNING 'No game_settings row for canonical % - skipping PART 2',
                  v_canonical_game_id;
    RETURN;
  END IF;

  FOREACH v_target_id IN ARRAY v_target_ids LOOP
    SELECT settings INTO v_t_settings
      FROM public.game_settings WHERE game_id = v_target_id;

    -- Start from canonical (this gives us all sizes/structure/durations)
    v_new := v_c_settings;

    -- ===== Preserve target colors / theme paths =====
    -- (each line: only overwrites if target has a non-null value there)

    -- background: keep target's entire background block (color/gradient/image)
    IF v_t_settings -> 'background' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{background}', v_t_settings -> 'background', true);
    END IF;

    -- border.color (keep width/style/enabled/distance from canonical)
    IF v_t_settings #> '{border,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{border,color}', v_t_settings #> '{border,color}', true);
    END IF;

    -- wheel.pointerColor
    IF v_t_settings #> '{wheel,pointerColor}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,pointerColor}', v_t_settings #> '{wheel,pointerColor}', true);
    END IF;

    -- wheel.labelColor
    IF v_t_settings #> '{wheel,labelColor}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,labelColor}', v_t_settings #> '{wheel,labelColor}', true);
    END IF;

    -- wheel.labelOutline.color
    IF v_t_settings #> '{wheel,labelOutline,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,labelOutline,color}', v_t_settings #> '{wheel,labelOutline,color}', true);
    END IF;

    -- wheel.centerShadow.color
    IF v_t_settings #> '{wheel,centerShadow,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,centerShadow,color}', v_t_settings #> '{wheel,centerShadow,color}', true);
    END IF;

    -- wheel.dividerShadow.color
    IF v_t_settings #> '{wheel,dividerShadow,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,dividerShadow,color}', v_t_settings #> '{wheel,dividerShadow,color}', true);
    END IF;

    -- wheel.innerCircle.fillColor + borderColor (keep enabled from canonical)
    IF v_t_settings #> '{wheel,innerCircle,fillColor}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,innerCircle,fillColor}', v_t_settings #> '{wheel,innerCircle,fillColor}', true);
    END IF;
    IF v_t_settings #> '{wheel,innerCircle,borderColor}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,innerCircle,borderColor}', v_t_settings #> '{wheel,innerCircle,borderColor}', true);
    END IF;

    -- wheel.divider.color (keep enabled/width from canonical)
    IF v_t_settings #> '{wheel,divider,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,divider,color}', v_t_settings #> '{wheel,divider,color}', true);
    END IF;

    -- wheel.markers.color (keep type/size/count/position/svgPath from canonical)
    IF v_t_settings #> '{wheel,markers,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{wheel,markers,color}', v_t_settings #> '{wheel,markers,color}', true);
    END IF;

    -- particles.color (if present - particles structure inherits from canonical)
    IF v_t_settings #> '{particles,color}' IS NOT NULL THEN
      v_new := jsonb_set(v_new, '{particles,color}', v_t_settings #> '{particles,color}', true);
    END IF;

    -- ===== UPSERT into game_settings =====
    INSERT INTO public.game_settings (game_id, settings, updated_at)
    VALUES (v_target_id, v_new, now())
    ON CONFLICT (game_id) DO UPDATE
      SET settings   = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at;

    RAISE NOTICE '[game_settings] Updated %: border.width=%, pointer set=%, motion.spinSpeed=%',
                 v_target_id,
                 v_new #>> '{border,width}',
                 (v_new #>> '{wheel,pointerColor}') IS NOT NULL,
                 v_new #>> '{motion,spinSpeed}';
  END LOOP;
END $$;

-- ============================================================
-- PART 3: VERIFY (read-only, before COMMIT)
-- ============================================================
SELECT 'wheel_configs' AS src,
       wc.game_id,
       jsonb_array_length(wc.slices) AS slices,
       wc.divider_width,
       wc.marker_config ->> 'marker_size'  AS marker_size,
       wc.marker_config ->> 'marker_count' AS marker_count
  FROM public.wheel_configs wc
 WHERE wc.game_id IN (
   'd45883a5-38c4-4760-91a7-7589b6246dbc',
   '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8',
   '886a3507-7bc7-4f3e-9756-05b75c59e701'
 )
 ORDER BY wc.game_id;

SELECT 'game_settings' AS src,
       gs.game_id,
       gs.settings #>> '{border,width}'        AS border_width,
       gs.settings #>> '{border,style}'        AS border_style,
       gs.settings #>> '{border,distance}'     AS border_distance,
       gs.settings #>> '{motion,spinSpeed}'    AS spin_speed,
       gs.settings #>> '{shape,type}'          AS shape_type,
       gs.settings #>> '{wheel,sizeRem}'       AS size_rem,
       gs.settings #>> '{wheel,pointerOffsetY}' AS pointer_offset_y,
       gs.settings #>> '{wheel,markers,size}'  AS markers_size_in_settings
  FROM public.game_settings gs
 WHERE gs.game_id IN (
   'd45883a5-38c4-4760-91a7-7589b6246dbc',
   '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8',
   '886a3507-7bc7-4f3e-9756-05b75c59e701'
 )
 ORDER BY gs.game_id;

-- All numeric/structural columns should match across the 3 rows.
-- If they do - leave COMMIT. If something's off - change to ROLLBACK.
COMMIT;
