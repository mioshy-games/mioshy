"use client";

import { useEffect, useRef } from "react";
import { metaTrack } from "@/lib/analytics/meta-pixel";

/**
 * Fires a Meta `ViewContent` once on mount for a product page. Renders nothing.
 * No-op without the pixel (dev / DNT / missing env).
 *
 * Privacy (§6): for the adults pillar pass a NEUTRAL `contentName` (the slug,
 * never the explicit title) so a view can't expose what the user is looking at.
 */
export function MetaViewContent({
  contentIds,
  contentName,
  contentCategory,
  contentType = "product",
}: {
  contentIds: string[];
  contentName: string;
  contentCategory: "games" | "journey" | "adults";
  contentType?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    metaTrack("ViewContent", {
      content_ids: contentIds,
      content_name: contentName,
      content_category: contentCategory,
      content_type: contentType,
    });
  }, [contentIds, contentName, contentCategory, contentType]);
  return null;
}
