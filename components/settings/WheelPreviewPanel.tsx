"use client";

/**
 * WheelPreviewPanel - standalone wheel preview for the sticky sidebar.
 *
 * Reads from useWheelFormStore (populated by WheelFormSync inside the form
 * AND by AppearanceTab's useEffect bridge) so it can safely live outside the
 * FormProvider tree (e.g. in InlineSettingsEditor's sticky right column).
 */

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WheelPreview } from "@/components/dashboard/WheelPreview";
import { useWheelFormStore } from "@/lib/store/useWheelFormStore";

export function WheelPreviewPanel() {
  const [labelLang, setLabelLang] = useState<"he" | "en">("he");

  const {
    slices,
    borderColor,
    pointerColor,
    pointerOffsetY,
    pointerSvg,
    pointerSvgWidth,
    pointerSvgHeight,
    innerCircle,
    innerCircleColor,
    innerCircleBorderColor,
    dividerEnabled,
    dividerColor,
    dividerWidth,
    markerConfig,
    labelFontSizePx,
    labelColor,
    labelOutline,
    outerBorder,
  } = useWheelFormStore();

  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-4 border-t border-border">
      {/* Header row */}
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Wheel slices
        </span>
        <Tabs
          value={labelLang}
          onValueChange={(v) => setLabelLang(v as "he" | "en")}
        >
          <TabsList className="h-6 px-0.5">
            <TabsTrigger value="he" className="text-[11px] px-2 h-5">HE</TabsTrigger>
            <TabsTrigger value="en" className="text-[11px] px-2 h-5">EN</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Wheel SVG */}
      <WheelPreview
        slices={slices}
        pointerColor={pointerColor}
        pointerOffsetY={pointerOffsetY}
        borderColor={borderColor}
        innerCircle={innerCircle}
        innerCircleColor={innerCircleColor}
        innerCircleBorderColor={innerCircleBorderColor}
        dividerEnabled={dividerEnabled}
        dividerColor={dividerColor}
        dividerWidth={dividerWidth}
        markerConfig={markerConfig}
        labelLang={labelLang}
        labelFontSizePx={labelFontSizePx}
        labelColor={labelColor}
        labelOutline={labelOutline}
        outerBorder={outerBorder}
        pointerSvg={pointerSvg}
        pointerSvgWidth={pointerSvgWidth}
        pointerSvgHeight={pointerSvgHeight}
      />

      {/* Metadata */}
      {slices.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center">
          {slices.length} slice{slices.length !== 1 ? "s" : ""} · divider{" "}
          {dividerEnabled ? "on" : "off"}
        </p>
      )}
    </div>
  );
}
