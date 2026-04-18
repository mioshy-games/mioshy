-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 – Add wheel defaults to global_settings.default_settings
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the singleton row has wheel defaults, without overriding existing values.
update public.global_settings
set default_settings =
  jsonb_set(
    jsonb_set(
      default_settings,
      '{wheel}',
      coalesce(default_settings->'wheel', '{}'::jsonb),
      true
    ),
    '{wheel}',
    (coalesce(default_settings->'wheel', '{}'::jsonb)
      || jsonb_build_object(
        'sizeRem', coalesce((default_settings->'wheel'->>'sizeRem')::numeric, 22),
        'labelRadiusFraction', coalesce((default_settings->'wheel'->>'labelRadiusFraction')::numeric, 0.72),
        'centerShadow', coalesce(default_settings->'wheel'->'centerShadow', jsonb_build_object(
          'enabled', false,
          'color', '#000000',
          'opacity', 0.35,
          'blur', 4,
          'offsetX', 0,
          'offsetY', 2
        )),
        'dividerShadow', coalesce(default_settings->'wheel'->'dividerShadow', jsonb_build_object(
          'enabled', false,
          'color', '#000000',
          'opacity', 0.25,
          'blur', 2
        )),
        'labelFontSizePx', coalesce((default_settings->'wheel'->>'labelFontSizePx')::numeric, 12),
        'labelOutline', coalesce(default_settings->'wheel'->'labelOutline', jsonb_build_object(
          'enabled', true,
          'color', '#000000',
          'opacity', 0.25,
          'width', 2
        ))
      )
    ),
    true
  )
where id = 1;

