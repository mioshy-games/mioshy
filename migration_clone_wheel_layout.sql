-- =====================================================================
-- MIGRATION: Clone wheel LAYOUT (sizes & positions) from canonical
--            to two target wheels - preserving each target's
--            colors and text labels.
-- =====================================================================
-- Canonical (source of layout):
--   game_id = d45883a5-38c4-4760-91a7-7589b6246dbc
--
-- Targets (will be updated):
--   game_id = 1cafc28f-b5b9-4b41-a59d-9bb20ea162a8
--   game_id = 886a3507-7bc7-4f3e-9756-05b75c59e701
--
-- COPIED from canonical:
--   inner_circle (bool)
--   divider_enabled (bool)
--   divider_width (int)
--   slices: count, order, id, question_type
--   marker_config: marker_type, marker_size, marker_count, marker_position
--   player_config: desired_total_slices, player_repetitions
--   player_config.categories: id, key (structural)
--
-- PRESERVED in each target (NOT touched):
--   pointer_color, inner_circle_color, inner_circle_border_color,
--   border_color, divider_color, category_colors
--   slices[].color, slices[].label_he, slices[].label_en
--   marker_config.marker_color
--   player_config.categories[].color, label_he, label_en
--
-- SAFETY:
--   - Single transaction. ROLLBACK if anything fails.
--   - Take a Supabase snapshot before running on prod.
--   - Run on staging first.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_canonical_game_id uuid := 'd45883a5-38c4-4760-91a7-7589b6246dbc'::uuid;
  v_target_ids uuid[] := ARRAY[
    '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8'::uuid,
    '886a3507-7bc7-4f3e-9756-05b75c59e701'::uuid
  ];

  -- Canonical layout fields
  v_c_inner_circle    boolean;
  v_c_divider_enabled boolean;
  v_c_divider_width   int;
  v_c_slices          jsonb;
  v_c_marker_config   jsonb;
  v_c_player_config   jsonb;

  -- Per-target working variables
  v_target_id   uuid;
  v_t_slices    jsonb;
  v_t_marker    jsonb;
  v_t_player    jsonb;

  v_new_slices       jsonb;
  v_new_marker       jsonb;
  v_new_player       jsonb;
  v_new_categories   jsonb;

  v_canon_slice  jsonb;
  v_target_slice jsonb;
  v_canon_cat    jsonb;
  v_target_cat   jsonb;
  v_idx          int;
