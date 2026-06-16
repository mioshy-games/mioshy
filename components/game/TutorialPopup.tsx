"use client";

/**
 * TutorialPopup — first-visit "how it works" overlay for a game.
 * ──────────────────────────────────────────────────────────────────
 * Shows once per device on the first visit to a *given* game, then
 * never again automatically — but stays reopenable via a small
 * "instructions" button in the corner. Persistence is per-game under
 * the key `mioshy:tutorial-seen:<slug>` so a new game's rules still
 * surface to someone who already saw another game's tutorial.
 *
 * Content is per-game (migration 108): when the game row carries an
 * `instructions` jsonb for the active locale we render its
 * title / intro / steps / footer. When it doesn't, we fall back to the
 * generic three-step wheel tutorial from the CMS — so every existing
 * game keeps working unchanged.
 *
 * Created 2026-05-07 (Itzik #52). Per-game rewrite 2026-06-07.
 */

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  Sparkles,
  MousePointerClick,
  Eye,
  Heart,
  HelpCircle,
  X,
} from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";
import type { GameInstructions } from "@/lib/types/database";

export function TutorialPopup({
  instructions,
  gameSlug,
}: {
  instructions?: GameInstructions | null;
  gameSlug: string;
}) {
  const locale = useLocale();
  const storageKey = `mioshy:tutorial-seen:${gameSlug}`;

  // Default to NOT showing — flip to true only after we've verified the
  // user hasn't seen it yet. Doing it the other way around would flash
  // the modal for users who've already dismissed it on every page load.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) setOpen(true);
    } catch {
      // localStorage may be blocked (private mode, embedded webview).
      // Fall back to "show once per session" by simply opening — the
      // dismiss handler is a no-op in that case, and the modal will
      // close normally for the duration of the session.
      setOpen(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore — see comment above */
    }
    setOpen(false);
  };

  // Resolve labels used as string props (aria-label etc.) up front;
  // hooks can't sit below the open-guard return.
  const dialogTitle = useCmsText("gamesSlug.tutorial.title").text;
  const dismissLabel = useCmsText("gamesSlug.tutorial.dismiss").text;
  const reopenLabel = useCmsText("gamesSlug.tutorial.reopen").text;

  // a11y (B3): move focus into the dialog on open, restore it (to the reopen
  // button / trigger) on close.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      const id = window.setTimeout(() => dialogRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    prevFocusRef.current?.focus?.();
  }, [open]);

  // Per-game content for the active locale. Hebrew-only for now: on other
  // locales (or games without instructions) we fall back to the generic
  // CMS tutorial below.
  const content =
    instructions?.[locale === "he" ? "he" : "en"] ?? undefined;
  const hasCustom = Boolean(
    content &&
      (content.title ||
        content.intro ||
        (content.steps && content.steps.length > 0) ||
        content.footer),
  );

  // When closed, keep a low-key corner button so the player can reopen the
  // rules at any time. Top corners are free on both layouts (logo is centred,
  // the back/sound buttons live in the bottom corners).
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={reopenLabel}
        className="fixed end-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
      >
        <HelpCircle className="h-4 w-4" />
        <span>{reopenLabel}</span>
      </button>
    );
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={hasCustom && content?.title ? content.title : dialogTitle}
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      onClick={dismiss}
    >
      {/* Backdrop — solid wash so the wheel behind doesn't distract */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(8,4,12,0.78)" }}
      />

      <div
        className="relative max-h-[88dvh] w-full max-w-[420px] overflow-y-auto rounded-3xl border p-6 sm:p-7"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background:
            "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
          boxShadow:
            "0 30px 80px -20px rgba(184,60,77,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -start-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl"
          style={{ background: "#B83C4D" }}
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissLabel}
          className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]"
            style={{ background: "rgba(184,60,77,0.25)" }}
          >
            <Sparkles className="h-3 w-3" />
            <CmsText cmsKey="gamesSlug.tutorial.badge" />
          </span>

          {hasCustom ? (
            <CustomInstructions content={content!} fallbackTitle={dialogTitle} />
          ) : (
            <GenericInstructions />
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-6 text-[16px] font-bold text-white transition hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 16px 36px -12px rgba(184,60,77,0.55)",
            }}
          >
            <CmsText cmsKey="gamesSlug.tutorial.cta" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Per-game instructions rendered from the game's `instructions` jsonb. */
function CustomInstructions({
  content,
  fallbackTitle,
}: {
  content: NonNullable<GameInstructions["he"]>;
  fallbackTitle: string;
}) {
  return (
    <>
      <h2 className="mt-3 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
        {content.title || fallbackTitle}
      </h2>

      {content.intro ? (
        <p className="mt-3 text-[20px] leading-relaxed text-white/80">
          {content.intro}
        </p>
      ) : null}

      {content.steps && content.steps.length > 0 ? (
        <ol className="mt-5 flex flex-col gap-3.5">
          {content.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#FAF6F7]"
                style={{
                  background: "rgba(184,60,77,0.22)",
                  boxShadow: "inset 0 0 0 1px rgba(184,60,77,0.35)",
                }}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="pt-0.5 text-[20px] leading-snug text-white/90">
                {step}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {content.footer ? (
        <p
          className="mt-5 rounded-2xl px-4 py-3 text-[20px] font-semibold leading-snug text-white"
          style={{
            background: "rgba(184,60,77,0.18)",
            boxShadow: "inset 0 0 0 1px rgba(184,60,77,0.30)",
          }}
        >
          {content.footer}
        </p>
      ) : null}
    </>
  );
}

/** Generic three-step wheel tutorial — the fallback when a game has no
 *  per-game instructions. Same content as before the per-game rewrite. */
function GenericInstructions() {
  return (
    <>
      <CmsText
        cmsKey="gamesSlug.tutorial.title"
        as="h2"
        className="mt-3 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]"
      />

      <ol className="mt-5 flex flex-col gap-3.5">
        <Step
          n={1}
          icon={<MousePointerClick className="h-4 w-4" />}
          cmsKey="gamesSlug.tutorial.step1"
        />
        <Step
          n={2}
          icon={<Eye className="h-4 w-4" />}
          cmsKey="gamesSlug.tutorial.step2"
        />
        <Step
          n={3}
          icon={<Heart className="h-4 w-4" />}
          cmsKey="gamesSlug.tutorial.step3"
        />
      </ol>
    </>
  );
}

function Step({
  n,
  icon,
  cmsKey,
}: {
  n: number;
  icon: React.ReactNode;
  cmsKey: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#FAF6F7]"
        style={{
          background: "rgba(184,60,77,0.22)",
          boxShadow: "inset 0 0 0 1px rgba(184,60,77,0.35)",
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex items-baseline gap-2 text-[20px] leading-snug text-white/90">
        <span
          className="text-[12px] font-bold tracking-wider text-white/45"
          aria-hidden
        >
          {String(n).padStart(2, "0")}
        </span>
        <CmsText cmsKey={cmsKey} />
      </span>
    </li>
  );
}
