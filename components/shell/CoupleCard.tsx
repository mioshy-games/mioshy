/**
 * CoupleCard — top of the desktop sidebar.
 *
 * Shows the couple's names + two stacked avatar initials. For solo
 * users (no partner paired yet) falls back to a single avatar.
 *
 * Visual spec: post-login-mockup-v12.html, .couple-card. The two
 * avatars use two slightly different gradients (pink→wine, amber→wine)
 * so the pair reads as "two people" instantly without needing photos.
 *
 * Pure presentational. Receives data from the parent <SideNav>.
 */

import { MoreHorizontal } from "lucide-react";
import type { CoupleCardData } from "./types";

interface Props {
  data: CoupleCardData;
  /** Optional click handler for the ⋯ menu button (account drawer etc.). */
  onMenu?: () => void;
}

export function CoupleCard({ data, onMenu }: Props) {
  const {
    ownerName,
    ownerInitial,
    partnerName,
    partnerInitial,
    statusLine,
  } = data;

  const hasPartner =
    !!partnerInitial && partnerInitial.trim().length > 0;

  // Display: "נועה ויואב" when paired, just "נועה" otherwise.
  const displayName = hasPartner && partnerName
    ? `${ownerName} ו${partnerName}`
    : ownerName;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--shell-side-line)] px-3.5 pb-3 pt-3.5">
      {/* Avatar pair (RTL-aware: pink/wine first = owner, amber/wine = partner) */}
      <div className="relative flex shrink-0 items-center">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 text-[13px] font-extrabold text-white"
          style={{
            background:
              "linear-gradient(135deg, #EC4899 0%, #B83C4D 100%)",
            borderColor: "var(--shell-side-bg)",
          }}
          aria-hidden
        >
          {ownerInitial}
        </div>
        {hasPartner ? (
          <div
            className="-ms-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 text-[13px] font-extrabold text-white"
            style={{
              background:
                "linear-gradient(135deg, #F59E0B 0%, #B83C4D 100%)",
              borderColor: "var(--shell-side-bg)",
            }}
            aria-hidden
          >
            {partnerInitial}
          </div>
        ) : null}
      </div>

      {/* Names + status */}
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[14px] font-bold leading-tight"
          style={{ color: "var(--shell-side-t1)" }}
        >
          {displayName}
        </div>
        {statusLine ? (
          <div
            className="mt-0.5 truncate text-[12px]"
            style={{ color: "var(--shell-side-t2)" }}
          >
            {statusLine}
          </div>
        ) : null}
      </div>

      {/* ⋯ menu button (hooked up by parent — common targets: account
          drawer, switch couple, view profile). Renders even when no
          handler is wired so the chrome stays consistent during the
          transition; clicking is a no-op until wired. */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="פתח תפריט פרופיל"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-[var(--shell-side-hover)]"
        style={{ color: "var(--shell-side-t2)" }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
