"use client";

/**
 * LogoutLink — the "התנתקות" row at the bottom of the sidebar.
 *
 * Wraps the existing `logoutAction` server action so we don't duplicate
 * the signout / session-invalidation contract. The button looks like a
 * nav row (same padding, icon, label) but submits a transition + hard
 * redirect to `/` so cached auth state is dropped from every layer
 * (intl middleware, RSC tree, supabase client cache).
 *
 * Visual: hover paints the row in soft wine — different from regular
 * nav hover so the user perceives the action as destructive without
 * the row screaming for attention.
 *
 * Pure client component — needs `useTransition` for the disabled state
 * during the round-trip. See components/auth/LogoutButton.tsx for the
 * same pattern used in the public site header.
 */

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";

import { logoutAction } from "@/app/actions/auth-actions";

interface Props {
  /** Localized button label, e.g. "התנתקות". */
  label: string;
  /** Optional aria-label override for screen readers. */
  ariaLabel?: string;
}

export function LogoutLink({ label, ariaLabel }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await logoutAction();
      } finally {
        // Hard redirect — drops every cached layer (RSC tree, the
        // supabase client cache held in middleware, the next-intl
        // request cookies). assign() instead of push() so the back
        // button doesn't return the user to the authenticated page.
        window.location.assign("/");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={ariaLabel ?? label}
      className="relative mt-1 flex min-h-[40px] w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-start text-[15px] font-semibold transition disabled:opacity-60"
      style={{
        color: "var(--shell-side-t2)",
        background: "transparent",
        border: 0,
      }}
      onMouseEnter={(e) => {
        if (isPending) return;
        (e.currentTarget as HTMLElement).style.color = "var(--shell-pink-text)";
        (e.currentTarget as HTMLElement).style.background =
          "rgba(184,60,77,0.10)";
      }}
      onMouseLeave={(e) => {
        if (isPending) return;
        (e.currentTarget as HTMLElement).style.color = "var(--shell-side-t2)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {isPending ? (
        <Loader2 className="h-[19px] w-[19px] shrink-0 animate-spin" />
      ) : (
        <LogOut className="h-[19px] w-[19px] shrink-0" />
      )}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}
