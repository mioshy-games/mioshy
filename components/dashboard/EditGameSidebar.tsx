"use client";

/**
 * EditGameSidebar — page-level sticky preview column for the Edit Game page.
 *
 * Renders both the appearance LivePreview (fed by useSettingsStore) and the
 * wheel slices preview (fed by useWheelFormStore via WheelFormSync inside the
 * GameForm tree). Because it lives at the PAGE layout level (not inside
 * InlineSettingsEditor anymore), it stays visible as the admin scrolls through
 * every section of the form — game details, slices, questions, SEO, etc.
 *
 * The sidebar is collapsible on wider screens so admins can reclaim horizontal
 * space when editing long tables (questions list). It hides entirely below the
 * `xl` breakpoint to avoid crowding the form on laptops / tablets.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LivePreview } from "@/components/settings/LivePreview";
import { WheelPreviewPanel } from "@/components/settings/WheelPreviewPanel";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EditGameSidebar() {
  const draftSettings = useSettingsStore((s) => s.draftSettings);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        // Sticky column — anchors to the admin main top padding (~1rem) so the
        // preview stays pinned while the form scrolls underneath it.
        "hidden xl:flex xl:flex-col sticky top-4 self-start",
        "max-h-[calc(100vh-2rem)] overflow-y-auto",
        "rounded-2xl border border-border bg-background/70 backdrop-blur",
        "transition-[width] duration-200",
        collapsed ? "w-10" : "w-72",
      )}
      aria-label="Live preview sidebar"
    >
      {/* Collapse toggle — single button, swaps icon when collapsed */}
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1.5">
            Preview
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand preview" : "Collapse preview"}
        >
          {collapsed ? (
            <ChevronLeft className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div className="p-4">
            <LivePreview settings={draftSettings} />
          </div>
          <WheelPreviewPanel />
        </div>
      )}
    </aside>
  );
}
