/**
 * ExpertMini — bottom of the desktop sidebar.
 *
 * Shows the assigned expert's avatar + online dot + last message
 * preview (clamped 2 lines), and a subtle "שאלה ל…" link to the chat
 * surface.
 *
 * Per Studio v12 sign-off the CTA here is INTENTIONALLY subtle (text
 * link with a soft outline) — not a gradient button. Reason: only the
 * hero CTA inside the content area should compete for the eye. The
 * sidebar is presence + wayfinding, not action.
 *
 * Renders `null` when no expert is assigned (component is opt-out).
 */

import { Link } from "@/navigation";
import { MessageCircle } from "lucide-react";
import type { ExpertMiniData } from "./types";

interface Props {
  data: ExpertMiniData | null;
}

export function ExpertMini({ data }: Props) {
  if (!data || !data.expertName) return null;

  const {
    expertName,
    expertInitial,
    online = false,
    lastMessage,
    askHref,
    askLabel,
  } = data;

  return (
    <div className="border-t border-[var(--shell-side-line)] px-3 pb-4 pt-3">
      {/* avatar + name + online status */}
      <div className="mb-2 flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--shell-wine) 0%, var(--shell-wine-deep) 100%)",
            }}
            aria-hidden
          >
            {expertInitial}
          </div>
          {online ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-[9px] w-[9px] rounded-full border-2"
              style={{
                background: "var(--shell-sage)",
                borderColor: "var(--shell-side-bg)",
              }}
              aria-label="online"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-bold"
            style={{ color: "var(--shell-side-t1)" }}
          >
            {expertName}
          </div>
          <div
            className="mt-0.5 truncate text-[11px]"
            style={{ color: "var(--shell-side-t2)" }}
          >
            {online ? "online · המומחית שלכם" : "המומחית שלכם"}
          </div>
        </div>
      </div>

      {/* last message preview (optional, clamped 2 lines) */}
      {lastMessage ? (
        <div
          className="mb-2 line-clamp-2 rounded-[10px] px-2.5 py-2 text-[13px] leading-[1.4]"
          style={{
            color: "var(--shell-side-t2)",
            background: "var(--shell-side-hover)",
          }}
        >
          {lastMessage}
        </div>
      ) : null}

      {/* subtle ask link — outline only, no gradient fill (Studio v12) */}
      <Link
        href={askHref}
        className="flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[13px] font-semibold transition hover:bg-[rgba(242,181,189,0.06)]"
        style={{
          color: "var(--shell-pink-text)",
          borderColor: "rgba(242,181,189,0.18)",
        }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>{askLabel}</span>
      </Link>
    </div>
  );
}
