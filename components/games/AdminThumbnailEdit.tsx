"use client";

import { useState, useRef } from "react";
import { Camera, Check, X } from "lucide-react";
import { updateGameThumbnailAction } from "@/app/actions/game-thumbnail";

/**
 * Floating camera-icon overlay shown on catalogue cards for admin users.
 * Visible only on hover (parent card must have `group` class).
 * Shows a small popover with a URL input on click.
 */
export function AdminThumbnailEdit({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setSaved(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpen(false);
    setUrl("");
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    try {
      await updateGameThumbnailAction(gameId, url);
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setUrl("");
        setSaved(false);
      }, 800);
    } catch {
      // Error is surfaced via the UI staying open
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Camera button - appears on card hover */}
      <button
        type="button"
        onClick={handleOpen}
        className="absolute end-2 top-2 z-20 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 hover:bg-black/80"
        title="Change thumbnail"
      >
        <Camera className="h-4 w-4" />
      </button>

      {/* URL-input popover */}
      {open && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.preventDefault()}
        >
          <div className="w-[240px] rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl">
            <p className="mb-2 text-xs font-semibold text-slate-300">
              Image URL
            </p>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave(e as unknown as React.MouseEvent);
                if (e.key === "Escape") handleClose();
              }}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !url.trim()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50 hover:bg-violet-500"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : saving ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