BEGIN
  -- ============== 1. LOAD CANONICAL ==============
  SELECT inner_circle, divider_enabled, divider_width,
         slices, marker_config, player_config
    INTO v_c_inner_circle, v_c_divider_enabled, v_c_divider_width,
         v_c_slices, v_c_marker_config, v_c_player_config
    FROM public.wheel_configs
   WHERE game_id = v_canonical_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canonical wheel_config not found for game_id %',
                    v_canonical_game_id;
  END IF;

  RAISE NOTICE '== Canonical loaded: % slices, % categories, divider_width=%',
               jsonb_array_length(v_c_slices),
               jsonb_array_length(v_c_player_config -> 'categories'),
               v_c_divider_width;

  -- ============== 2. APPLY TO EACH TARGET ==============
  FOREACH v_target_id IN ARRAY v_target_ids LOOP

    -- Load target's existing config (only the JSONB fields we need to merge)
    SELECT slices, marker_config, player_config
      INTO v_t_slices, v_t_marker, v_t_player
      FROM public.wheel_configs
     WHERE game_id = v_target_id;

    IF NOT FOUND THEN
      RAISE WARNING 'Target wheel_config NOT FOUND for game_id % - skipping',
                    v_target_id;
      CONTINUE;
    END IF;

    -- ---------- 2a. Build new slices ----------
    -- For each canonical slice (in order), inherit canonical's id +
    -- question_type, but pull the color & labels from a matching target
    -- slice (matched by index first, then by question_type as fallback).
    v_new_slices := '[]'::jsonb;
    v_idx := 0;

    FOR v_canon_slice IN SELECT * FROM jsonb_array_elements(v_c_slices) LOOP
      -- Try same index in target
      v_target_slice := v_t_slices -> v_idx;

      -- If no match by index OR question_type differs, search by question_type
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
          'color',         COALESCE(v_target_slice ->> 'color',
                                    v_canon_slice  ->> 'color'),
          'label_he',      COALESCE(v_target_slice ->> 'label_he',
                                    v_canon_slice  ->> 'label_he'),
          'label_en',      COALESCE(v_target_slice ->> 'label_en',
                                    v_canon_slice  ->> 'label_en')
        )
      );

      v_idx := v_idx + 1;
    END LOOP;

    -- ---------- 2b. Build new marker_config ----------
    -- Layout fields from canonical, color preserved from target.
    v_new_marker := jsonb_build_object(
      'marker_type',     v_c_marker_config ->> 'marker_type',
      'marker_size',     (v_c_marker_config ->> 'marker_size')::int,
      'marker_count',    (v_c_marker_config ->> 'marker_count')::int,
      'marker_position', (v_c_marker_config ->> 'marker_position')::int,
      'marker_color',    COALESCE(v_t_marker  ->> 'marker_color',
                                  v_c_marker_config ->> 'marker_color')
    );

    -- ---------- 2c. Build new player_config ----------
    -- Structure (slice count, repetitions, category keys) from canonical.
    -- Per-category color & labels preserved from target (matched by key).
    v_new_categories := '[]'::jsonb;

    FOR v_canon_cat IN
      SELECT * FROM jsonb_array_elements(v_c_player_config -> 'categories')
    LOOP
      SELECT c INTO v_target_cat
        FROM jsonb_array_elements(v_t_player -> 'categories') c
       WHERE c ->> 'key' = v_canon_cat ->> 'key'
       LIMIT 1;

      v_new_categories := v_new_categories || jsonb_build_array(
        jsonb_build_object(
          'id',       v_canon_cat ->> 'id',
          'key',      v_canon_cat ->> 'key',
          'color',    COALESCE(v_target_cat ->> 'color',
                               v_canon_cat  ->> 'color'),
          'label_he', COALESCE(v_target_cat ->> 'label_he',
                               v_canon_cat  ->> 'label_he'),
          'label_en', COALESCE(v_target_cat ->> 'label_en',
                               v_canon_cat  ->> 'label_en')
        )
      );
    END LOOP;

    v_new_player := jsonb_build_object(
      'desired_total_slices',
        (v_c_player_config ->> 'desired_total_slices')::int,
      'player_repetitions',
        (v_c_player_config ->> 'player_repetitions')::int,
      'categories', v_new_categories
    );

    -- ---------- 2d. APPLY UPDATE ----------
    -- Note: pointer_color, inner_circle_color, inner_circle_border_color,
    -- border_color, divider_color, category_colors are NOT in this UPDATE,
    -- so they remain untouched in the target row.
    UPDATE public.wheel_configs
       SET inner_circle    = v_c_inner_circle,
           divider_enabled = v_c_divider_enabled,
           divider_width   = v_c_divider_width,
           slices          = v_new_slices,
           marker_config   = v_new_marker,
           player_config   = v_new_player
     WHERE game_id = v_target_id;

    RAISE NOTICE 'Updated target %: % slices, % categories, divider_width=%',
                 v_target_id,
                 jsonb_array_length(v_new_slices),
                 jsonb_array_length(v_new_categories),
                 v_c_divider_width;

  END LOOP;
END $$;

-- ============== 3. VERIFY ==============
SELECT game_id,
       jsonb_array_length(slices)                          AS slice_count,
       jsonb_array_length(player_config -> 'categories')   AS cat_count,
       divider_width,
       inner_circle,
       divider_enabled,
       marker_config ->> 'marker_size'   AS marker_size,
       marker_config ->> 'marker_count'  AS marker_count,
       player_config ->> 'desired_total_slices' AS desired_total
  FROM public.wheel_configs
 WHERE game_id IN (
   'd45883a5-38c4-4760-91a7-7589b6246dbc',
   '1cafc28f-b5b9-4b41-a59d-9bb20ea162a8',
   '886a3507-7bc7-4f3e-9756-05b75c59e701'
 )
 ORDER BY game_id;

-- All numbers above should match between canonical and the two targets.
-- If they do - COMMIT. If anything looks off - replace COMMIT with ROLLBACK.

COMMIT;
