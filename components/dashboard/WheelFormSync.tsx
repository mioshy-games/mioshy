"use client";

/**
 * WheelFormSync - invisible bridge component.
 *
 * Render this INSIDE the RHF <FormProvider>. It watches all wheel-related
 * fields and syncs their values to useWheelFormStore so that WheelPreviewPanel
 * (which lives outside FormProvider, in the sticky sidebar) always reflects
 * the latest edits without needing access to the form context.
 */

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { GameFormValues } from "@/lib/validations";
import { useWheelFormStore } from "@/lib/store/useWheelFormStore";
import type { WheelSlice } from "@/lib/types/database";

export function WheelFormSync() {
  const { control } = useFormContext<GameFormValues>();
  const setWheelPreview = useWheelFormStore((s) => s.setWheelPreview);

  const slices        = useWatch({ control, name: "wheel.slices" }) as WheelSlice[] | undefined;
  const pointer       = useWatch({ control, name: "wheel.pointer_color" }) as string | undefined;
  const border        = useWatch({ control, name: "wheel.border_color" }) as string | undefined;
  const inner         = useWatch({ control, name: "wheel.inner_circle" }) as boolean | undefined;
  const innerColor    = useWatch({ control, name: "wheel.inner_circle_color" }) as string | undefined;
  const innerBorder   = useWatch({ control, name: "wheel.inner_circle_border_color" }) as string | undefined;
  const divEnabled    = useWatch({ control, name: "wheel.divider_enabled" }) as boolean | undefined;
  const divColor      = useWatch({ control, name: "wheel.divider_color" }) as string | undefined;
  const divWidth      = useWatch({ control, name: "wheel.divider_width" }) as number | undefined;
  const markerConfig  = useWatch({ control, name: "wheel.marker_config" }) as Record<string, unknown> | undefined;

  useEffect(() => {
    setWheelPreview({
      slices:                 slices ?? [],
      pointerColor:           pointer ?? "#ffffff",
      borderColor:            border ?? "#ffffff",
      innerCircle:            inner ?? true,
      innerCircleColor:       innerColor ?? "#fafafa",
      innerCircleBorderColor: innerBorder ?? "#e5e5e5",
      dividerEnabled:         divEnabled ?? true,
      dividerColor:           divColor ?? "#ffffff",
      dividerWidth:           divWidth ?? 2,
      markerConfig:           markerConfig ?? {},
    });
  }, [
    slices, pointer, border, inner, innerColor, innerBorder,
    divEnabled, divColor, divWidth, markerConfig, setWheelPreview,
  ]);

  // Renders nothing - pure side-effect component
  return null;
}
