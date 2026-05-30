/**
 * ChatRowPreview — small card that previews the last message from the
 * assigned expert and links to the full chat surface.
 *
 * Renders null when there's no expert OR no message — caller controls
 * whether to show an empty state in its place.
 */

import { Link } from "@/navigation";

export interface ChatRowPreviewData {
  expertName: string;
  expertInitial: string;
  /** Last message body. May be long — component clamps to 2 lines. */
  message: string;
  /** Localized relative time stamp, e.g. "לפני 2 שעות". */
  whenLabel: string;
  /** Unread count badge. 0 hides it. */
  unread: number;
  /** Where the card links to. */
  href: string;
  /** Sage dot on the avatar (online). */
  online?: boolean;
}

interface Props {
  data: ChatRowPreviewData | null;
}

export function ChatRowPreview({ data }: Props) {
  if (!data || !data.message) return null;

  return (
    <Link
      href={data.href}
      className="flex items-center gap-3 rounded-[14px] border p-4 transition hover:brightness-110"
      style={{
        background: "var(--shell-card)",
        borderColor: "var(--shell-line-soft)",
      }}
    >
      <div className="relative shrink-0">
        <div
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[17px] font-extrabold text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--shell-wine) 0%, var(--shell-wine-deep) 100%)",
          }}
          aria-hidden
        >
          {data.expertInitial}
        </div>
        {data.online ? (
          <span
            className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2"
            style={{
              background: "var(--shell-sage)",
              borderColor: "var(--shell-card)",
            }}
            aria-label="online"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span
            className="truncate text-[16px] font-bold"
            style={{ color: "var(--shell-text-1)" }}
          >
            {data.expertName}
          </span>
          <span
            className="shrink-0 text-[14px]"
            style={{ color: "var(--shell-text-3)" }}
          >
            {data.whenLabel}
          </span>
        </div>
        <div
          className="line-clamp-2 text-[20px] leading-[1.4]"
          style={{ color: "var(--shell-text-1)" }}
        >
          “{data.message}”
        </div>
      </div>

      {data.unread > 0 ? (
        <span
          className="flex h-7 min-w-[28px] shrink-0 items-center justify-center self-center rounded-full px-2.5 text-[14px] font-extrabold text-white"
          style={{ background: "var(--shell-cta-grad)" }}
        >
          {data.unread > 99 ? "99+" : data.unread}
        </span>
      ) : null}
    </Link>
  );
}
