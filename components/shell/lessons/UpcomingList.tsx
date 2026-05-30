/**
 * UpcomingList — list of lessons that are locked / not yet unlocked.
 *
 * Visually muted compared to the completed list (opacity 0.72 +
 * thinner border). The clock icon signals "waiting", not "done".
 *
 * Renders an empty-state card when items=[] so the user sees an
 * intentional "all caught up" surface rather than a missing section.
 */

import { Link } from "@/navigation";
import { Clock } from "lucide-react";

export interface UpcomingItem {
  id: string;
  title: string;
  categoryName: string | null;
  /** Localized "ייפתח מחר" / "Opens tomorrow" stamp. */
  whenLabel: string;
  /** Where to go if the user clicks it (deep link still works even
   *  while locked — the journey reader handles the lock screen). */
  href: string;
}

interface Props {
  /** Section heading, e.g. "בקרוב". */
  title: string;
  /** "ממתינים" suffix, e.g. "4 ממתינים". */
  waitingSuffix: string;
  items: UpcomingItem[];
  /** Empty-state copy when there are no upcoming items. */
  emptyTitle?: string;
  emptyBody?: string;
}

export function UpcomingList({
  title,
  waitingSuffix,
  items,
  emptyTitle,
  emptyBody,
}: Props) {
  // Empty state — show an intentional placeholder so the section never
  // disappears silently. Hides only when the caller didn't supply
  // empty-state strings (backwards-compat with earlier callers).
  if (items.length === 0) {
    if (!emptyTitle) return null;
    return (
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between pt-1">
          <h3
            className="m-0 text-[18px] font-extrabold tracking-tight"
            style={{ color: "var(--shell-text-1)" }}
          >
            {title}
          </h3>
        </div>
        <div
          className="rounded-[14px] border p-5 text-center"
          style={{
            background: "rgba(29,14,54,0.30)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--shell-text-3)" }}
            aria-hidden
          >
            <Clock className="h-[17px] w-[17px]" />
          </div>
          <div
            className="text-[16px] font-bold"
            style={{ color: "var(--shell-text-2)" }}
          >
            {emptyTitle}
          </div>
          {emptyBody ? (
            <p
              className="m-0 mt-1 text-[14px] leading-relaxed"
              style={{ color: "var(--shell-text-3)" }}
            >
              {emptyBody}
            </p>
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between pt-1">
        <h3
          className="m-0 text-[18px] font-extrabold tracking-tight"
          style={{ color: "var(--shell-text-1)" }}
        >
          {title}
        </h3>
        <span className="text-[14px]" style={{ color: "var(--shell-text-3)" }}>
          {items.length} {waitingSuffix}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3.5 rounded-[13px] border p-3.5 opacity-[0.72] transition hover:opacity-100"
              style={{
                background: "rgba(29,14,54,0.30)",
                borderColor: "rgba(255,255,255,0.04)",
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--shell-text-3)",
                }}
              >
                <Clock className="h-[17px] w-[17px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[20px] font-medium leading-snug"
                  style={{ color: "var(--shell-text-2)" }}
                >
                  {item.title}
                </div>
                <div
                  className="mt-0.5 truncate text-[14px]"
                  style={{ color: "var(--shell-text-3)" }}
                >
                  {item.categoryName
                    ? `${item.categoryName} · ${item.whenLabel}`
                    : item.whenLabel}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
