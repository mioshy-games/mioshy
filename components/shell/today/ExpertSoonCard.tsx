/**
 * ExpertSoonCard — placeholder shown on /my/today when the user has
 * a Journey subscription but no expert assigned to them yet.
 *
 * Replaces the ChatRowPreview slot (which would otherwise be empty).
 * Without this row the page reads as "you have a subscription but no
 * coach" — a confusing gap. With it the user sees a clear handhold:
 * "we're matching you, messages will land here".
 *
 * Used only in the assigned-soon state; once an expert is attached
 * the regular <ChatRowPreview> takes over.
 */

import { MessageCircle } from "lucide-react";

interface Props {
  title: string;
  body: string;
}

export function ExpertSoonCard({ title, body }: Props) {
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border p-4"
      style={{
        background: "var(--shell-card)",
        borderColor: "var(--shell-line-soft)",
      }}
      aria-label={title}
    >
      <div
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--shell-wine-soft)",
          color: "var(--shell-pink-text)",
        }}
        aria-hidden
      >
        <MessageCircle className="h-[20px] w-[20px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[16px] font-bold"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </div>
        <p
          className="m-0 mt-1 text-[16px] leading-[1.45]"
          style={{ color: "var(--shell-text-2)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
