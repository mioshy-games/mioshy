"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { updateGameThumbnailAction } from "@/app/actions/game-thumbnail";

/**
 * Floating camera-icon overlay shown on catalogue cards for admin users.
 * Visible only on hover (parent card must have `group` class).
 *
 * Per Itzik 2026-05-06: catalogue thumbnails are per-locale because each
 * card carries baked-in copy. The popover therefore has TWO URL fields -
 * one for HE, one for EN - pre-filled with whatever's currently saved so
 * the admin can edit either independently. Saving sends both fields; the
 * server action only writes keys that actually changed (empty string
 * clears that locale).
 */
export function AdminThumbnailEdit({
  gameId,
  initialHe,
  initialEn,
}: {
  gameId: string;
  initialHe?: string | null;
  initialEn?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [urlHe, setUrlHe] = useState("");
  const [urlEn, setUrlEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const heInputRef = useRef<HTMLInputElement>(null);

  // Keep the inputs in sync if the admin re-opens the popover after the
  // page revalidated with new data.
  useEffect(() => {
    if (!open) return;
    setUrlHe(initialHe ?? "");
    setUrlEn(initialEn ?? "");
    setSaved(false);
    setTimeout(() => heInputRef.current?.focus(), 50);
  }, [open, initialHe, initialEn]);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpen(false);
    setUrlHe("");
    setUrlEn("");
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    try {
      // Send both keys explicitly so the action can clear a slot when
      // the admin deletes a URL (empty string → null in Postgres).
      await updateGameThumbnailAction(gameId, {
        he: urlHe,
        en: urlEn,
      });
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 800);
    } catch {
      // Error is surfaced via the UI staying open
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    (urlHe ?? "") !== (initialHe ?? "") ||
    (urlEn ?? "") !== (initialEn ?? "");

  return (
    <>
      {/* Camera button - appears on card hover */}
      <button
        type="button"
        onClick={handleOpen}
        className="absolute end-2 top-2 z-20 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 hover:bg-black/80"
        title="Change thumbnails"
      >
        <Camera className="h-4 w-4" />
      </button>

      {/* URL-input popover */}
      {open && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.preventDefault()}
        >
          <div className="w-[280px] rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Per-locale thumbnails
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  HE URL
                </label>
                <input
                  ref={heInputRef}
                  value={urlHe}
                  onChange={(e) => setUrlHe(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleClose();
                  }}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  EN URL
                </label>
                <input
                  value={urlEn}
                  onChange={(e) => setUrlEn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleClose();
                    if (e.key === "Enter") {
                      handleSave(e as unknown as React.MouseEvent);
                    }
                  }}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50 hover:bg-violet-500"
              >
                {saved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : saving ? (
                  "..."
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Empty either field to clear that locale (the other one becomes
              the fallback for both).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
