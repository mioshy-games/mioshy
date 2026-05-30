/**
 * ExpertChatHeader — top section of the /my/expert page.
 *
 * Larger version of the chat-row preview: avatar + name + role + online
 * dot. Sits beneath the PageHeader, above the conversation. Matches the
 * v12 `.chat-head` spec.
 */

interface Props {
  expertName: string;
  expertInitial: string;
  /** Localized "המומחית שלכם · online · מענה תוך 24 שעות" sub-line. */
  subLine: string;
  online?: boolean;
}

export function ExpertChatHeader({
  expertName,
  expertInitial,
  subLine,
  online = false,
}: Props) {
  return (
    <header
      className="mb-2 flex items-center gap-3.5 border-b pb-3"
      style={{ borderColor: "var(--shell-line-soft)" }}
    >
      <div className="relative shrink-0">
        <div
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-extrabold text-white"
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
            className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full border-2"
            style={{
              background: "var(--shell-sage)",
              borderColor: "var(--shell-canvas)",
            }}
            aria-label="online"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[18px] font-bold"
          style={{ color: "var(--shell-text-1)" }}
        >
          {expertName}
        </div>
        <div
          className="mt-0.5 truncate text-[14px]"
          style={{ color: "var(--shell-text-3)" }}
        >
          {subLine}
        </div>
      </div>
    </header>
  );
}
