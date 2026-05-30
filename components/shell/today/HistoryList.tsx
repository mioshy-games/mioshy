/**
 * HistoryList — short list of recently completed lessons.
 *
 * Each row shows: ✓ icon · title · category sub-line · time-ago.
 * "done" styling intentionally muted (Studio v12) so the eye prioritises
 * the hero current-lesson card above.
 */

import { Link } from "@/navigation";
import { Check } from "lucide-react";

export interface HistoryItem {
  id: string;
  title: string;
  categoryName: string | null;
  /** Localized "לפני 3 ימים" / "השבוע שעבר" stamp. */
  whenLabel: string;
  /** Where to deep-link the lesson (review mode). */
  href: string;
  /** Sub-line suffix — usually "הושלם" / "Completed". */
  doneLabel: string;
}

interface Props {
  /** Section heading, e.g. "ההיסטוריה שלכם". */
  title: string;
  /** Top-right link label, e.g. "הכל". */
  allLinkLabel: string;
  /** Where the "all" link points. */
  allHref: string;
  /** Pre-counted total — "(9)" suffix on the link. Null hides. */
  totalCount?: number | null;
  /** Items in display order. Pass a slice (e.g. .slice(0, 3)) — the
   *  component never trims itself. Empty array renders nothing. */
  items: HistoryItem[];
}

export function HistoryList({
  title,
  allLinkLabel,
  allHref,
  totalCount,
  items,
}: Props) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between pt-1">
        <h3
          className="m-0 text-[18px] font-extrabold tracking-tight"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </h3>
        <Link
          href={allHref}
          className="text-[14px] font-semibold"
          style={{ color: "var(--shell-pink-text)" }}
        >
          {allLinkLabel}
          {totalCount != null ? ` (${totalCount})` : ""}
        </Link>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3.5 rounded-[13px] border p-3.5 transition hover:brightness-110"
              style={{
                background: "rgba(29,14,54,0.50)",
                borderColor: "rgba(255,255,255,0.04)",
              }}
            >
              {/* ✓ icon square */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                style={{
                  background: "var(--shell-sage-soft)",
                  color: "var(--shell-sage)",
                }}
              >
                <Check className="h-[17px] w-[17px]" strokeWidth={2.5} />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[20px] font-bold leading-snug"
                  style={{ color: "var(--shell-text-2)" }}
                >
                  {item.title}
                </div>
                <div
                  className="mt-0.5 truncate text-[14px]"
                  style={{ color: "var(--shell-text-3)", opacity: 0.85 }}
                >
                  {item.categoryName
                    ? `${item.categoryName} · ${item.doneLabel}`
                    : item.doneLabel}
                </div>
              </div>

              <div
                className="shrink-0 text-[14px]"
                style={{ color: "var(--shell-text-3)" }}
              >
                {item.whenLabel}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
